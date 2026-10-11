import './style.css';
import { createTechnicalLines } from './technical-lines.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const deg = THREE.MathUtils.degToRad;
const STORAGE = 'takmak.scene.pose.v2'; // New baseline: author's selected second pose; old saves remain untouched.
const EMBED = new URLSearchParams(location.search).get('embed') === '1';
if(EMBED) document.body.classList.add('embedded-scene');
const DEFAULT = { profile: 'low', side: 'left', gap: 14, lift: 12, legends: true, left: { yaw: 13, tilt: -2, roll: -13 }, right: { yaw: -10, tilt: 21, roll: 15 } };
let state = structuredClone(DEFAULT), ready = false, savedPose = null;
const assemblies = {}, legendObjects = [], geometryCache = new Map();
let renderer, scene, camera, orbit, renderTimer, oledBitmap, lastWidth = 0, lastHeight = 0;
const viewport = $('#viewport');
const technicalLines=createTechnicalLines(),surfaceMaterials=new Set();
let renderStyle='technical',lighting;
let adaptiveContours=true;
try{adaptiveContours=localStorage.getItem('takmak.scene.adaptive-contours')!=='false';}catch{}
technicalLines.setAdaptive(adaptiveContours);$('#adaptive-contours').checked=adaptiveContours;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let floating=!reducedMotion.matches,floatTime=0,lastFrameTime=0;
$('#floating').checked=floating;

