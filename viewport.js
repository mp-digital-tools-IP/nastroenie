'use strict';
const el=id=>document.getElementById(id);
const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b};
const option=(title,value)=>new Option(title,value);
const engStages=['plumbing','electric','climate','bases'];
const indexOfPhase=id=>phases.findIndex(p=>p.id===id);
const state={phase:'interior',view:'walk',tab:'model',floor:0,room:4,stair:'album',systems:new Set(),xray:false,selected:null,photo:0,photoSource:false,measure:false};
const player={x:422,z:719,feet:0,eye:1.58,yaw:0,pitch:0};
const orbit={theta:-.66,phi:1.02,span:13.2,target:new THREE.Vector3(0,.75,.15)};
const ortho=new THREE.OrthographicCamera(-7,7,7,-7,.04,85);
let currentCamera=camera,needsFrame=true,movementKey=new Set(),noteTimer=0,pendingMeasure=null,measurement=null;
const guideObjects=new THREE.Group();scene.add(guideObjects);
const markers=new THREE.Group();scene.add(markers);
const selectedBox=new THREE.Box3Helper(new THREE.Box3(),0xd3803b);selectedBox.visible=false;selectedBox.material.depthTest=false;selectedBox.renderOrder=10;guideObjects.add(selectedBox);
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),workPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const ARCH=new Set(['structure','partition']);
const ghostMaterial=new THREE.MeshBasicMaterial({color:0x93998d,transparent:true,opacity:.145,side:THREE.DoubleSide,depthWrite:false});
const paintedMaterial=new THREE.MeshStandardMaterial({color:0xe6e1d5,roughness:.88});
const planFloorMat=new THREE.MeshBasicMaterial({color:0xf4f2e9});
const rawMaterials=new WeakMap();
const dotsByColor=new Map(),markersById=new Map();
function dotMap(hex){
 if(dotsByColor.has(hex))return dotsByColor.get(hex);
 const c=document.createElement('canvas');c.width=c.height=64;const a=c.getContext('2d');
 a.beginPath();a.arc(32,32,25,0,Math.PI*2);a.fillStyle='#fff';a.fill();
 a.beginPath();a.arc(32,32,19,0,Math.PI*2);a.fillStyle=hex;a.fill();
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 if(hex==='#2e82cc'){
  a.save();a.beginPath();a.arc(32,32,19,0,Math.PI*2);a.clip();a.fillStyle='#ed6c64';a.fillRect(32,11,22,42);a.restore();tex.needsUpdate=true
 }
 const mat=new THREE.SpriteMaterial({map:tex,depthTest:false,depthWrite:false,transparent:true,toneMapped:false});
 dotsByColor.set(hex,mat);return mat
}
function sourcePages(r){
 if(r.pages?.length)return r.pages;
 if(r.sourcePage)return [r.sourcePage];
 if(/PDF/i.test(r.source||'')){const found=(r.source||'').match(/(?:PDF[^0-9]*|стр\.\s*)(\d+)/i);if(found)return [+found[1]]}
 return phases.find(p=>p.id===r.stage)?.pages||[8]
}
for(const r of BIM.records){
 r.object.updateWorldMatrix(true,true);r.fullBox=new THREE.Box3().setFromObject(r.object);r.center=r.fullBox.getCenter(new THREE.Vector3());
 if(!r.pages)r.pages=sourcePages(r);
 if(ARCH.has(r.system))r.object.traverse(m=>{if(m.isMesh)rawMaterials.set(m,m.material)});
 if(engineering.has(r.system)&&!['drain','waterproof'].includes(r.system)){
  const s=new THREE.Sprite(dotMap(r.system==='water'&&r.name.includes('ГВС')?'#2e82cc':systemInfo[r.system][1]));s.position.copy(r.center);s.scale.setScalar(.16);s.renderOrder=8;s.userData.bimId=r.id;s.userData.isMarker=true;
  markers.add(s);markersById.set(r.id,s)
 }
}
function engineeringView(){return [...state.systems].some(i=>engineering.has(i))}
function notify(msg,ms=3300){el('viewnote').textContent=msg;clearTimeout(noteTimer);noteTimer=setTimeout(()=>el('viewnote').textContent='',ms)}
function phase(){return phases[indexOfPhase(state.phase)]}
function preset(id){
 const systems=new Set(['structure']),n=indexOfPhase(id);
 if(n>=1)systems.add('stair');if(n>=2)systems.add('partition');
 phase().systems.forEach(v=>systems.add(v));
 if(state.cumulative)for(const p of phases.slice(0,n+1))for(const sys of p.systems)systems.add(sys);
 if(n>=7)systems.add('finishes');
 return systems
}
function shouldShow(r){
 if(!state.systems.has(r.system))return false;
 if(r.system==='stair'&&(r.variant!==state.stair||state.phase==='existing'))return false;
 if(state.view!=='walk'){
  if(r.id===state.revealId)return true;
  if(r.kind==='roof')return false;
  if(r.system!=='stair'&&r.level!==state.floor)return false;
  if(r.name.startsWith('Участок стены над дверью'))return false;
  if(r.system==='finishes'&&(r.kind==='ceiling'||/потол|потолочн/i.test(r.name)||r.fullBox.min.y>upper*r.level+2.15))return false
 }
 return true;
}
function updateVisibility(){
 const cut=state.view!=='walk',finishing=state.systems.has('finishes');
 for(const r of BIM.records){
  const visible=shouldShow(r);r.object.visible=visible;
  if(ARCH.has(r.system)){
   const wall=!['roof','slab'].includes(r.kind),compress=cut&&wall;
   const scale=compress?(state.view==='plan'?.065:.42):1;
   r.object.scale.y=scale;r.object.position.y=upper*r.level*(1-scale);
   r.object.traverse(m=>{
    if(!m.isMesh)return;
    m.material=state.view==='plan'&&r.kind==='slab'?planFloorMat:state.xray&&wall?ghostMaterial:m.userData.wall&&finishing?paintedMaterial:rawMaterials.get(m);
    if(m.userData.wall)m.castShadow=false
   });
  }
  const pin=markersById.get(r.id);
  if(pin){pin.visible=visible&&cut;pin.scale.setScalar(state.view==='plan'?.17:.115)}
 }
 if(state.selected&&!BIM.byId.get(state.selected)?.object.visible)selectRecord(null);
 else if(state.selected)selectedBox.box.setFromObject(BIM.byId.get(state.selected).object);
 needsFrame=true;syncUI()
}
function applyPhase(id,chooseView=true){
 state.phase=id;state.revealId=null;state.custom=false;state.systems=preset(id);
 state.xray=engStages.includes(id);
 if(id==='existing'){state.xray=false;if(player.feet>.02&&player.feet<upper-.02)jumpRoom(0)}

 if(chooseView){
  if(engStages.includes(id))setView('plan',false);
  else if(id==='stairs'){setView('orbit',false);orbit.target.set((679-450)*unit,1.1,(488-550)*unit);orbit.span=6.4}
  else if(id==='existing'||id==='partitions')setView('orbit',false);
  else if(id==='interior'){jumpRoom(4);setView('walk',false)}
 }
 if(state.phase!=='existing'&&window.StairStudy?.setFinish)StairStudy.setFinish(indexOfPhase(id)>=7);
 selectRecord(null);clearMeasure();el('sidebar').classList.remove('open');updateVisibility();
}
function setStair(id){state.stair=id;window.StairStudy?.select(id);if(player.feet>0&&player.feet<upper)jumpRoom(0);selectRecord(null);updateVisibility()}
function syncUI(){
 const p=phase();el('stageName').textContent=p.short;
 el('stageStatus').textContent=state.custom?'Ручной состав слоёв':p.id==='existing'?'По описанию владельца':'Проектируемое состояние';
 el('contextTitle').textContent=p.lead;el('contextText').textContent=p.text;
 el('contextIcon').style.background=systemInfo[p.systems[0]][1];
 document.querySelectorAll('[data-phase]').forEach(b=>{b.classList.toggle('active',b.dataset.phase===p.id);b.setAttribute('aria-pressed',b.dataset.phase===p.id)});
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===state.view));
 document.querySelectorAll('[data-system]').forEach(c=>{c.checked=state.systems.has(c.dataset.system);c.disabled=c.dataset.system!=='structure'&&state.phase==='existing'});
 el('cumulative').checked=!!state.cumulative;el('cumulative').disabled=state.phase==='existing';el('xray').checked=state.xray;el('floorSelect').value=state.floor;el('roomBox').hidden=state.view!=='walk';el('walkpad').hidden=state.view!=='walk';
 el('zoomTools').hidden=state.view==='walk';el('traceBtn').hidden=state.view!=='plan';el('traceBtn').classList.toggle('on',!!state.trace&&state.view==='plan');el('measureBtn').hidden=state.view!=='plan';el('measureBtn').classList.toggle('on',state.measure);renderer.domElement.classList.toggle('measure',state.measure);
 el('stairsBar').hidden=p.id!=='stairs';el('stairSelect').value=state.stair;
}
function clearMeasure(){
 state.measure=false;pendingMeasure=null;
 if(measurement){guideObjects.remove(measurement);measurement.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose()}});measurement=null}
 needsFrame=true
}
function fitFloor(){orbit.span=13.3;orbit.target.set((460-450)*unit,state.floor*upper+.58,(555-550)*unit)}
function setView(view,update=true){
 state.view=view;state.revealId=null;clearMeasure();fitFloor();selectRecord(null);
 if(view==='walk'&&Math.abs(player.feet-state.floor*upper)>.32)jumpRoom(state.floor?6:0);
 if(update)updateVisibility()
}
function jumpRoom(i){
 const r=roomTable[i];if(!r)return;
 const [,f,,x,z,tx,tz]=r;state.room=i;state.floor=f;player.x=x;player.z=z;player.feet=f*upper;player.eye=1.60;
 player.yaw=Math.atan2(-(tx-x),-(tz-z));player.pitch=-.035;el('roomSelect').value=i;el('floorSelect').value=f;needsFrame=true
}
function setFloor(v){state.floor=v;if(state.view==='walk')jumpRoom(v?6:0);else fitFloor();clearMeasure();selectRecord(null);updateVisibility()}
function stairOn(){return state.phase!=='existing'&&state.systems.has('stair')&&state.stair!=='none'}
function move(nx,nz){
 const contains=(f)=>floors[f].some(([a,b,c,d])=>nx>=a&&nx<=c&&nz>=b&&nz<=d);
 const current=player.feet>upper-.11?1:0;
 const tread=stairOn()?StairStudy.treadAt(nx,nz):null;
 const next=current===1&&contains(1)?upper:tread?tread.top:current*upper;
 if(Math.abs(next-player.feet)>.28||(!tread&&!contains(current)))return;
 if(current===1&&stairOn()&&nx>648&&nx<662&&nz>461&&nz<596)return;
 const wallLevel=next>upper-.26?1:0;
 const blocked=w=>w.f===wallLevel&&nx>w.a-7&&nx<w.c+7&&nz>w.b-7&&nz<w.d+7;
 if(bounds.some(w=>(w.g===0||w.g===1&&state.systems.has('partition'))&&blocked(w)))return;
 if(state.systems.has('interior')&&(window.interiorObstacles||[]).some(blocked))return;
 player.x=nx;player.z=nz;player.feet=next;const newFloor=next>upper/2?1:0;
 if(newFloor!==state.floor){state.floor=newFloor;el('floorSelect').value=newFloor}
 needsFrame=true
}
const viewport=el('viewport');
function updateCamera(){
 const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight),aspect=w/h;
 if(state.view==='walk'){
  camera.aspect=aspect;camera.updateProjectionMatrix();camera.rotation.order='YXZ';
  camera.rotation.set(player.pitch,player.yaw,0);camera.position.set((player.x-450)*unit,player.feet+player.eye,(player.z-550)*unit);currentCamera=camera;
 }else{
  const size=Math.max(orbit.span,orbit.span*.79/aspect);
  ortho.left=-size*aspect/2;ortho.right=size*aspect/2;ortho.top=size/2;ortho.bottom=-size/2;ortho.updateProjectionMatrix();
  if(state.view==='plan'){ortho.up.set(0,0,-1);ortho.position.copy(orbit.target).add(new THREE.Vector3(0,25,0))}
  else{ortho.up.set(0,1,0);ortho.position.copy(orbit.target).add(new THREE.Vector3(Math.sin(orbit.theta)*Math.sin(orbit.phi)*23,Math.cos(orbit.phi)*23,Math.cos(orbit.theta)*Math.sin(orbit.phi)*23))}
  ortho.lookAt(orbit.target);currentCamera=ortho
 }
 currentCamera.updateMatrixWorld()
}
function render(){
 updateCamera();if(state.view==='walk'&&state.systems.has('interior')&&!state.xray&&window.renderInteriorView)window.renderInteriorView(scene,currentCamera);else renderer.render(scene,currentCamera);if(window.drawPlanInk)window.drawPlanInk();needsFrame=false
}
function resize(){if(viewport.clientWidth){renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);needsFrame=true}}
new ResizeObserver(resize).observe(viewport);THREE.DefaultLoadingManager.onLoad=()=>{needsFrame=true};
let clockTime=performance.now();
function tick(time){
 const dt=Math.min(.05,(time-clockTime)/1000);clockTime=time;
 if(state.tab==='model'&&!document.hidden){
  if(state.view==='walk'&&movementKey.size&&!document.querySelector('dialog[open]')){
   const has=(a,b)=>Number(movementKey.has(a)||movementKey.has(b)),forward=has('KeyW','ArrowUp')-has('KeyS','ArrowDown'),side=has('KeyD','ArrowRight')-has('KeyA','ArrowLeft');
   const speed=dt*1.55/unit/Math.max(1,Math.hypot(forward,side));
   move(player.x+(-Math.sin(player.yaw)*forward+Math.cos(player.yaw)*side)*speed,player.z);
   move(player.x,player.z+(-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*side)*speed)
  }
  if(needsFrame&&viewport.clientWidth)render()
 }
 requestAnimationFrame(tick)
}
function getRay(e){
 const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);updateCamera();ray.setFromCamera(pointer,currentCamera)
}
function selectRecord(r){
 state.selected=r?.id||null;selectedBox.visible=!!r;el('inspector').hidden=!r;
 if(r){
  selectedBox.box.setFromObject(r.object);el('objcode').textContent=r.id;
  el('objname').textContent=r.name;el('objmeta').textContent=[systemInfo[r.system]?.[0],(r.level+1)+' этаж',r.room,r.status].filter(Boolean).join(' · ');
  const attrs=[Number.isFinite(r.mountHeight)?'Отметка центра '+r.mountHeight.toLocaleString('ru')+' м.':'',Number.isFinite(r.areaM2)?'Площадь по листу '+r.areaM2.toLocaleString('ru')+' м².':''].filter(Boolean).join(' ');
  const note=[attrs,r.note,r.source?'Источник — '+r.source:''].filter(Boolean).join(' ');
  el('objnote').textContent=note;el('objSource').onclick=()=>showSheets(sourcePages(r));
  el('addNote').onclick=()=>openTasks(r.stage,r.id)
 }
 needsFrame=true
}
function placeMeasure(p){
 if(!pendingMeasure){
  clearMeasure();state.measure=true;pendingMeasure=p;measurement=new THREE.Group();guideObjects.add(measurement);mark(p);notify('Выберите вторую точку');return
 }
 const start=pendingMeasure;mark(p);
 const geometry=new THREE.BufferGeometry().setFromPoints([start,p]);
 const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xc85823,depthTest:false}));line.renderOrder=12;measurement.add(line);
 const distance=Math.hypot(p.x-start.x,p.z-start.z);
 const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#314936';ctx.fillRect(0,0,256,64);ctx.fillStyle='#fff';ctx.font='600 39px Segoe UI';ctx.textAlign='center';ctx.fillText(distance.toLocaleString('ru',{minimumFractionDigits:2,maximumFractionDigits:2})+' м',128,46);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false}));label.position.copy(start).lerp(p,.5);label.scale.set(1.35,.34,1);label.renderOrder=13;measurement.add(label);
 pendingMeasure=null;state.measure=false;syncUI();notify('Размер по модели в плане');needsFrame=true
}
function mark(p){const m=new THREE.Mesh(new THREE.SphereGeometry(.055,10,6),new THREE.MeshBasicMaterial({color:0xb14c26,depthTest:false}));m.position.copy(p);m.renderOrder=12;measurement.add(m)}
function clickScene(e){
 getRay(e);
 if(state.measure){workPlane.constant=-state.floor*upper;const v=new THREE.Vector3();if(ray.ray.intersectPlane(workPlane,v))placeMeasure(v);return}
 const pins=markers.children.filter(o=>o.visible);const pin=ray.intersectObjects(pins,false)[0];
 if(pin){selectRecord(BIM.byId.get(pin.object.userData.bimId));return}
 const targets=BIM.records.filter(r=>r.object.visible&&!(state.xray&&ARCH.has(r.system)&&!r.kind)).map(r=>r.object);
 const hits=ray.intersectObjects(targets,true);
 for(const hit of hits){let m=hit.object;if(m.material?.transparent&&m.material.opacity<.18)continue;
  while(m&&!m.userData.bimId)m=m.parent;
  if(m){selectRecord(BIM.byId.get(m.userData.bimId));return}
 }selectRecord(null)
}
let drag=null;
const canvas=renderer.domElement;
canvas.onpointerdown=e=>{if(e.button!==0)return;canvas.focus();canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,total:0,id:e.pointerId}};
canvas.onpointermove=e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.total+=Math.abs(dx)+Math.abs(dy);
 if(state.view==='walk'){player.yaw-=dx*.0042;player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.0042,-1.28,1.28)}
 else if(state.view==='orbit'){orbit.theta-=dx*.008;orbit.phi=THREE.MathUtils.clamp(orbit.phi-dy*.006,.15,1.44)}
 else{orbit.target.x-=dx*(ortho.right-ortho.left)/viewport.clientWidth;orbit.target.z-=dy*(ortho.top-ortho.bottom)/viewport.clientHeight}
 needsFrame=true
};
canvas.onpointerup=e=>{if(drag?.id===e.pointerId&&drag.total<5)clickScene(e);drag=null};
canvas.onlostpointercapture=()=>drag=null;canvas.onwheel=e=>{if(state.view==='walk')return;e.preventDefault();orbit.span=THREE.MathUtils.clamp(orbit.span*Math.exp(e.deltaY*.0012),2,28);needsFrame=true};
window.addEventListener('keydown',e=>{
 if(state.tab!=='model'||document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();movementKey.add(e.code)}
 if(e.code==='Escape'){selectRecord(null);el('layerMenu').hidden=true;clearMeasure();syncUI()}
});window.addEventListener('keyup',e=>movementKey.delete(e.code));window.addEventListener('blur',()=>movementKey.clear());
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);movementKey.add(b.dataset.key)};b.onlostpointercapture=()=>movementKey.delete(b.dataset.key)});

