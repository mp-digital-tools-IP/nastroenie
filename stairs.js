// Stair study. Longitudinal and transverse coordinates below are mm on sheet 08.
(() => {
  'use strict';
  const options = [
    {id:'none',name:'Без лестницы',summary:'Существующее состояние по описанию владельца. Проём открыт.',dimensions:'Лестница отсутствует',tradeoff:'Для осмотра верхнего этажа выберите точку обзора.',source:'Сообщение владельца; контур открытой зоны по листу 09.'},
    {id:'album',name:'По альбому · 13 подъёмов',summary:'Два забежных поворота. Закрытые светлые деревянные ступени, стекло и подсвеченный поручень.',dimensions:'2870 × 1780 мм · 13 подъёмов · прямые проступи 250 мм',tradeoff:'На виде сбоку указаны подъёмы трёх высот, включая первые два по 250 мм. Лестница требует проверки специалистом по обмеру.',source:'Листы 08, 09. Стр. PDF 71, 86–87 — отделка. Подконструкция, обшивка и ограждения условны.',approach:3,straight:4,rises:[250,250,214,214,214,214,218,218,218,218,218,218,218]},
    {id:'even15',name:'Удлинённая · 15 подъёмов',summary:'Равномерный шаг, открытые дубовые проступи и графитовый каркас. Верхний выход сохраняется.',dimensions:'3120 × 2030 мм · 15 × 192 мм · прямые проступи 250 мм',tradeoff:'Начало на 250 мм дальше в гостиную; внешний край нижнего поворота на 250 мм ближе к прихожей. Часть поворота заходит под плиту модели. Проверить ширину подхода и высоту над обеими сторонами забежных ступеней.',source:'Эскиз для сравнения по ориентации листа 09. Отметка верхнего чистого пола принята 2880 мм.',approach:4,straight:5,rises:Array(15).fill(192)}
  ];
  options.splice(2,0,{...options[1],id:'open13',name:'Открытая · 13 подъёмов',
    summary:'Открытые дубовые ступени на двух графитовых тетивах. Форма, отметки и положение каждой ступени совпадают с альбомным вариантом.',
    tradeoff:'Тот же маршрут и просвет, что у варианта по альбому. Видны просветы между ступенями и металл. При подборе для семьи отдельно согласовать заполнение и ограждение.',
    source:'План и отметки по листу 08. Каркас и открытое исполнение — эскиз для сравнения.'});
  options[3].tradeoff+=' В точке Б на шестой ступени модель даёт всего 1,62 м до плиты. В текущей привязке требуется переработка.';
  const toPlan=([l,c])=>[738-c/(1000*unit),599+(l-2870)/(1000*unit)];
  const toWorld=(p,y)=>{const [x,z]=toPlan(p);return new THREE.Vector3((x-450)*unit,y,(z-550)*unit)};
  const inside=(pt,poly)=>{
    let hit=false;const [x,z]=pt;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const [a,b]=poly[i],[c,d]=poly[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)hit=!hit;
    }
    return hit;
  };
  function makePlan(opt){
    const join=1000+opt.straight*250,end=join+870,span=1030+opt.approach*250;
    const sum=opt.rises.reduce((a,b)=>a+b,0),steps=[];
    let top=0;
    const add=(polygon,center,dir)=>{
      const previous=top;
      top+=upper*opt.rises[steps.length]/sum;
      steps.push({polygon,pts:polygon.map(toPlan),center,dir,top,previous});
    };
    for(let i=0;i<opt.approach;i++){
      const c=span-i*250,start=join-(i<2?200:0);
      add([[start,c],[end,c],[end,c-250],[start,c-250]],[join+435,c-125],[0,-1]);
    }
    const p=[join,1030],q=[1000,1030],deg=Math.PI/180;
    const bottom=a=>[join+435*Math.cos(a*deg),1030-515*Math.sin(a*deg)];
    const topTurn=a=>[1000-500*Math.sin(a*deg),1030-515*Math.cos(a*deg)];
    add([p,[end,1030],[end,470]],bottom(15),[-.259,-.966]);
    add([p,[end,470],[end,0],[end-300,0]],bottom(45),[-.707,-.707]);
    add([p,[end-300,0],[join,0]],bottom(75),[-.966,-.259]);
    for(let i=0;i<opt.straight;i++){
      const l=join-i*250;
      add([[l,1030],[l,0],[l-250,0],[l-250,1030]],[l-125,515],[-1,0]);
    }
    add([q,[1000,0],[480,0]],topTurn(15),[-.966,.259]);
    add([q,[480,0],[0,0],[0,440]],topTurn(45),[-.707,.707]);
    add([q,[0,440],[0,1030]],topTurn(75),[-.259,.966]);
    return {opt,join,end,span,steps,entrance:[join+435,span],exit:[500,1030]};
  }
  const plans=Object.fromEntries(options.slice(1).map(o=>[o.id,makePlan(o)]));
  const material=(color,roughness,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
  const mat={wood:material(0xceae86,.53),side:material(0xbc9974,.63),smoked:material(0x9e7955,.59),
    steel:material(0x3b3d3a,.37,{metalness:.62}),bronze:material(0x78654e,.44,{metalness:.58}),
    glow:material(0xffdfb1,.42,{emissive:0xffcd86,emissiveIntensity:.72}),
    glass:new THREE.MeshPhysicalMaterial({color:0xc6e0d9,transparent:true,opacity:.20,roughness:.12,depthWrite:false,side:THREE.DoubleSide})};
  function mapAsset(name) {
    const path='assets/interior/'+name+'.jpg',t=new THREE.TextureLoader().load(window.ASSETS?.[path]||path);
    t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;
    t.anisotropy=4;return t;
  }
  if(typeof document!=='undefined'){
    const timber=mapAsset('oak');
    for(const [key,color] of [['wood',0xf5e8d3],['side',0xe9d6bd],['smoked',0xbca183]]){
      mat[key].color.setHex(color);mat[key].map=timber;mat[key].bumpMap=timber;mat[key].bumpScale=.007;
    }
    mat.onyx=material(0xfff8ed,.35,{map:mapAsset('onyx'),metalness:.04});
  }
  function prism(g,polygon,y,depth,m,bevel=0){
    const shape=new THREE.Shape();
    polygon.forEach((p,i)=>{const v=toWorld(p,0);shape[i?'lineTo':'moveTo'](v.x,-v.z)});shape.closePath();
    const geom=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,depth-2*bevel),bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1});
    geom.rotateX(-Math.PI/2);geom.translate(0,y+bevel,0);
    if(m.map){
      const axis=toWorld(polygon[1],0).sub(toWorld(polygon[0],0)).normalize();
      const pos=geom.attributes.position,normal=geom.attributes.normal,uv=geom.attributes.uv;
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),z=pos.getZ(i);
        uv.setXY(i,(axis.x*x+axis.z*z)*.8+y*.15,Math.abs(normal.getY(i))>.7?(axis.x*z-axis.z*x)*1.65+y*.73:pos.getY(i)*1.8);
      }
    }
    const mesh=new THREE.Mesh(geom,m);mesh.castShadow=!m.transparent;mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  function beam(g,a,b,w,h,m){
    const dir=b.clone().sub(a),length=dir.length();if(length<.0001)return;
    dir.normalize();const cross=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir);
    if(cross.lengthSq()<.00001)cross.set(1,0,0);else cross.normalize();
    const vertical=new THREE.Vector3().crossVectors(dir,cross);
    const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,length),m);
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(cross,vertical,dir));obj.position.copy(a).lerp(b,.5);
    obj.castShadow=!m.transparent;obj.receiveShadow=true;g.add(obj);return obj;
  }
  function mergeParts(parent){
    const materials=new Map();
    for(const part of parent.children.slice()){
      if(!part.isMesh||part.material.transparent)continue;
      part.updateMatrix();
      const original=part.geometry,g=original.index?original.toNonIndexed():original;
      g.applyMatrix4(part.matrix);
      const buf=materials.get(part.material)||{position:[],normal:[],uv:[]};
      materials.set(part.material,buf);
      for(const key of ['position','normal','uv'])buf[key].push(...g.attributes[key].array);
      parent.remove(part);if(g!==original)g.dispose();original.dispose();
    }
    for(const [material,buf] of materials){
      const geom=new THREE.BufferGeometry();
      for(const key of ['position','normal','uv'])geom.setAttribute(key,new THREE.Float32BufferAttribute(buf[key],key==='uv'?2:3));
      const part=new THREE.Mesh(geom,material);part.castShadow=true;part.receiveShadow=true;parent.add(part);
    }
  }
  function build(plan){
    const group=new THREE.Group(),trim=new THREE.Group(),open=plan.opt.id!=='album',rails=[[],[]];
    group.add(trim);
    for(const [i,t] of plan.steps.entries()){
      const skin=open?.05:.036;
      if(!open){const base=i<3?0:Math.max(0,t.previous-.15);prism(group,t.polygon,base,t.top-base-skin-.002,mat.side)}
      prism(group,t.polygon,t.top-skin,skin,open?mat.smoked:mat.wood,.0015);
      if(open){
        const [l,c]=t.center,[dl,dc]=t.dir;
        for(let j=0;j<2;j++){
          const side=j?235:-235,center=[l-dc*side,c+dl*side],y=Math.max(.075,t.top-.23);
          rails[j].push(toWorld(center,y));
          beam(group,toWorld(center,y),toWorld(center,t.top-skin-.009),.064,.064,mat.steel);
          beam(group,toWorld([center[0]-dc*70,center[1]+dl*70],t.top-skin-.009),toWorld([center[0]+dc*70,center[1]-dl*70],t.top-skin-.009),.10,.018,mat.steel);
        }
      }
    }
    rails.forEach((path,j)=>{
      if(!path.length)return;const s=j?235:-235;
      path.unshift(toWorld([plan.entrance[0]+s,plan.span-25],.045));path.push(toWorld([500-s,1054],upper-.10));
      for(let i=1;i<path.length;i++)beam(group,path[i-1],path[i],.078,.124,mat.steel);
    });
    const line=(g,a,y,b,Y,w,h,m)=>beam(g,toWorld(a,y),toWorld(b,Y),w,h,m);
    // The outer, entrance-facing edge of the lower flight.
    const outer=plan.end-25, first=plan.opt.approach;
    let prev=null;
    for(let i=0;i<=first;i++){
      const t=plan.steps[i],c=i<first?plan.span-125-250*i:1030-185;
      const point=[outer,c],top=t.top+.88;
      if(open||i===0||i===first)line(group,point,t.top,point,top,open?.022:.018,open?.022:.018,open?mat.steel:mat.bronze);
      if(prev){
        line(group,prev.p,prev.h,point,top,.035,.035,open?mat.steel:mat.bronze);
        if(open){
          const mid=[outer,(prev.p[1]+c)/2];line(group,mid,Math.min(prev.t,t.top)+.025,mid,(prev.h+top)/2,.015,.015,mat.steel);
        }else{
          const vertices=[toWorld(prev.p,prev.t+.055),toWorld(point,t.top+.055),toWorld(point,top-.03),toWorld(prev.p,prev.h-.03)];
          const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(v=>[v.x,v.y,v.z]),3));
          geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
          group.add(new THREE.Mesh(geometry,mat.glass));
        }
      }
      prev={p:point,h:top,t:t.top};
    }
    const start=1040,end=2810,c=1051;
    if(open){
      const n=14;
      for(let i=0;i<=n;i++){const p=[start+(end-start)*i/n,c];line(group,p,upper+.035,p,upper+.98,.016,.016,mat.steel)}
      line(group,[start,c],upper+.038,[end,c],upper+.038,.032,.029,mat.steel);
    }else{
      const mid=(start+end)/2;
      for(const [l,L] of [[start,mid-7],[mid+7,end]])prism(group,[[l,c-6],[l,c+6],[L,c+6],[L,c-6]],upper+.05,.91,mat.glass);
      line(group,[start,c],upper+.037,[end,c],upper+.037,.052,.073,mat.bronze);
    }
    line(group,[start,c],upper+.98,[end,c],upper+.98,.045,.041,open?mat.smoked:mat.bronze);
    const i=plan.opt.approach+2,h0=plan.steps[i].top+.88,h1=plan.steps[i+plan.opt.straight].top+.88;
    line(group,[plan.join,81],h0,[1000,81],h1,.048,.05,open?mat.steel:mat.bronze);
    if(!open)line(trim,[plan.join,81],h0-.03,[1000,81],h1-.03,.022,.006,mat.glow);
    for(const t of [.14,.60,.93]){
      const l=plan.join+(1000-plan.join)*t,y=h0+(h1-h0)*t-.04;
      line(group,[l,81],y,[l,8],y,.017,.017,mat.bronze);
    }
    line(group,[42,325],upper+.91,[42,1120],upper+.91,.05,.05,open?mat.steel:mat.bronze);
    if(!open)line(trim,[42,325],upper+.88,[42,1120],upper+.88,.022,.006,mat.glow);
    if(!open&&mat.onyx){
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(.93,2.25),mat.onyx);
      panel.rotation.y=-Math.PI/2;panel.position.copy(toWorld([512,91],upper+1.46));trim.add(panel);
      for(const l of [41,983])line(trim,[l,87],upper+.335,[l,87],upper+2.585,.008,.009,mat.glow);
    }
    mergeParts(trim);mergeParts(group);
    return {group,trim};
  }
  const built={};let active='none';
  for(const opt of options.slice(1)){
    const obj=build(plans[opt.id]);built[opt.id]=obj;
    BIM.add({id:'ST-'+opt.id,name:opt.name,system:'stair',ifcClass:'IfcStair',level:0,stage:'stairs',variant:opt.id,pages:[8,9,13],source:opt.source,
      status:opt.id==='album'?'Геометрия по чертежу':'Эскиз',note:opt.dimensions+'. '+opt.tradeoff,room:'Межэтажная лестница',object:obj.group});
    obj.group.visible=false;
  }
  const study={
    options,get active(){return active},
    select(id){if(!options.some(o=>o.id===id))return;active=id;for(const [key,{group}] of Object.entries(built))group.visible=key===id},
    setFinish(value){for(const {trim} of Object.values(built))trim.visible=Boolean(value)},
    treadAt(x,z){return plans[active]?.steps.find(t=>inside([x,z],t.pts))||null},
    views:[{name:'Нижний подход',x:526,z:573,level:0,yaw:-1.52,pitch:.05},{name:'Выход в холл',x:574,z:424,level:1,yaw:-1.62,pitch:-.42}]
  };
  window.StairStudy=study;
  const slabBottom=upper-.105, millimetres=value=>Math.round(value*1000);
  const slabAt=([x,z])=>floors[1].some(([a,b,c,d])=>x>=a&&x<=c&&z>=b&&z<=d);
  function sample(plan,point){
    const p=toPlan(point),tread=plan.steps.find(t=>inside(p,t.pts));
    return {point,p,tread,number:plan.steps.indexOf(tread)+1,under:slabAt(p),
      clearance:tread&&slabAt(p)?slabBottom-tread.top:null};
  }
  const checks=plan=>{
    const result=[{label:'А',...sample(plan,plan.steps[plan.opt.approach-1].center)}];
    if(plan.opt.id==='even15')result.push({label:'Б',...sample(plan,[2980,330])});
    return result;
  };
  study.probes=id=>plans[id]?checks(plans[id]).map(({label,p,number,clearance})=>({label,x:p[0],z:p[1],number,clearance})): [];
  const colors={paper:'#fffcf7',ink:'#2b3632',green:'#306955',wood:'#e4ca9e',overhead:'#a9c7bc',brick:'#a34131'};
  function drawPlan(canvas,plan){
    const ctx=canvas.getContext('2d'),s=.108,ox=30,oy=28,w=420,h=276;
    canvas.width=w*2;canvas.height=h*2;ctx.scale(2,2);ctx.fillStyle=colors.paper;ctx.fillRect(0,0,w,h);
    const plot=([l,c])=>[ox+l*s,oy+c*s];
    const polygon=points=>{ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...plot(p)));ctx.closePath()};
    const xmax=2870+(596-599)*unit*1000,cmax=(738-659)*unit*1000;
    for(const t of plan.steps){
      polygon(t.polygon);ctx.fillStyle=colors.wood;ctx.fill();ctx.save();ctx.clip();
      ctx.fillStyle=colors.overhead;ctx.fillRect(0,oy+cmax*s,w,h);ctx.fillRect(ox+xmax*s,0,w,h);ctx.restore();
      ctx.strokeStyle='#776a55';ctx.lineWidth=.9;ctx.stroke();
    }
    const line=[plan.entrance,...plan.steps.map(t=>t.center),plan.exit];
    ctx.beginPath();line.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...plot(p)));
    ctx.setLineDash([3,3]);ctx.strokeStyle='#4b5350';ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.setLineDash([5,3]);ctx.strokeStyle=colors.green;ctx.lineWidth=1.5;
    ctx.strokeRect(ox,oy,xmax*s,cmax*s);ctx.setLineDash([]);
    ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillStyle=colors.ink;
    const [ex,ey]=plot(plan.exit),[sx,sy]=plot(plan.entrance);
    ctx.fillText('↓ В холл',ex-19,ey+19);ctx.fillText('Вход ↑',sx-17,sy+17);
    for(const v of checks(plan)){
      const [x,z]=plot(v.point);ctx.beginPath();ctx.arc(x,z,9,0,2*Math.PI);ctx.fillStyle=v.label==='Б'?colors.brick:colors.green;ctx.fill();
      ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(v.label,x,z+4);
    }
    ctx.textAlign='left';ctx.fillStyle=colors.green;ctx.fillText('Пунктирная рамка — проём в модели',ox,14);
    ctx.fillStyle=colors.overhead;ctx.fillRect(ox,h-13,15,8);ctx.fillStyle=colors.ink;ctx.fillText('Под плитой верхнего этажа',ox+21,h-5);
  }
  function walkingProfile(plan) {
    const line=[plan.entrance,...plan.steps.map(t=>t.center),plan.exit],samples=[];
    let accumulated=0;
    for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.ceil(length/6));
      for(let j=0;j<n;j++){
        const k=(j+.5)/n,pt=[a[0]+k*(b[0]-a[0]),a[1]+k*(b[1]-a[1])];
        const v=sample(plan,pt);if(v.tread)samples.push({...v,s:accumulated+k*length});
      }
      accumulated+=length;
    }
    return {samples,length:accumulated};
  }
  function drawSection(canvas,plan){
    const ctx=canvas.getContext('2d'),w=420,h=209;
    canvas.width=w*2;canvas.height=h*2;ctx.scale(2,2);ctx.fillStyle=colors.paper;ctx.fillRect(0,0,w,h);
    const profile=walkingProfile(plan),ox=31,right=401,ground=176,scale=47,at=s=>ox+(right-ox)*s/profile.length,Y=m=>ground-m*scale;
    ctx.font='10px system-ui';ctx.fillStyle='#677169';ctx.strokeStyle='#dbd7cc';ctx.lineWidth=.75;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(ox,Y(i));ctx.lineTo(right,Y(i));ctx.stroke();ctx.fillText(i+' м',5,Y(i)+3)}
    ctx.fillStyle=colors.overhead;
    for(const v of profile.samples)if(v.under)ctx.fillRect(at(v.s)-.4,Y(upper),1.6,Math.max(4,(upper-slabBottom)*scale));
    const first=profile.samples[0],steps=[];
    if(!first)return;
    let prev=first.tread;steps.push([ox,Y(prev.top)]);
    for(const v of profile.samples){
      if(v.tread!==prev){steps.push([at(v.s),Y(prev.top)],[at(v.s),Y(v.tread.top)]);prev=v.tread}
    }
    steps.push([right,Y(prev.top)]);
    ctx.beginPath();ctx.moveTo(ox,ground);for(const [x,y] of steps)ctx.lineTo(x,y);
    ctx.lineTo(right,ground);ctx.closePath();ctx.fillStyle='#efe3cf';ctx.fill();
    ctx.beginPath();ctx.moveTo(ox,ground);for(const [x,y] of steps)ctx.lineTo(x,y);
    ctx.strokeStyle='#746046';ctx.lineWidth=1.6;ctx.stroke();
    const probe=checks(plan)[0];
    let best=first;for(const v of profile.samples)if(Math.hypot(v.p[0]-probe.p[0],v.p[1]-probe.p[1])<Math.hypot(best.p[0]-probe.p[0],best.p[1]-probe.p[1]))best=v;
    const x=at(best.s),bottom=Y(probe.tread.top),top=Y(slabBottom);
    ctx.strokeStyle=colors.green;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);
    ctx.moveTo(x-4,top);ctx.lineTo(x+4,top);ctx.moveTo(x-4,bottom);ctx.lineTo(x+4,bottom);ctx.stroke();
    ctx.fillStyle=colors.green;ctx.font='bold 12px system-ui';ctx.fillText('А · '+millimetres(probe.clearance)+' мм',x+6,(top+bottom)/2-3);
    ctx.font='10px system-ui';ctx.fillStyle=colors.ink;ctx.fillText('Низ плиты в модели +2775 мм',ox,16);ctx.fillText('Начало подъёма',ox,194);ctx.textAlign='right';ctx.fillText('Выход в холл',right,194);ctx.textAlign='left';
  }
  const comparisonStyle=`
  #staircompare{box-sizing:border-box;color:#24342c;background:#f6f4ed;padding:0;border:1px solid #b7beb2;border-radius:16px;width:min(1000px,95vw);max-width:95vw;max-height:90vh;margin:auto;box-shadow:0 15px 62px #19261d40;text-align:left;overflow:auto;font:14px/1.45 system-ui,sans-serif}
  #staircompare::backdrop{background:#20251fa6}#staircompare *{box-sizing:border-box}#staircompare .st-top{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;background:#f6f4edf8;border-bottom:1px solid #d0d4c9;padding:14px 20px}
  #staircompare h2{font:normal 26px/1.12 Georgia,serif;margin:0;color:inherit}#staircompare h3{font:bold 18px/1.2 system-ui;margin:0 0 7px;color:inherit}#staircompare h4{font:bold 15px/1.35 system-ui;margin:10px 0 3px;color:inherit}
  #staircompare .st-close{border:1px solid #a3afa4;background:#fffdf7;color:#2b3730;padding:7px 13px;cursor:pointer;border-radius:7px}
  #staircompare .st-body{padding:12px 20px 20px}#staircompare p{margin:6px 0 10px;color:inherit;font:inherit}#staircompare .st-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  #staircompare article{min-width:0;border:1px solid #d7d8c9;background:#fffcf7;border-radius:10px;padding:12px}
  #staircompare canvas{display:block;width:100%;height:auto}#staircompare .st-warning{color:#873e2d}#staircompare .st-check{display:block;padding:12px 14px;background:#e8eee5;border-radius:8px;margin-top:12px}
  @media(max-width:720px){#staircompare .st-cols{grid-template-columns:1fr}#staircompare .st-body{padding:10px}#staircompare h2{font-size:21px}}
  `;
  function openComparison(){
    let d=document.querySelector('#staircompare');
    if(!d){
      const style=document.createElement('style');style.textContent=comparisonStyle;document.head.append(style);
      d=document.createElement('dialog');d.id='staircompare';d.setAttribute('aria-labelledby','st-compare-title');
      d.innerHTML='<div class="st-top"><h2 id="st-compare-title">Посадка лестницы в проём</h2><button type="button" class="st-close">Закрыть</button></div>'+
        '<div class="st-body"><p>Верхний выход расположен в одной точке. Компактная лестница с закрытыми и открытыми ступенями имеет одинаковую геометрию. На схемах нанесены контрольные точки для обмера.</p><div class="st-cols"></div>'+
        '<div class="st-check"><b>Что измерить до выбора</b><p>Привяжите все четыре стороны выреза к постоянным стенам. Для обеих осей запишите смещение верхней кромки относительно нижней, толщину плиты и выступающих элементов, отметки существующих и будущих чистовых полов. Нужен разрез по линии шага и по краям забежных ступеней. Проверьте подход от входной двери и проход мимо ТВ-зоны.</p>'+
        '<p>Лист 13 содержит вырез 1060 × 1990 мм. Открытая зона на листе 09 интерпретирована в туре как примерно 1030 × 2870 мм. Как эти контуры совмещены на объекте, устанавливается обмером и чертежами выполненного перекрытия.</p>'+
        '<p>Модель использует отметку чистового пола +2880 мм и условную толщину перекрытия 105 мм. В листах 04–05 отдельно указаны 2780 мм до перекрытия. Две точечные вертикали не описывают свободный проход по всей ширине марша. Решение о посадке, опорах, ограждении и нагрузках принимает проектировщик по фактическим данным.</p></div></div>';
      const cols=d.querySelector('.st-cols');
      for(const id of ['album','even15']){
        const plan=plans[id],card=document.createElement('article'),check=checks(plan);
        const hdr=id==='album'?'13 подъёмов · компактная':'15 подъёмов · удлинённая';
        card.innerHTML='<h3>'+hdr+'</h3><p>'+plan.opt.dimensions+'</p><canvas aria-label="План лестницы с контуром проёма"></canvas><h4>Развёртка по линии движения</h4><canvas aria-label="Схема высоты под плитой"></canvas>'+
          '<p><b>А · '+millimetres(check[0].clearance)+' мм.</b> Вертикаль от середины последней прямой ступени перед первым поворотом до плоскости низа плиты.</p>';
        if(id==='album')card.innerHTML+='<p>На листе 08 два подъёма по 250 мм, четыре по 214 мм и семь по 218 мм. Сумма 2882 мм. Для совмещения с уровнем +2880 мм в модели все высоты пропорционально пересчитаны. Первые две ступени имеют ширину 1070 мм, третья — 870 мм.</p>';
        else card.innerHTML+='<p class="st-warning"><b>Б · '+millimetres(check[1].clearance)+' мм.</b> На внешней части шестой забежной ступени просвет уменьшается. Точка отстоит на 140 мм от внешнего торца удлинённой лестницы и на 330 мм от длинной наружной стороны. Этот вариант в текущей привязке следует отложить до переработки.</p>';
        cols.append(card);const canvases=card.querySelectorAll('canvas');drawPlan(canvases[0],plan);drawSection(canvases[1],plan);
      }
      d.querySelector('.st-close').addEventListener('click',()=>d.close());
      d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}});
      document.body.append(d);
    }
    if(!d.open)d.showModal();
  }
  study.showComparison=openComparison;
})();