function toast(text) { $('#toast').textContent=text; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4000); }
function download(blob,name) { const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function material(color,roughness=.62,metalness=0){
 const m=new THREE.MeshStandardMaterial({color,roughness,metalness});
 m.userData.original={color:m.color.clone(),roughness,metalness};surfaceMaterials.add(m);return m;
}
function setRenderStyle(style){
 renderStyle=style==='technical'?'technical':'studio';const technical=renderStyle==='technical';
 technicalLines.setVisible(technical);document.body.dataset.renderStyle=renderStyle;$('#adaptive-contours').disabled=!technical;
 $$('.render-style button').forEach(b=>{const active=b.dataset.renderStyle===renderStyle;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
 for(const m of surfaceMaterials){
  const original=m.userData.original;m.color.copy(original.color);m.roughness=technical?.9:original.roughness;m.metalness=technical?0:original.metalness;
  // Lift only the already-white plastics; orange knobs and graphite stay their own colors.
  if(technical&&Math.min(m.color.r,m.color.g,m.color.b)>.65)m.color.lerp(new THREE.Color('#ffffff'),.65);
 }
 if(lighting){lighting.ambient.intensity=technical?1.5:.9;lighting.key.intensity=technical?1.65:2.3;lighting.fill.intensity=technical?.4:.65;lighting.fill.color.set(technical?'#ffffff':'#e8ecf0');scene.environmentIntensity=technical?.65:.48;renderer.toneMappingExposure=technical?1.1:.95;}
 try{if(!EMBED)localStorage.setItem('takmak.scene.render-style',renderStyle);}catch{}
 invalidate();
}

// Rounded rectangular rings make a tapered shell and a shallow concave dish.
// These are visual stand-ins for MBK and Cherry profiles, not manufacturing CAD.
function roundedRing(w,h,r,z,tilt=0,n=8){
 const pts=[];
 for(let c=0;c<4;c++){
  const cx=(c===0||c===3?1:-1)*(w/2-r),cy=(c<2?1:-1)*(h/2-r);
  for(let i=0;i<=n;i++){const a=c*Math.PI/2+i/n*Math.PI/2;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;pts.push([x,y,z+tilt*y]);}
 }
 return pts;
}
function capGeometry(wUnits,hUnits,low,row){
 const id=`${wUnits}-${hUnits}-${low}-${row}`;if(geometryCache.has(id))return geometryCache.get(id);
 const w=18.1+(wUnits-1)*19.05,h=18.1+(hUnits-1)*19.05;
 const topW=w-(low?1.05:4.5),topH=h-(low?1.05:4.7),H=low?3.2:8.3;
 const tilt=low?0:([.06,.025,-.015,-.06,-.045][row]??0);
 const rings=[roundedRing(w-.4,h-.4,1.4,0),roundedRing(w,h,1.5,.55),roundedRing(topW+.45,topH+.45,low?2:1.8,H-.5,tilt),roundedRing(topW,topH,low?2:1.7,H,tilt),roundedRing(topW*.72,topH*.72,1.2,H-.45,tilt),roundedRing(topW*.34,topH*.34,.8,H-.7,tilt)];
 const p=rings.flat(2),idx=[],N=rings[0].length;
 for(let k=0;k<rings.length-1;k++)for(let i=0;i<N;i++){let n=(i+1)%N,a=k*N+i,b=k*N+n,c=(k+1)*N+i,d=(k+1)*N+n;idx.push(a,b,c,b,d,c);}
 p.push(0,0,H-.75);const center=p.length/3-1;for(let i=0;i<N;i++)idx.push((rings.length-1)*N+i,(rings.length-1)*N+(i+1)%N,center);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
 // Keep the upper perimeter as the one continuous outline in the distant view.
 // The adjacent lower bevel ring is secondary detail, not another primary border.
 g.userData.contourKind='keycap';g.userData.primaryContour=rings[3];
 geometryCache.set(id,g);return g;
}
const legendTextures=new Map();
function legendTexture(text,light){
 const id=text+'-'+light;if(legendTextures.has(id))return legendTextures.get(id);
 const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.clearRect(0,0,256,256);ctx.fillStyle=light?'#343932':'#eeeeea';ctx.textAlign='center';ctx.textBaseline='middle';
 const lines=text.split('\n');if(lines.length===2){ctx.font='500 44px Arial';ctx.fillText(lines[0],128,81);ctx.font='600 66px Arial';ctx.fillText(lines[1],128,159);}else{ctx.font=`${text.length>2?'600 35':'500 76'}px Arial`;ctx.fillText(text,128,130);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();legendTextures.set(id,t);return t;
}
function keyInfo(key,side,low){
 if(key.role==='thumb')return {label:'',row:4};
 const x=key.x,y=key.y;
 if(y<-24){if(side==='left'){if(x<-130)return {label:'Fn',row:4};if(x<-110)return {label:'CTRL',row:4};if(x<-90)return {label:'ALT',row:4};if(x<-65)return {label:'',row:4};return {label:'↓',row:4};}return {label:x<60?'⇧':x<85?'':x<105?'←':x<125?'↓':x<145?'↑':'→',row:4};}
 const xs=side==='left'?[-139.87,-120.82,-101.77,-82.72,-63.67,-44.62]:[20.05,39.11,58.16,77.21,96.25,115.31,134.36,153.41];
 const tops=side==='left'?[43.65,43.60,48.36,50.74,45.98,45.98]:[41.22,45.98,45.98,50.74,48.36,43.60,43.60,43.60];
 let c=xs.reduce((best,v,i)=>Math.abs(x-v)<Math.abs(x-xs[best])?i:best,0),r=Math.max(0,Math.min(3,Math.round((tops[c]-y)/19.05)));
 const left=low?[
 ['~\n`','!\n1','@\n2','#\n3','$\n4','%\n5'],['TAB','Q','W','F','P','G'],['ESC','A','R','S','T','D'],['SHIFT','Z','X','C','V','B']
 ]:[['~\n`','!\n1','@\n2','#\n3','$\n4','%\n5'],['TAB','Q','W','E','P','T'],['ESC','A','G','S','F','D'],['SHIFT','Z','X','C','V','B']];
 const right=low?[
 ['↶','^\n6','&\n7','*\n8','(\n9',')\n0','_\n-','+\n='],['∞','J','L','U','Y',':\n;','{\n[','}\n]'],['⌫','H','N','E','I','"\n\'','|\n\\','!'],['','K','M','<\n,','>\n.','?\n/','SHIFT','SHIFT']
 ]:[['↶','^\n6','&\n7','*\n8','(\n9',')\n0','_\n-','+\n='],['TAB','O','I','U','Y','R','[',']'],['⌫','H','J','K','L',';','\'','CODE'],['','N','M',',','.','/','SHIFT','SHIFT']];
 return {label:key.width===2?'SHIFT':(side==='left'?left:right)[r][c],row:r};
}
function mesh(geometry,mat,parent){const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);technicalLines.add(m);return m;}
function cadMesh(id,mat,half,manifest,geometries,offsetY=0){
 const g=geometries[id].clone(),center=half.userData.center;
 g.scale(1000,1000,1000);g.translate(-center[0],-center[1]-offsetY,0);g.rotateX(-Math.PI/2);
 return mesh(g,mat,half);
}
function screen(half,low,layout){
 const p=layout.display,center=half.userData.center;
 const m=mesh(new THREE.BoxGeometry(11.2,1,34.5),material('#101d1d',.19),half);m.position.set(p.x-center[0],low?2.5:5.0,-(p.y-center[1]));
 // Native 128x32 ZMK readout rotated counterclockwise, as on the real keyboard.
 // Every lit cell comes from a monochrome LVGL glyph, with no browser text rasterization.
 const c=document.createElement('canvas');c.width=oledBitmap.height;c.height=oledBitmap.width;
 const ctx=c.getContext('2d');ctx.fillStyle='#08151c';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#79e8ff';
 oledBitmap.rows.forEach((row,y)=>{for(let x=0;x<row.length;x++)if(row[x]==='1')ctx.fillRect(y,127-x,1,1);});
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
 // STEP apertures: regular 8.5x24 mm, low 8.5x25 mm; their centres
 // offset (+0.5,+1) / (+0.5,+1.5) from the module recess, respectively.
 const g=new THREE.PlaneGeometry(5.6,22.4);g.rotateX(-Math.PI/2);
 const display=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));display.position.copy(m.position);display.position.add(new THREE.Vector3(.5,.56,low?-1.5:-1));half.add(display);
}
function knob(half,low,side,layout,manifest,geometries){
 const id='encoder-knob-16mm-3mm-'+(low?(side==='left'?'low-profile-screen':'low-profile-button'):'regular');
 const info=manifest.parts[id],g=geometries[id].clone();g.scale(1000,1000,1000);g.translate(-info.center[0],-info.center[1],-info.center[2]);g.rotateX(Math.PI); // original knob axis is Y, cap face points -Y
 const k=mesh(g,material(low?'#e84308':'#393c38',low?.43:.62),half);
 const center=half.userData.center;
 k.position.set(layout.encoder.x-center[0],(low?-.9:-1.4)+info.size[1]/2,-(layout.encoder.y-center[1]));
 // Shaft collar sits beneath the printed knob.
 const collar=mesh(new THREE.CylinderGeometry(3.2,3.2,3,28),material('#757b76',.3,.7),half);collar.position.set(k.position.x,1,k.position.z);
}
function createAssembly(profile,manifest,geometries,layout){
 const low=profile==='low',assembly=new THREE.Group();assembly.name=profile;scene.add(assembly);
 const caseMat=material(low?'#e6e5e2':'#303330',.62),capMat=material(low?'#f4f3f1':'#454743',.53),capAlt=material(low?'#eae9e6':'#383c37',.62),bottomMat=material(low?'#e4e3e0':'#282e28',.67),switchMat=material(low?'#b9b8ad':'#171d19',.5);
 const halves={};
 for(const side of ['left','right']){
  const half=new THREE.Group();half.name=profile+'-'+side;assembly.add(half);halves[side]=half;
  half.userData.center=manifest.parts[`takmak-${side}-universal-bottom`].center;
  // STEP bottoms meet regular tops at Z=-4; low tops start at Z=-2.
  // Move the bottom and its reset button together to close that assembly gap.
  const bottomId=`takmak-${side}-universal-bottom`,topId=`takmak-${side}-${low?'low':'regular'}-top`;
  const bottomLift=manifest.parts[topId].min[2]-manifest.parts[bottomId].max[2];
  cadMesh(bottomId,bottomMat,half,manifest,geometries).position.y=bottomLift;
  cadMesh(`takmak-${side}-${low?'low':'regular'}-top`,caseMat,half,manifest,geometries,low?150:0);
  cadMesh(`takmak-${side}-reset-button`,low?capMat:bottomMat,half,manifest,geometries).position.y=bottomLift;
  const center=half.userData.center;
  for(const key of layout.sides[side].keys){
   const {label,row}=keyInfo(key,side,low),holder=new THREE.Group();holder.position.set(key.x-center[0],low?2.15:4.5,-(key.y-center[1]));holder.rotation.y=deg(key.angle);half.add(holder);
   const cap=mesh(capGeometry(key.width,key.height,low,row),label.length>2?capAlt:capMat,holder);cap.rotation.x=-Math.PI/2;
   // Only the visible switch housing/stem is represented in this iteration.
   const sw=mesh(new THREE.BoxGeometry(low?13.8:13.9,low?3.8:6.8,low?13.8:13.9),switchMat,holder);sw.position.y=low?-1.7:-1.2;
   if(label){const g=new THREE.PlaneGeometry(11.2,11.2);g.rotateX(-Math.PI/2);const legend=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:legendTexture(label,low),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,toneMapped:false}));legend.position.y=low?3.24:8.45;legend.rotation.x=low?0:Math.atan([.06,.025,-.015,-.06,-.045][row]??0);holder.add(legend);legendObjects.push(legend);}
  }
  knob(half,low,side,layout.sides[side],manifest,geometries);
  if(side==='left')screen(half,low,layout.sides[side]);
 }
 return {group:assembly,halves};
}

