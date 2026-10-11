import './site.css';
const language=document.documentElement.lang;
const english=language==='en';
const languageKey='takmak.language';
try{
 if(!english && !new URLSearchParams(location.search).has('lang') && localStorage.getItem(languageKey)==='en'){
  location.replace(`${import.meta.env.BASE_URL}en.html${location.hash}`);
 }else localStorage.setItem(languageKey,language);
}catch{}
for(const link of document.querySelectorAll('[data-language]')){
 link.addEventListener('click',()=>{
  try{localStorage.setItem(languageKey,link.dataset.language);}catch{}
  link.hash=location.hash;
 });
}
const frame=document.querySelector('#product-scene');
const motion=document.querySelector('#motion');
const stage=frame.parentElement;
function sizeSceneSurface(){
 const bounds=stage.getBoundingClientRect();
 frame.style.left=`${-bounds.left}px`;
 frame.style.width=`${document.documentElement.clientWidth}px`;
}
new ResizeObserver(sizeSceneSurface).observe(stage);
window.addEventListener('resize',sizeSceneSurface);
sizeSceneSurface();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let profile='low',animate=!reduced.matches,visible=true,ready=false;
const profiles=english?{low:{description:'Low-profile case. Print in any colour.',switches:'Choc v1 / v2',keycaps:'Matched to your switches',connection:'Dongle or left half'},regular:{description:'Standard case. Print in any colour.',switches:'MX-compatible',keycaps:'Matched to your switches',connection:'Dongle or left half'}}:{low:{description:'Низкий корпус. Цвет печати — на выбор.',switches:'Choc v1 / v2',keycaps:'Под выбранные свитчи',connection:'Донгл или левая половинка'},regular:{description:'Стандартный корпус. Цвет печати — на выбор.',switches:'MX-совместимые',keycaps:'Под выбранные свитчи',connection:'Донгл или левая половинка'}};
function present(){if(ready)frame.contentWindow.postMessage({type:'takmak:present',profile,animate:animate&&visible},location.origin);}
function motionUI(){motion.setAttribute('aria-pressed',String(animate));motion.setAttribute('aria-label',english?(animate?'Pause floating':'Enable floating'):(animate?'Остановить парение':'Включить парение'));motion.innerHTML=`<span aria-hidden="true">${animate?'Ⅱ':'▷'}</span> ${english?'Floating':'Парение'}`;}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
 if(event.data?.type==='takmak:error'){document.querySelector('#scene-fallback').hidden=false;return;}
 if(event.data?.type!=='takmak:ready')return;
 ready=true;document.querySelector('#scene-fallback').hidden=true;present();
});
frame.addEventListener('error',()=>{document.querySelector('#scene-fallback').hidden=false;});
document.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',()=>{
 profile=button.dataset.profile;
 document.querySelectorAll('[data-profile]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
 const data=profiles[profile];document.querySelector('#profile-description').textContent=data.description;
 for(const key of ['switches','keycaps','connection'])document.querySelector('#spec-'+key).textContent=data[key];
 document.querySelector('#hero-download').href=`${import.meta.env.BASE_URL}downloads/takmak-${profile}-case.zip`;present();
}));
motion.addEventListener('click',()=>{animate=!animate;motionUI();present();});
reduced.addEventListener('change',()=>{animate=!reduced.matches;motionUI();present();});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;present();},{threshold:.05}).observe(frame);
motionUI();
