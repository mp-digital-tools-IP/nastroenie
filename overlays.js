// The line overlay keeps the engineering plan legible at normal monitor scale.
// It uses the same walls and camera transform as the walk, including panning.
(()=>{
 const ink=el('planInk'),ctx=ink.getContext('2d'),legend=el('planLegend');
 const traceImages=new Map();
 const centres=[
 [[5,506,255],[4,292,722],[0,713,704],[2,570,778],[3,695,244],[1,711,826]],
 [[6,515,467],[7,697,787],[8,560,768],[9,325,711],[10,415,925],[11,244,934],[12,276,504],[13,508,235]]
 ];
 const abbreviations={'Гардеробная у входа':'Гардеробная','Гардеробная спальни':'Гардеробная','Мастер-спальня':'Спальня','Детская спальня':'Детская'};
 function legendEntries(){
  const rows=[];
  if(state.systems.has('water'))rows.push(['#317eeb','ХВС'],['#ed6c64','ГВС']);
  if(state.systems.has('drain'))rows.push(['#23967b','Слив']);
  if(state.systems.has('electrical'))rows.push(['#bc873f','Электроточки и свет']);
  if(state.systems.has('climate'))rows.push(['#ce7958','Отопление']);
  if(state.systems.has('waterproof'))rows.push(['#4e9e9c','Гидроизоляция']);
  return rows
 }
 function label(x,y,text,size){
  ctx.font='600 '+size+'px "Segoe UI", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeStyle='#f8f8efde';ctx.lineWidth=3.7;ctx.strokeText(text,x,y);ctx.fillStyle='#465247';ctx.fillText(text,x,y)
 }
 window.drawPlanInk=()=>{
  const on=state.view==='plan';ink.hidden=!on;legend.hidden=!on;
  if(!on)return;
  const w=viewport.clientWidth,h=viewport.clientHeight,dpr=Math.min(2,devicePixelRatio);
  if(ink.width!==Math.round(w*dpr)||ink.height!==Math.round(h*dpr)){ink.width=Math.round(w*dpr);ink.height=Math.round(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const px=(x,z)=>{const v=new THREE.Vector3((x-450)*unit,state.floor*upper,(z-550)*unit).project(ortho);return[(v.x+1)*w/2,(1-v.y)*h/2]};
  for(const wall of bounds){
   if(wall.f!==state.floor||wall.g>1||!state.systems.has(wall.g?'partition':'structure'))continue;
   const [a,b]=px(wall.a,wall.b),[c,d]=px(wall.c,wall.d);
   ctx.fillStyle=wall.g?'#69736a9c':'#4b584cb9';ctx.fillRect(a,b,Math.max(c-a,1),Math.max(d-b,1))
  }
  if(state.trace){
   const stage=phase().id;const page=(stage==='plumbing'?23:stage==='electric'?40:stage==='climate'?30:8)+state.floor;
   const engineeringSheet=page>9,key='assets/overlays/'+String(page).padStart(2,'0')+'.webp';
   if(!traceImages.has(key)){const im=new Image();traceImages.set(key,im);im.onload=()=>{needsFrame=true};im.src=window.ASSETS[key]}
   const im=traceImages.get(key);
   if(im.complete&&im.naturalWidth){
    let a=115,b=100,c=800,d=1020;
    if(engineeringSheet){const k=334/380;a=156+(177-218)*k;c=156+(947-218)*k;b=990+(116-1137)*k;d=990+(1169-1137)*k}
    const [tx,tz]=px(a,b),[ex,ez]=px(c,d);
    ctx.globalAlpha=.70;ctx.drawImage(im,tx,tz,ex-tx,ez-tz);ctx.globalAlpha=1
   }
  }
  const showMinor=orbit.span<9.5;
  if(!state.trace&&orbit.span>3.0)for(const [id,x,z] of centres[state.floor]){
   const r=roomTable[id];if(!showMinor&&r[2]<5.4)continue;
   const [a,b]=px(x,z);label(a,b,abbreviations[r[0]]||r[0],showMinor?11:10)
  }
  const metre=w/(ortho.right-ortho.left),length=metre<24?2:1,scale=length*metre;
  ctx.strokeStyle='#384c3e';ctx.lineWidth=1.5;const tx=w-56-scale,ty=h-22;
  ctx.beginPath();ctx.moveTo(tx,ty-4);ctx.lineTo(tx,ty);ctx.lineTo(tx+scale,ty);ctx.lineTo(tx+scale,ty-4);ctx.stroke();label(tx+scale/2,ty-10,length+' м',10);
  legend.replaceChildren();for(const [c,t] of legendEntries()){
   const span=document.createElement('span'),dot=document.createElement('i');dot.className='legendDot';dot.style.background=c;span.append(dot,document.createTextNode(t));legend.append(span)
  }legend.hidden=!legend.childElementCount;
 }
})();
// Panorama viewing uses a perspective camera inside the physical renderer's
// equirectangular image. Only the viewpoint changes when returning to the walk.
(()=>{
 let r,sc,cam,mesh,texture,key,az=0,tilt=0,fov=68,drag=null,ticket=0;
 const target=el('panoCanvas');
 function paint(){
  if(!r||target.hidden||!target.clientWidth)return;
  const w=target.clientWidth,h=target.clientHeight;r.setSize(w,h,false);cam.aspect=w/h;cam.fov=fov;cam.updateProjectionMatrix();
  cam.rotation.order='YXZ';cam.rotation.set(tilt,az,0);r.render(sc,cam);window.lastPanoLook={yaw:az,pitch:tilt}
 }
 function init(){
  r=new THREE.WebGLRenderer({antialias:true});r.setPixelRatio(Math.min(1.6,devicePixelRatio));r.outputColorSpace=THREE.SRGBColorSpace;target.append(r.domElement);
  sc=new THREE.Scene();cam=new THREE.PerspectiveCamera(68,1,.01,30);
  const geo=new THREE.SphereGeometry(10,80,44);geo.scale(-1,1,1);
  // equirectangular image centre is rendered down the original optical axis.
  geo.rotateY(-Math.PI/2);
  mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({toneMapped:false}));sc.add(mesh);
  target.onpointerdown=e=>{target.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY]};
  target.onpointermove=e=>{if(!drag)return;az-=(e.clientX-drag[0])*.0038;tilt=THREE.MathUtils.clamp(tilt-(e.clientY-drag[1])*.0038,-1.47,1.47);drag=[e.clientX,e.clientY];paint()};
  target.onlostpointercapture=()=>drag=null;target.onwheel=e=>{e.preventDefault();fov=THREE.MathUtils.clamp(fov+e.deltaY*.035,37,91);paint()};
  new ResizeObserver(paint).observe(target)
 }
 window.showPanorama=p=>{
  if(!r)init();
  if(key===p.id){paint();return}
  key=p.id;az=0;tilt=p.pitch??-.042;fov=68;window.lastPanoLook={yaw:0,pitch:tilt};
  const relative='assets/renders/'+p.id+'-360.jpg',generation=++ticket;
  new THREE.TextureLoader().load(window.ASSETS[relative]||relative,t=>{
   if(generation!==ticket){t.dispose();return}
   texture?.dispose();texture=t;t.colorSpace=THREE.SRGBColorSpace;mesh.material.map=t;mesh.material.needsUpdate=true;paint()
  })
 }
})();