function frameRender(){
 if(!ready)return;
 const now=performance.now(),animate=floating&&!document.hidden&&!$('#pose-gallery').open&&!$('#details').open;
 if(animate){floatTime+=Math.min((now-lastFrameTime)/1000,.05);updateAssembly(floatTime);}
 lastFrameTime=now;
 const moving=orbit.update();renderer.render(scene,camera);
 if(moving||animate)renderTimer=requestAnimationFrame(frameRender);else renderTimer=null;
}
function invalidate(){if(ready&&!renderTimer)renderTimer=requestAnimationFrame(frameRender);}
function visibleBounds(){
 const box=new THREE.Box3();
 for(const a of Object.values(assemblies))if(a.group.visible)box.union(new THREE.Box3().setFromObject(a.group));
 return box;
}
function fitCamera(){
 if(!Object.keys(assemblies).length)return;
 const box=visibleBounds(),target=box.getCenter(new THREE.Vector3());
 const direction=camera.position.clone().sub(orbit.target).normalize();
 camera.position.copy(target).add(direction);camera.lookAt(target);
 const inverse=camera.quaternion.clone().invert(),tanV=Math.tan(deg(camera.fov)/2),tanH=tanV*camera.aspect;
 let distance=0;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const v=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);
  distance=Math.max(distance,Math.abs(v.x)/(tanH*.9)+v.z,Math.abs(v.y)/(tanV*.9)+v.z);
 }
 // The homepage starts closer; the studio keeps its full-fit framing.
 orbit.target.copy(target);camera.position.copy(target).addScaledVector(direction,EMBED?distance/1.18:distance);orbit.update();
}
function resize(){
 const w=viewport.clientWidth,h=viewport.clientHeight;
 if(w===lastWidth&&h===lastHeight)return;
 const hadSize=lastWidth>0;lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);
 const stage=EMBED&&window.frameElement?.parentElement;
 if(stage){
  // Render beyond the stage without changing the scale of its central image.
  const {width,height}=stage.getBoundingClientRect();
  camera.setViewOffset(width,height,(width-w)/2,(height-h)/2,w,h);
 }else{camera.aspect=w/h;camera.updateProjectionMatrix();}
 if(hadSize&&ready)fitCamera();invalidate();
}
function setCamera(view='perspective'){
 const positions={perspective:[130,300,365],top:[0,490,.01],front:[50,95,490]};
 if(view==='perspective'&&poseOptions.length){camera.position.fromArray(poseOptions[1].pose.camera.position);orbit.target.fromArray(poseOptions[1].pose.camera.target);}else{camera.position.fromArray(positions[view]);orbit.target.set(0,10,0);}
 camera.lookAt(orbit.target);fitCamera();
 $$('.canvas-toolbar [data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});invalidate();
}
function updateAssembly(time=0){
 const compare=state.profile==='compare';
 for(const [name,a] of Object.entries(assemblies)){
  a.group.visible=compare||state.profile===name;
  a.group.position.set(0,compare?(name==='low'?0:30):0,compare?(name==='low'?83:-125):0);
  a.group.scale.setScalar(compare?.9:1);
  for(const side of ['left','right']){
   const h=a.halves[side],pose=state[side],wave=Math.sin(time*2*Math.PI/(side==='left'?7.5:9))*(side==='left'?1:-1);
   h.rotation.set(deg(pose.tilt+wave*.25),deg(pose.yaw),deg(pose.roll+wave*.35),'YXZ');
   h.position.set((side==='left'?-1:1)*(state.gap/2+(side==='left'?72.125:81.65)),25+(side==='left'?state.lift:0)+wave*1.6,side==='left'?-4:8);
  }
 }
 legendObjects.forEach(o=>o.visible=state.legends);invalidate();
}
function syncUI(){
 $$('.variant').forEach(b=>{const a=b.dataset.profile===state.profile;b.classList.toggle('active',a);b.setAttribute('aria-pressed',a);});
 $$('.segmented button').forEach(b=>{const a=b.dataset.side===state.side;b.classList.toggle('active',a);b.setAttribute('aria-pressed',a);});
 for(const key of ['yaw','tilt','roll']){$('#'+key).value=state[state.side][key];$('#'+key+'-value').textContent=state[state.side][key]+'°';}
 for(const key of ['gap','lift']){$('#'+key).value=state[key];$('#'+key+'-value').textContent=state[key]+' мм';}
 $('#legends').checked=state.legends;
 const captions={low:['Низкий профиль','Choc v1 · MBK · отдельный донгл','Белый / оранжевый'],regular:['Стандартный профиль','Kailh MX · Cherry profile · левая центральная','Графит / угольный'],compare:['Два характера','Низкий и стандартный профиль','Одна геометрия движения']};
 [$('#profile-name').textContent,$('#profile-spec').textContent,$('#finish-name').textContent]=captions[state.profile];
 $('.caption-index').innerHTML=(state.profile==='low'?'01':state.profile==='regular'?'02':'01 + 02')+' <span>/ TAKMAK</span>';
 $('.dot-white').style.background=state.profile==='regular'?'#454743':'#fbfaf3';$('.dot-orange').style.background=state.profile==='regular'?'#292e29':'#ed5a21';$('.dot-orange').style.borderColor=state.profile==='regular'?'#292e29':'#ed5a21';
}
function capturePose(){return {schema:'takmak.scene.pose',version:1,savedAt:new Date().toISOString(),units:'mm and degrees',state:structuredClone(state),camera:{position:camera.position.toArray(),target:orbit.target.toArray(),fov:camera.fov},geometry:'STEP exports supplied 2026-10-11',limitations:'Illustrative keycaps and switches; no PCB or mechanical fit verification.'};}
function validPose(p){
 const finite=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
 if(p?.schema!=='takmak.scene.pose'||p.version!==1||!p.state||!p.camera||!finite(p.camera.position,3)||!finite(p.camera.target,3)||!Number.isFinite(p.camera.fov)||p.camera.fov<10||p.camera.fov>100)return false;
 if(!['low','regular','compare'].includes(p.state.profile)||!['left','right'].includes(p.state.side)||typeof p.state.legends!=='boolean')return false;
 for(const [key,min,max] of [['gap',5,120],['lift',-35,55]])if(!Number.isFinite(p.state[key])||p.state[key]<min||p.state[key]>max)return false;
 for(const side of ['left','right'])for(const [key,min,max] of [['yaw',-70,70],['tilt',-35,45],['roll',-35,35]])if(!Number.isFinite(p.state[side]?.[key])||p.state[side][key]<min||p.state[side][key]>max)return false;
 return true;
}
function restorePose(p){if(!validPose(p))return false;state=structuredClone(p.state);camera.position.fromArray(p.camera.position);orbit.target.fromArray(p.camera.target);camera.fov=p.camera.fov;camera.updateProjectionMatrix();syncUI();updateAssembly();orbit.update();return true;}

let poseOptions = [], posePreviews = [];
async function loadPoseOptions(){
 const originals=await Promise.all(['01','02'].map(async id=>{const r=await fetch(`./poses/user-${id}.json`);if(!r.ok)throw Error('Не найден ракурс '+id);const p=await r.json();if(!validPose(p))throw Error('Некорректный ракурс '+id);return p;}));
 const option=(id,title,note,pose)=>({id,title,note,pose});
 const base=originals[1], variant=(edit)=>{const p=structuredClone(base);edit(p);return p;};
 const cameraAngle=(p,elevation,azimuth)=>{const target=new THREE.Vector3().fromArray(p.camera.target),radius=new THREE.Vector3().fromArray(p.camera.position).distanceTo(target),e=deg(elevation),a=deg(azimuth);p.camera.position=target.add(new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)).multiplyScalar(radius)).toArray();};
 poseOptions=[
  option('01','Твой первый','Исходный JSON · вид ближе к верхнему',originals[0]),
  option('02','Твой второй','Исходный JSON · основной кандидат',base),
  option('03','Чуть ниже','Камера 62° · лучше видна высота корпуса',variant(p=>cameraAngle(p,62,0))),
  option('04','По диагонали','Камера 64° / 18° · больше глубины',variant(p=>cameraAngle(p,64,18))),
  option('05','Спокойнее','Меньше крен · половинки ближе к плоскости',variant(p=>{p.state.left.roll=-6;p.state.right.roll=8;p.state.right.tilt=12;})),
  option('06','Больше воздуха','Зазор 32 мм · левая выше на 22 мм',variant(p=>{p.state.gap=32;p.state.lift=22;cameraAngle(p,68,-10);})),
 ];
}
function renderPosePreviews(){
 const current=capturePose(),size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),damping=orbit.enableDamping,zoom=camera.zoom;
 orbit.enableDamping=false;orbit.update();
 try{
  renderer.setPixelRatio(1);renderer.setSize(720,480,false);camera.aspect=1.5;camera.zoom=1.3;
  posePreviews=poseOptions.map(item=>{restorePose(item.pose);camera.aspect=1.5;camera.updateProjectionMatrix();renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');});
 }finally{
  renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);camera.aspect=size.x/size.y;camera.zoom=zoom;restorePose(current);orbit.enableDamping=damping;renderer.render(scene,camera);
 }
 const grid=$('#pose-grid');grid.replaceChildren();
 poseOptions.forEach((item,i)=>{
  const card=document.createElement('button');card.className='pose-card'+(item.id==='02'?' recommended':'');card.setAttribute('aria-label',`Выбрать ракурс ${item.id}: ${item.title}`);
  const image=document.createElement('img');image.src=posePreviews[i];image.alt=`Takmak, ракурс ${item.id} — ${item.title}`;image.width=720;image.height=480;
  const caption=document.createElement('div');caption.className='pose-card-caption';
  const title=document.createElement('strong');title.textContent=item.id+' / '+item.title;
  const note=document.createElement('span');note.textContent=item.note;caption.append(title,note);card.append(image,caption);
  card.addEventListener('click',()=>{restorePose(item.pose);fitCamera();$$('.canvas-toolbar [data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});$('#pose-gallery').close();toast(`Ракурс ${item.id}: ${item.title}. Можно настроить и зафиксировать.`);});grid.append(card);
 });
}
function openPoseGallery(){if(!ready||!poseOptions.length)return;renderPosePreviews();$('#pose-gallery').showModal();}
async function downloadPoseGrid(){
 const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1120;const ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,sheet.width,sheet.height);
 ctx.fillStyle='#202020';ctx.font='500 42px Arial';ctx.fillText('Takmak / шесть ракурсов',50,70);ctx.fillStyle='#777';ctx.font='22px Arial';ctx.fillText('01–02: исходные ракурсы автора. 03–06: варианты на основе второго.',50,111);
 for(let i=0;i<poseOptions.length;i++){
  const image=new Image();image.src=posePreviews[i];await image.decode();const x=40+(i%3)*580,y=155+Math.floor(i/3)*470;
  ctx.drawImage(image,x,y,560,373);ctx.fillStyle='#222';ctx.font='500 24px Arial';ctx.fillText(poseOptions[i].id+' / '+poseOptions[i].title,x+14,y+399);ctx.fillStyle='#777';ctx.font='17px Arial';ctx.fillText(poseOptions[i].note,x+14,y+431);
 }
 sheet.toBlob(b=>{if(b)download(b,'takmak-six-angles.png');},'image/png');
}
$('#browse-poses').addEventListener('click',openPoseGallery);
$('#close-gallery').addEventListener('click',()=>$('#pose-gallery').close());
$('#download-grid').addEventListener('click',downloadPoseGrid);

async function init(){
 renderer=new THREE.WebGLRenderer({canvas:$('#canvas'),antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.setClearColor(0x000000,0);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,1,2000);
 orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.minDistance=170;orbit.maxDistance=2500;orbit.maxPolarAngle=Math.PI*.85;orbit.addEventListener('change',invalidate);orbit.addEventListener('start',()=>{$$('.canvas-toolbar [data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});});
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.03).texture;room.dispose();pmrem.dispose();scene.environmentIntensity=.48;
 const ambient=new THREE.HemisphereLight(0xffffff,0xc9c9c9,.9);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xffffff,2.3);key.position.set(-130,280,150);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-370,right:370,top:350,bottom:-350,near:1,far:750});key.shadow.normalBias=.15;key.shadow.bias=-.0002;key.shadow.radius=4;scene.add(key);
 const fill=new THREE.DirectionalLight(0xe8ecf0,.65);fill.position.set(160,90,-150);scene.add(fill);lighting={ambient,key,fill};
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.ShadowMaterial({color:'#494949',opacity:.035}));floor.rotation.x=-Math.PI/2;floor.position.y=-30;floor.receiveShadow=true;scene.add(floor);
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
 const sc=shadowCanvas.getContext('2d'),gradient=sc.createRadialGradient(64,64,8,64,64,64);gradient.addColorStop(0,'rgba(45,45,45,0.17)');gradient.addColorStop(.55,'rgba(45,45,45,0.08)');gradient.addColorStop(1,'rgba(45,45,45,0)');sc.fillStyle=gradient;sc.fillRect(0,0,128,128);
 const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
 for(const x of [-95,105]){const blob=new THREE.Mesh(new THREE.PlaneGeometry(230,170),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));blob.rotation.x=-Math.PI/2;blob.position.set(x,-29.9,25);scene.add(blob);}

 const [manifest,layout,oled]=await Promise.all([fetch('./models/manifest.json').then(r=>{if(!r.ok)throw Error('Нет manifest.json');return r.json()}),fetch('./models/layout.json').then(r=>{if(!r.ok)throw Error('Нет layout.json');return r.json()}),fetch('./textures/oled-status.json').then(r=>{if(!r.ok)throw Error('Нет oled-status.json');return r.json()})]);
 oledBitmap=oled;
 const loader=new GLTFLoader(),geometries={};let count=0;const parts=Object.entries(manifest.parts).filter(([id])=>!id.startsWith('switch-'));
 await Promise.all(parts.map(async([id,part])=>{const gltf=await loader.loadAsync('./'+part.file);gltf.scene.updateMatrixWorld(true);const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index){meshes.push(g.toNonIndexed());g.dispose();}else meshes.push(g);}});const merged=mergeGeometries(meshes,false);if(!merged)throw Error('Несовместимая геометрия: '+id);merged.computeBoundingBox();geometries[id]=merged;meshes.forEach(g=>g.dispose());$('#loading-text').textContent=`Детали ${++count} / ${parts.length}`;}));
 assemblies.low=createAssembly('low',manifest,geometries,layout);assemblies.regular=createAssembly('regular',manifest,geometries,layout);
 await loadPoseOptions();
 try{if(!EMBED)renderStyle=localStorage.getItem('takmak.scene.render-style')||'technical';}catch{}
 setRenderStyle(renderStyle);
 ready=true;resize();restorePose(poseOptions[1].pose);fitCamera();
 try{const saved=!EMBED&&JSON.parse(localStorage.getItem(STORAGE));if(validPose(saved)){savedPose=saved;$('#restore').disabled=false;restorePose(saved);}}catch{}
 $('#browse-poses').disabled=false;
 $('#loading').classList.add('loaded');$('#loading').setAttribute('aria-hidden','true');$('#save').disabled=false;new ResizeObserver(resize).observe(viewport);invalidate();
 if(EMBED){
  orbit.enablePan=false;orbit.rotateSpeed=.7;orbit.zoomSpeed=.85;
  adaptiveContours=true;technicalLines.setAdaptive(true);
  window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='takmak:present')return;
   if(['low','regular'].includes(event.data.profile)){state.profile=event.data.profile;syncUI();}
   if(typeof event.data.animate==='boolean')floating=event.data.animate&&!reducedMotion.matches;
   updateAssembly();invalidate();
  });
  parent.postMessage({type:'takmak:ready'},location.origin);
 }
 if(new URLSearchParams(location.search).get('gallery')==='1')openPoseGallery();
 // Read-only diagnostics for repeatable local QA and future alignment work.
 window.takmakScene={getState:()=>capturePose(),getStats:()=>({parts:parts.length,keysPerHalf:{left:layout.sides.left.keys.length,right:layout.sides.right.keys.length},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,profile:state.profile,renderStyle,adaptiveContours,viewport:[lastWidth,lastHeight]}),setPose:(p)=>restorePose(p)};
}

