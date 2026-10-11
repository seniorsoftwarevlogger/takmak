const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(__dirname, '../public/models');
fs.mkdirSync(out, { recursive: true });

// STEP is the authority for solid geometry. One glTF primitive per imported body,
// rather than one per CAD face; all generated glTF coordinates are in metres.
function glb(result, name) {
  const j={asset:{version:'2.0',generator:'Takmak STEP pipeline / occt-import-js'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
  const bins=[];let offset=0;
  function accessor(values, vectorSize, componentType, target, bounds=false){
    const typed=componentType===5126?new Float32Array(values):new Uint32Array(values);
    const data=Buffer.from(typed.buffer); const view=j.bufferViews.length;
    j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length,target});bins.push(data);offset+=data.length;
    const a={bufferView:view,componentType,count:values.length/vectorSize,type:vectorSize===3?'VEC3':'SCALAR'};
    if(bounds){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i++){a.min[i%3]=Math.min(a.min[i%3],typed[i]);a.max[i%3]=Math.max(a.max[i%3],typed[i]);}}
    j.accessors.push(a);return j.accessors.length-1;
  }
  for(const m of result.meshes){
    const positions=m.attributes.position.array.map(v=>v/1000);
    const attrs={POSITION:accessor(positions,3,5126,34962,true)};
    if(m.attributes.normal)attrs.NORMAL=accessor(m.attributes.normal.array,3,5126,34962);
    const indices=accessor(m.index.array,1,5125,34963);
    j.scenes[0].nodes.push(j.nodes.length);j.nodes.push({name:m.name||name,mesh:j.meshes.length});j.meshes.push({primitives:[{attributes:attrs,indices}]});
  }
  j.buffers[0].byteLength=offset;
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const bin=Buffer.concat(bins), header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+bin.length,8);
  jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,jh,json,bh,bin]);
}
function bounds(meshes){let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const m of meshes) m.attributes.position.array.forEach((v,i)=>{min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v)});return {min,max,size:min.map((v,i)=>max[i]-v),center:min.map((v,i)=>(max[i]+v)/2)};}
(async()=>{
 const occt=await require('occt-import-js')();const manifest={units:'millimetres in metadata; metres in GLB',parts:{},notes:['Original STEP files remain unchanged.','No PCB model is included.','Keycap surfaces are illustrative; exact cap CAD has not been supplied.']};
 const inputs=fs.readdirSync(path.join(root,'3d models/step')).filter(f=>f.endsWith('.step')).map(f=>({path:path.join(root,'3d models/step',f),name:f.replace('.step','')}));
 for(const input of inputs){
  const source=fs.readFileSync(input.path);
  const r=occt.ReadStepFile(source,{linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:0.06,angularDeflection:0.22});
  if(!r.success||!r.meshes.length)throw Error(`Could not import ${input.path}`);
  const id=input.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');const binary=glb(r,input.name);fs.writeFileSync(path.join(out,id+'.glb'),binary);
  manifest.parts[id]={file:`models/${id}.glb`,source:input.path,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),...bounds(r.meshes),triangles:r.meshes.reduce((n,m)=>n+m.index.array.length/3,0),bytes:binary.length};
  console.log(id, 'size',manifest.parts[id].size.map(n=>n.toFixed(2)).join(' × '),'triangles',manifest.parts[id].triangles);
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
