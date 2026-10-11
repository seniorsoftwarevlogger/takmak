const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(base,'public/models/manifest.json'))),layout=JSON.parse(fs.readFileSync(path.join(base,'public/models/layout.json')));
assert.equal(Object.keys(data.parts).length,11);
let triangles=0;
for(const [id,part] of Object.entries(data.parts)){
 const b=fs.readFileSync(path.join(base,'public',part.file));
 assert.equal(b.readUInt32LE(0),0x46546c67,id);assert.equal(b.readUInt32LE(4),2,id);assert.equal(b.readUInt32LE(8),b.length,id);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(part.source)).digest('hex'),part.sourceSha256,id);
 const n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),binStart=20+n+8;
 assert.equal(j.meshes.length,1,id);assert.equal(j.meshes[0].primitives.length,1,id);
 for(const a of j.accessors){const v=j.bufferViews[a.bufferView];assert(v.byteOffset+v.byteLength<=j.buffers[0].byteLength,id);if(a.componentType===5126){for(let off=binStart+v.byteOffset;off<binStart+v.byteOffset+v.byteLength;off+=4)assert(Number.isFinite(b.readFloatLE(off)),id);}}
 const pos=j.accessors[j.meshes[0].primitives[0].attributes.POSITION];pos.min.forEach((v,i)=>assert(Math.abs((pos.max[i]-v)*1000-part.size[i])<.001,id));
 triangles+=part.triangles;
}
assert.equal(layout.sides.left.keys.length,30);assert.equal(layout.sides.right.keys.length,37);
for(const side of ['left','right']){const keys=layout.sides[side].keys;assert.equal(new Set(keys.map(k=>[k.x,k.y].join(','))).size,keys.length);for(const k of keys)assert([k.x,k.y,k.angle,k.width,k.height].every(Number.isFinite));}
assert.equal(layout.sides.left.keys.filter(k=>k.height===2).length,1);
assert(layout.sides.right.encoder.y>layout.sides.right.keys.find(k=>k.role==='thumb').y);
console.log(`PASS: 11 STEP source hashes, 11 one-primitive GLB bodies, finite geometry, ${triangles} triangles, 30 + 37 unique keys and asymmetric thumb configuration.`);
