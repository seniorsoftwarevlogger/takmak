import * as THREE from 'three';

// CAD crease lines plus view-dependent silhouettes. Adjacent coplanar triangles
// never become a wireframe; the depth buffer hides the far side of each part.
export function createTechnicalLines() {
 const cache=new WeakMap(), lines=[], viewportSize=new THREE.Vector2();
 const material=new THREE.ShaderMaterial({
  transparent:true,depthTest:true,depthWrite:false,toneMapped:false,
  uniforms:{ink:{value:new THREE.Color('#202020')},opacity:{value:.68},viewportHeight:{value:1},adaptive:{value:1}},
  vertexShader:`
   attribute vec3 normalA;
   attribute vec3 normalB;
   attribute vec3 edgeCenter;
   attribute float crease;
   attribute float primary;
   attribute float detailOnly;
   uniform float viewportHeight;
   uniform float adaptive;
   varying float edgeOpacity;
   void main(){
    vec3 center=(modelViewMatrix*vec4(edgeCenter,1.0)).xyz;
    vec3 eye=normalize(-center);
    float a=dot(normalize(normalMatrix*normalA),eye);
    float b=dot(normalize(normalMatrix*normalB),eye);
    bool silhouette=a*b<0.0;
    // CSS pixels per model millimeter, including perspective, camera zoom,
    // viewport resize and assembly scale. DPR must not change detail thresholds.
    float pixelsPerMm=0.5*viewportHeight*projectionMatrix[1][1]
      *length(modelViewMatrix[0].xyz)/max(-center.z,0.001);
    float detail=mix(1.0,smoothstep(3.0,7.0,pixelsPerMm),adaptive);
    float outlineWeight=mix(0.62,1.0,detail);
    float creaseWeight=primary>0.5?mix(0.78,1.0,detail):detail;
    float silhouetteWeight=detailOnly>0.5?detail:outlineWeight;
    edgeOpacity=silhouette?max(silhouetteWeight,primary*creaseWeight):
      ((crease>0.5 && max(a,b)>0.0)?creaseWeight:0.0);
    // A fixed NDC bias pulled hidden mounting edges forward by millimeters at
    // distant zoom levels. Use a tiny, distance-independent view-space offset.
    vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
    viewPosition.z+=0.04;
    gl_Position=projectionMatrix*viewPosition;
   }`,
  fragmentShader:`
   uniform vec3 ink;
   uniform float opacity;
   varying float edgeOpacity;
   void main(){
    if(edgeOpacity<0.01)discard;
    gl_FragColor=vec4(ink,opacity*edgeOpacity);
    #include <colorspace_fragment>
   }`,
 });
 function geometry(source){
  if(cache.has(source))return cache.get(source);
  const p=source.attributes.position,index=source.index,edges=new Map();
  const count=index?index.count:p.count,va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3();
  const key=v=>v.map(n=>Math.round(n*10000)).join(',');
  const edgeKey=(a,b)=>{const ka=key(a),kb=key(b);return ka<kb?ka+'|'+kb:kb+'|'+ka;};
  const ring=source.userData.primaryContour,primaryEdges=new Set();
  if(ring)ring.forEach((point,i)=>primaryEdges.add(edgeKey(point,ring[(i+1)%ring.length])));
  const keycap=source.userData.contourKind==='keycap';
  for(let i=0;i<count;i+=3){
   const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).toArray());
   va.fromArray(points[0]);vb.fromArray(points[1]);vc.fromArray(points[2]);
   const n=vb.sub(va).cross(vc.sub(va));if(n.lengthSq()<1e-14)continue;n.normalize();
   for(let j=0;j<3;j++){
    const a=points[j],b=points[(j+1)%3],ka=key(a),kb=key(b);if(ka===kb)continue;
    const id=ka<kb?ka+'|'+kb:kb+'|'+ka;
    if(edges.has(id))edges.get(id).bNormal=n.toArray();
    else edges.set(id,{a,b,aNormal:n.toArray()});
   }
  }
  const positions=[],normalsA=[],normalsB=[],centers=[],creases=[],priorities=[],details=[];
  for(const e of edges.values()){
   const na=e.aNormal,nb=e.bNormal??na;
   const dot=na.reduce((s,v,i)=>s+v*nb[i],0);
   const primary=keycap?primaryEdges.has(edgeKey(e.a,e.b)):(!e.bNormal||dot<.5);
   const crease=primary||!e.bNormal||dot<Math.cos(THREE.MathUtils.degToRad(28));
   // Coplanar edges cannot be silhouettes, so discard them altogether.
   if(!primary&&e.bNormal&&dot>.99999)continue;
   const center=e.a.map((v,i)=>(v+e.b[i])/2);
   for(const point of [e.a,e.b]){positions.push(...point);normalsA.push(...na);normalsB.push(...nb);centers.push(...center);creases.push(crease?1:0);priorities.push(primary?1:0);details.push(keycap&&!primary?1:0);}
  }
  const g=new THREE.BufferGeometry();
  for(const [name,data,size] of [['position',positions,3],['normalA',normalsA,3],['normalB',normalsB,3],['edgeCenter',centers,3],['crease',creases,1],['primary',priorities,1],['detailOnly',details,1]])g.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  cache.set(source,g);return g;
 }
 return {
  add(mesh){const line=new THREE.LineSegments(geometry(mesh.geometry),material);line.name='technical-contours';line.renderOrder=2;line.visible=false;line.onBeforeRender=(renderer)=>{renderer.getSize(viewportSize);material.uniforms.viewportHeight.value=viewportSize.y;material.uniformsNeedUpdate=true;};mesh.add(line);lines.push(line);},
  setVisible(value){lines.forEach(line=>line.visible=value);},
  setAdaptive(value){material.uniforms.adaptive.value=value?1:0;},
 };
}