$('#adaptive-contours').addEventListener('change',e=>{adaptiveContours=e.target.checked;technicalLines.setAdaptive(adaptiveContours);try{localStorage.setItem('takmak.scene.adaptive-contours',String(adaptiveContours));}catch{}invalidate();});
$$('.render-style button').forEach(b=>b.addEventListener('click',()=>{if(ready)setRenderStyle(b.dataset.renderStyle);}));
$$('.variant').forEach(b=>b.addEventListener('click',()=>{if(!ready)return;const compareChanged=(state.profile==='compare')!==(b.dataset.profile==='compare');state.profile=b.dataset.profile;syncUI();updateAssembly();if(compareChanged)setCamera();}));
$$('.segmented button').forEach(b=>b.addEventListener('click',()=>{state.side=b.dataset.side;syncUI();}));
for(const key of ['yaw','tilt','roll','gap','lift'])$('#'+key).addEventListener('input',e=>{if(['gap','lift'].includes(key))state[key]=Number(e.target.value);else state[state.side][key]=Number(e.target.value);syncUI();if(ready)updateAssembly();});
$('#floating').addEventListener('change',e=>{floating=e.target.checked;updateAssembly();invalidate();});
reducedMotion.addEventListener('change',e=>{floating=!e.matches;$('#floating').checked=floating;if(ready){updateAssembly();invalidate();}});
document.addEventListener('visibilitychange',invalidate);
$('#pose-gallery').addEventListener('close',invalidate);
$('#details').addEventListener('close',invalidate);
$('#legends').addEventListener('change',e=>{state.legends=e.target.checked;updateAssembly();});
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{if(ready)setCamera(b.dataset.view);}));
$('#reset').addEventListener('click',()=>{if(!ready)return;const profile=state.profile;const base=structuredClone(poseOptions[1].pose);base.state.profile=profile;restorePose(base);setCamera();toast('Возвращён твой второй ракурс.');});
$('#save').addEventListener('click',()=>{if(!ready)return;savedPose=capturePose();let local=true;try{localStorage.setItem(STORAGE,JSON.stringify(savedPose))}catch{local=false}$('#restore').disabled=false;download(new Blob([JSON.stringify(savedPose,null,2)+'\n'],{type:'application/json'}),`takmak-${state.profile}-pose.json`);toast(local?'Ракурс сохранён в браузере и скачан в JSON.':'JSON скачан. Хранилище браузера недоступно.');});
$('#restore').addEventListener('click',()=>{if(savedPose&&restorePose(savedPose))toast('Твой ракурс восстановлен.');});
$('#snapshot').addEventListener('click',()=>{if(!ready)return;renderer.render(scene,camera);renderer.domElement.toBlob(b=>{if(b){download(b,`takmak-${state.profile}-${renderStyle}.png`);toast('Изображение сцены сохранено в PNG.')}},'image/png');});
$('#panel-toggle').addEventListener('click',()=>{const open=$('#panel-toggle').getAttribute('aria-expanded')==='true';$('#panel-toggle').setAttribute('aria-expanded',!open);$('#panel-content').hidden=open;$('#panel-content').style.display=open?'none':'';$('.panel-icon').textContent=open?'+':'−';});
$('#details-button').addEventListener('click',()=>{$('#details').showModal();$('#details-button').setAttribute('aria-expanded','true')});
$('#close-details').addEventListener('click',()=>$('#details').close());$('#details').addEventListener('close',()=>$('#details-button').setAttribute('aria-expanded','false'));
init().catch(error=>{console.error(error);$('#loading strong').textContent='Не удалось открыть сцену';$('#loading-text').textContent=error.message+' — попробуй обновить страницу.';$('.loader-ring').style.animation='none';if(EMBED)parent.postMessage({type:'takmak:error'},location.origin);});
