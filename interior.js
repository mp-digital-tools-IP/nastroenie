// Fit-out model for the Nastryenie apartment. Input coordinates on furniture sheets
// 14 and 15 are expressed at a rendered page width of 1200 px. BIM objects are
// registered separately from the visual meshes batched within each assembly.
(() => {
  'use strict';
  const T = THREE;
  const root = 'assets/interior/';
  const toModel = (x, z) => [156 + (x - 132) * 334 / 227, 990 + (z - 681) * 334 / 227];
  const stationScale = unit * 334 / 227;
  const levelHeight = [upper - .105, height - upper];
  const textureLoader = new T.TextureLoader();
  const textures = {};
  const materialsLocal = new Map();
  let seed = 93726;
  function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
  function map(name) {
    if (textures[name]) return textures[name];
    const path = root + name + '.jpg';
    const image = textureLoader.load(window.ASSETS?.[path] || path);
    image.colorSpace = T.SRGBColorSpace;
    image.wrapS = image.wrapT = T.RepeatWrapping;
    image.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures[name] = image;
    return image;
  }
  const specifications = {
    lacquer:[0xe3ddd2,.44,0], ink:[0x272623,.38,.32], bronze:[0x92704f,.31,.78],
    brass:[0xbba780,.32,.79], chrome:[0xb4b5b4,.18,.9], porcelain:[0xf2eee4,.23,.01],
    paint:[0xe3ddd2,.84,0], shadowGap:[0x413a33,.94,0], white:[0xf7f1e4,.62,0],
    oak:[0xf3e5ce,.61,0,'oak',.88,.018], walnut:[0x9c856a,.49,0,'oak',.88,.012],
    darkOak:[0x706556,.55,0,'oak',.88,.012],
    splash:[0xffffff,.41,.035,'splash',.38,.006], marble:[0xffffff,.38,.04,'emperador',.44,.009], ivory:[0xffffff,.34,.04,'ivory',.55,.018],
    cliff:[0xfff9e7,.92,0,'cliff',.82,.052], greige:[0xfffaf1,.91,0,'greige',.72,.025],
    graphite:[0xd1c6b9,.78,.06,'slate',.88,.027], onyx:[0xffffff,.27,.07,'onyx',.59,.015],
    beige:[0xc3b5a2,.94,0,'weave',7.4,.006], ivoryFabric:[0xddd3c1,.96,0,'weave',7.6,.006],
    taupe:[0x988976,.92,0,'weave',7.8,.006], charcoal:[0x625b52,.95,0,'weave',8,.005],
    duvet:[0xb5a693,.98,0,'weave',6.2,.005], rug:[0xe8ded4,.99,0,'rug',.54,.016],
    soil:[0x37382b,1,0], blackGlass:[0x222420,.13,.38],
    mirror:[0xdeeff2,.075,.98], smoked:[0x494641,.19,.60],
    lamp:[0xfff3cf,.23,0], strip:[0xffe2b6,.18,0], trim:[0xbab2a1,.34,.54]
  };
  function mat(name) {
    if (typeof name !== 'string') return name;
    if (materialsLocal.has(name)) return materialsLocal.get(name);
    const [color, roughness, metalness, image, frequency, relief] = specifications[name];
    const m = new T.MeshStandardMaterial({color,roughness,metalness});
    if (image) {
      m.map = map(image); m.bumpMap = m.map; m.bumpScale = relief;
      m.userData.frequency = frequency;
    }
    if (name === 'strip' || name === 'lamp') { m.emissive.set(color); m.emissiveIntensity = name === 'strip'?1.25:.9; }
    m.envMapIntensity = name === 'mirror'?1.2:.65;
    materialsLocal.set(name,m);
    return m;
  }
  function equirectEnvironment() {
    if (scene.environment || !renderer.getContext) return;
    // A small photographic-studio lighting environment gives polished surfaces
    // a broad window and narrow highlights. It never enters the visible background.
    const w=256,h=128,data=new Uint16Array(w*h*4),half=T.DataUtils.toHalfFloat;
    for(let j=0;j<h;j++) for(let i=0;i<w;i++){
      const u=i/w,v=j/h;
      const pane=(u>.045&&u<.19&&v>.32&&v<.68) || (u>.52&&u<.60&&v>.36&&v<.74);
      const rail=(v>.73&&v<.76&&u>.25&&u<.63);
      const scalar=pane?2.7:rail?2.05:.075+.22*Math.max(0,v);
      const k=(j*w+i)*4;
      data[k]=half(scalar*(pane?.95:1.07));data[k+1]=half(scalar);
      data[k+2]=half(scalar*(pane?1.07:.86));data[k+3]=half(1);
    }
    const src = new T.DataTexture(data,w,h,T.RGBAFormat,T.HalfFloatType);
    src.mapping=T.EquirectangularReflectionMapping;src.needsUpdate=true;
    const generator=new T.PMREMGenerator(renderer);
    const rt=generator.fromEquirectangular(src);scene.environment=rt.texture;
    src.dispose();generator.dispose();
  }
  equirectEnvironment();
  function object(parent,geo,material,x=0,y=0,z=0) {
    const mesh=new T.Mesh(geo,mat(material));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  const boxes=new Map();
  function rounded(w,h,d,r) {
    r=Math.min(r,.495*Math.min(w,h,d));
    const key=[w,h,d,r].map(n=>n.toFixed(4)).join(':');
    if (boxes.has(key)) return boxes.get(key);
    // Subdivide within the fillet rather than the face. Wide seat cushions keep
    // both a full flat seating surface and a round edge.
    let geo;
    if (!r) geo=new T.BoxGeometry(w,h,d);
    else {
      const K=3, vertex=[],norm=[],uv=[],idx=[];
      function knots(size) {
        const a=[];
        for(let i=0;i<=K;i++) a.push(-size/2+r*i/K);
        for(let i=0;i<=K;i++) a.push(size/2-r+r*i/K);
        return a;
      }
      const dim=[w,h,d],core=dim.map(s=>s/2-r);
      const v=new T.Vector3(), nearest=new T.Vector3(),normal=new T.Vector3();
      for (const [a,b,c,sgn] of [[0,1,2,1],[0,1,2,-1],[1,2,0,1],[1,2,0,-1],[2,0,1,1],[2,0,1,-1]]){
        const xs=knots(dim[a]),ys=knots(dim[b]),origin=vertex.length/3;
        for(const yy of ys)for(const xx of xs){
          v.setComponent(a,xx);v.setComponent(b,yy);v.setComponent(c,sgn*dim[c]/2);
          nearest.set(T.MathUtils.clamp(v.x,-core[0],core[0]),T.MathUtils.clamp(v.y,-core[1],core[1]),T.MathUtils.clamp(v.z,-core[2],core[2]));
          normal.copy(v).sub(nearest).normalize();v.copy(nearest).addScaledVector(normal,r);
          vertex.push(v.x,v.y,v.z);norm.push(normal.x,normal.y,normal.z);
          uv.push(xx,yy);
        }
        for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
          const a0=origin+j*xs.length+i,b0=a0+1,c0=b0+xs.length,d0=a0+xs.length;
          if(sgn>0)idx.push(a0,b0,d0,b0,c0,d0);else idx.push(a0,d0,b0,b0,d0,c0);
        }
      }
      geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertex,3));
      geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);
    }
    boxes.set(key,geo);return geo;
  }
  function boxAt(p,x,y,z,w,h,d,m,r=0){return object(p,rounded(w,h,d,r),m,x,y,z)}
  function cylinder(p,x,y,z,rt,rb,h,m,sides=24){
    return object(p,new T.CylinderGeometry(rt,rb,h,sides,1,false),m,x,y,z);
  }
  function ball(p,x,y,z,rx,ry,rz,m){
    const v=object(p,new T.SphereGeometry(1,20,12),m,x,y,z);v.scale.set(rx,ry,rz);return v;
  }
  function bar(p,a,b,r,m,rb=r){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
    const o=cylinder(p,0,0,0,r,rb,delta.length(),m,10);
    o.position.copy(start).lerp(end,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;
  }
  function arc(p,points,r,m,detail=24){
    const curve=new T.CatmullRomCurve3(points.map(a=>new T.Vector3(...a)));
    return object(p,new T.TubeGeometry(curve,detail,r,8,false),m);
  }
  function vessel(p,x,y,z,profile,m){
    return object(p,new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),36),m,x,y,z)
  }
  function nested(p,x,y,z,rot=0){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=rot;p.add(g);return g}
  function item(id,name,room,f,px,pz,rot,source,note,stage='interior'){
    const g=new T.Group();g.position.set((px-450)*unit,f*upper+.021,(pz-550)*unit);g.rotation.y=rot;
    g.userData.record={id:'fit-'+id,name,room,level:f,source,status:'Интерпретация',note,stage,system:stage==='interior'?'interior':'finishes'};
    assembled.push(g);return g;
  }
  function at(id,name,room,f,x,z,rot,source,note,stage){
    const [px,pz]=toModel(x,z);return item(id,name,room,f,px,pz,rot,source,note,stage);
  }
  const assembled=[],obstacles=[];
  function obstacle(p,w,d){
    const x=p.position.x/unit+450,z=p.position.z/unit+550,q=p.rotation.y;
    const W=(Math.abs(Math.cos(q))*w+Math.abs(Math.sin(q))*d)/unit/2;
    const D=(Math.abs(Math.cos(q))*d+Math.abs(Math.sin(q))*w)/unit/2;
    obstacles.push({a:x-W,b:z-D,c:x+W,d:z+D,f:p.userData.record.level,g:2,id:p.userData.record.id});
  }
  // Use one contact decal per object, with enough falloff for irregular upholstery.
  const shadeCanvas=document.createElement('canvas');shadeCanvas.width=shadeCanvas.height=128;
  const ctx=shadeCanvas.getContext('2d'),grad=ctx.createRadialGradient(64,64,10,64,64,63);
  grad.addColorStop(0,'rgba(38,30,25,0.46)');grad.addColorStop(.6,'rgba(38,30,25,0.27)');grad.addColorStop(1,'rgba(38,30,25,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const shadowMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(shadeCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  function shadow(p,w,d,x=0,z=0){
    const v=object(p,new T.PlaneGeometry(w,d),shadowMat,x,.003,z);v.rotation.x=-Math.PI/2;v.renderOrder=2;
  }
  const glowCanvas=document.createElement('canvas');glowCanvas.width=1;glowCanvas.height=128;
  const gc=glowCanvas.getContext('2d'),gg=gc.createLinearGradient(0,0,0,128);
  gg.addColorStop(0,'rgba(255,217,162,.54)');gg.addColorStop(.16,'rgba(255,214,155,.26)');gg.addColorStop(.55,'rgba(255,213,154,.08)');gg.addColorStop(1,'rgba(255,213,154,0)');
  gc.fillStyle=gg;gc.fillRect(0,0,1,128);
  const glowTex=new T.CanvasTexture(glowCanvas);
  const glow=new T.MeshBasicMaterial({map:glowTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
  function wash(p,x,y,z,w,h){object(p,new T.PlaneGeometry(w,h),glow,x,y-h/2,z)}
  function uvInMetres(geom,freq,anchor){
    const pos=geom.attributes.position,n=geom.attributes.normal,uv=geom.attributes.uv;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i)+anchor.x,y=pos.getY(i)+anchor.y,z=pos.getZ(i)+anchor.z;
      let u=x,v=y;
      if(Math.abs(n.getY(i))>.65){u=x;v=z}
      else if(Math.abs(n.getX(i))>.68){u=z;v=y}
      uv.setXY(i,u*freq,v*freq);
    }
  }
  // Static geometry is merged per material per BIM record, preserving room-level picking.
  function register(p){
    p.updateMatrixWorld(true);
    const inverse=p.matrixWorld.clone().invert(),bins=new Map();
    p.traverse(m=>{
      if(!m.isMesh)return;
      const geom=m.geometry.clone(),material=m.material,local=new T.Matrix4().multiplyMatrices(inverse,m.matrixWorld);
      geom.applyMatrix4(local);
      if(material.userData.frequency&&!m.userData.keepUV)uvInMetres(geom,material.userData.frequency,p.position);
      if(!geom.attributes.uv)geom.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geom.attributes.position.count*2),2));
      const k=material.uuid+(m.renderOrder||0);
      if(!bins.has(k))bins.set(k,{mat:material,order:m.renderOrder||0,pos:[],norm:[],uv:[],idx:[]});
      const dst=bins.get(k),start=dst.pos.length/3;
      for(const [out,att] of [[dst.pos,'position'],[dst.norm,'normal'],[dst.uv,'uv']]){
        const arr=geom.getAttribute(att).array;for(let i=0;i<arr.length;i++)out.push(arr[i]);
      }
      if(geom.index)for(let i=0;i<geom.index.count;i++)dst.idx.push(start+geom.index.getX(i));
      else for(let i=0;i<geom.attributes.position.count;i++)dst.idx.push(start+i);
      geom.dispose();
    });
    p.clear();
    for(const b of bins.values()){
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.norm,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.setIndex(b.idx);g.computeBoundingSphere();
      const mesh=new T.Mesh(g,b.mat);mesh.renderOrder=b.order;if(b.mat.isMeshBasicMaterial&&b.mat.transparent)mesh.userData.noPhysicalRender=true;mesh.receiveShadow=true;mesh.castShadow=!b.mat.transparent&&p.userData.record.stage==='interior';p.add(mesh);
    }
        const record=p.userData.record;
    const pages=record.source.startsWith('Планы полов')?[27,28]:[...new Set((record.source.split('·')[0].match(/[0-9]+/g)||[]).map(Number))].filter(n=>n>=1&&n<=118);
    const ifcClass=record.id.startsWith('fit-ceiling')?'IfcLightFixture':record.stage==='finishes'?'IfcCovering':
      /fit-(vanity|wc-|bathtub)/.test(record.id)?'IfcSanitaryTerminal':'IfcFurniture';
    BIM.add({...record,pages,ifcClass,object:p});
  }
  function deskFeet(p,w,d,h){
    for(const a of [-1,1])for(const b of [-1,1]){
      bar(p,[a*(w/2-.085),h-.04,b*(d/2-.11)],[a*(w/2-.045),.012,b*(d/2-.035)],.025,'walnut',.016);
    }
  }
  function chair(p,seat=.45,fabric='taupe',wide=.54){
    shadow(p,wide+.18,.66);
    const W=wide/2;
    for(const xx of [-1,1])for(const zz of [-1,1])
      bar(p,[xx*(W-.075),seat-.045,zz*.135],[xx*(W-.035),.012,zz*.215],.018,'darkOak',.012);
    // The dining chair in sheet 63 has an upholstered wraparound horseshoe back.
    boxAt(p,0,seat,0,wide-.06,.115,.45,fabric,.052);
    const path=[];
    for(let i=0;i<=22;i++){
      const a=-1.31+i*2.62/22;
      path.push(new T.Vector3(Math.sin(a)*(W-.018),seat+.20+.07*Math.cos(a),Math.cos(a)*.225-.006));
    }
    const vs=[],indices=[],uv=[];
    for(let i=0;i<path.length;i++){
      const a=-1.31+i*2.62/22,cr=path[i];
      for(let j=0;j<=10;j++){
        const b=j/10*Math.PI*2;
        const thick=.037+.009*Math.cos(a);
        vs.push(cr.x+Math.sin(a)*Math.cos(b)*thick,cr.y+Math.sin(b)*(.078+.035*Math.cos(a)),cr.z+Math.cos(a)*Math.cos(b)*thick);
        uv.push(i/22,j/10);
        if(i<22&&j<10){const t=i*11+j;indices.push(t,t+1,t+11,t+1,t+12,t+11)}
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vs,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const back=object(p,geo,fabric);back.material.side=T.DoubleSide;
    for(const a of [-1,1])bar(p,[a*(W-.065),seat-.025,.15],[a*(W-.045),seat+.25,.16],.014,'walnut');
    if(seat>.58)for(const a of [-1,1])bar(p,[-(W-.045),.24,a*.18],[W-.045,.24,a*.18],.008,'chrome');
  }
  function cup(p,x,z,y){
    vessel(p,x,y,z,[[.0001,.002],[.041,.003],[.048,.066],[.045,.069],[.039,.065],[.035,.006],[.001,.006]],'porcelain');
    arc(p,[[x+.042,y+.052,z],[x+.075,y+.050,z],[x+.076,y+.026,z],[x+.046,y+.018,z]],.005,'porcelain',12);
  }
  function books(p,x,y,z,count,flat=false){
    for(let i=0;i<count;i++){
      const H=.145+random()*.11,D=.13+random()*.07,W=.021+random()*.018;
      const color=['darkOak','taupe','white','walnut','graphite'][i%5];
      const b=nested(p,x,y,z);
      if(flat){b.rotation.z=Math.PI/2;b.position.x=x+H/2;b.position.y=y+W/2;y+=W}
      else x+=W+.005;
      boxAt(b,0,H/2,0,W*.82,H-.006,D-.008,'white');
      boxAt(b,0,H/2,D/2,W,H,.009,color);
      boxAt(b,-W/2,H/2,0,.004,H,D,color);
      boxAt(b,0,H*.7,D/2+.006,W*.5,.002,.001,'brass');
    }
  }
  function pottery(p,x,y,z,s=1,kind='greige'){
    const v=nested(p,x,y,z);v.scale.setScalar(s);
    vessel(v,0,0,0,[[.001,0],[.069,0],[.108,.027],[.133,.095],[.13,.14],[.106,.18],[.062,.22],[.05,.25],[.048,.278],[.04,.278],[.035,.249]],kind);
  }
  function fruitBowl(p,x,y,z){
    vessel(p,x,y,z,[[.001,.001],[.082,.002],[.17,.018],[.178,.024],[.176,.031],[.161,.027],[.077,.014],[.002,.009]],'bronze');
    const red=new T.MeshStandardMaterial({color:0x8c3022,roughness:.39}),gold=new T.MeshStandardMaterial({color:0x91943e,roughness:.46});
    for(let i=0;i<5;i++){const a=i*2.35;const xx=x+Math.sin(a)*.079,zz=z+Math.cos(a)*.073;
      ball(p,xx,y+.072+(i===4?.046:0),zz,.052,.046,.05,i%3?red:gold);
      bar(p,[xx,y+.108+(i===4?.046:0),zz],[xx+.008,y+.130+(i===4?.046:0),zz-.002],.0022,'darkOak');}
  }
  function counter(p,w,h,d,n,face='lacquer') {
    boxAt(p,0,.051,0,w-.09,.102,d-.07,'shadowGap');
    boxAt(p,0,(h+.10)/2,0,w,h-.10,d,'shadowGap',.003);
    for(let i=0;i<n;i++)boxAt(p,-w/2+(i+.5)*w/n,(h+.12)/2,-d/2-.006,w/n-.006,h-.126,.025,face,.002);
  }
  function screen(p,x,y,z,w,h) {
    boxAt(p,x,y,z,w,h,.044,'ink',.015);boxAt(p,x,y,z+.027,w-.016,h-.016,.008,'blackGlass',.004);
  }
  function faucet(p,x,y,z) {
    cylinder(p,x,y+.017,z,.032,.032,.033,'ink');
    arc(p,[[x,y+.02,z],[x,y+.16,z],[x,y+.315,z+.01],[x,y+.334,z+.092],[x,y+.322,z+.192],[x,y+.269,z+.204]],.011,'ink');
    const lever=boxAt(p,x+.037,y+.097,z,.011,.093,.011,'ink',.004);lever.rotation.z=-.23;
  }
  function basin(p,x,y,z,w,d,h,m) {
    // Horizontal ceramic rim and sloping internal faces form an actual open bowl.
    const thick=.044, side=.012;
    boxAt(p,x-w/2+thick/2,y,z,thick,side,d,m,.004);
    boxAt(p,x+w/2-thick/2,y,z,thick,side,d,m,.004);
    boxAt(p,x,y,z-d/2+thick/2,w-2*thick,side,thick,m,.003);
    boxAt(p,x,y,z+d/2-thick/2,w-2*thick,side,thick,m,.003);
    const verts=[],ind=[],coordinates=[];
    for(const [ww,dd,dy] of [[w-2*thick,d-2*thick,0],[w-2*thick-.014,d-2*thick-.014,-.022],[w-2*thick-.08,d-2*thick-.08,-h+.026],[w-2*thick-.13,d-2*thick-.13,-h]]){
      for(const [ax,az] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
        verts.push(x+ax*ww/2,y+dy,z+az*dd/2);coordinates.push(ax*.5+.5,az*.5+.5);
      }
    }
    for(let j=0;j<3;j++)for(let i=0;i<4;i++){const a=j*4+i,b=j*4+(i+1)%4;ind.push(a,b,a+4,b,b+4,a+4)}
    ind.push(12,14,13,12,15,14);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(coordinates,2));g.setIndex(ind);g.computeVertexNormals();
    const o=object(p,g,m);o.material.side=T.DoubleSide;cylinder(p,x,y-h+.005,z,.018,.018,.006,'chrome');
  }
  const kitchenSource='Стр. PDF 14, 55–63 · вариант 1', livingSource='Стр. PDF 14, 64–74';
  const upperSource='Стр. PDF 16, 94–101',childSource='Стр. PDF 16, 112–118';
  {
    const p=at('kitchen-counter','Кухонный гарнитур и мойка','Кухня-столовая',0,245,660,0,kitchenSource,'Фасады, подсветка и тёмный каменный фартук переданы по визуализации. Размеры секций и вырез согласовать с изготовителем.');
    counter(p,4.07,.862,.586,7);
    const x=-1.22,W=4.09,D=.62,w=.53,d=.42,y=.875;
    boxAt(p,(-W/2+x-w/2)/2,y,0,W/2+x-w/2,.027,D,'marble',.006);
    boxAt(p,(W/2+x+w/2)/2,y,0,W/2-x-w/2,.027,D,'marble',.006);
    for(const sign of [-1,1])boxAt(p,x,y,sign*(D+d)/4,w,.027,(D-d)/2,'marble');
    basin(p,x,y+.014,0,w,d,.155,'chrome');faucet(p,x,y+.014,D/2-.058);
    const apron=boxAt(p,0,1.196,.303,W,.616,.028,'splash');apron.userData.keepUV=true;
    for(let i=0;i<7;i++){const xx=-W/2+(i+.5)*W/7;
      boxAt(p,xx,1.96,.115,W/7-.007,.87,.39,'lacquer',.003);}
    boxAt(p,0,1.514,-.056,W,.014,.012,'strip');
    const splash=nested(p,0,0,.279,Math.PI);wash(splash,0,1.51,.011,W,.53);
    for(let i=0;i<3;i++)vessel(p,1.25+i*.142,.893,.14,[[.003,0],[.043,0],[.045,.109],[.048,.119],[.044,.124],[.033,.12]],'ink');
    cup(p,-.62,.025,.893);obstacle(p,W,D);
  }
  {
    const p=at('kitchen-columns','Пеналы с техникой','Кухня-столовая',0,341,566,Math.PI/2,kitchenSource,'Ниши и техника приведены как визуальная компоновка. Подтвердить модели приборов, вентиляцию ниш и выводы.');
    counter(p,3.43,2.56,.57,6);
    for(const y of [.91,1.42]){
      boxAt(p,.15,y,-.310,.54,.48,.045,'ink',.009);
      boxAt(p,.15,y-.035,-.337,.47,.332,.013,'blackGlass',.006);
      boxAt(p,.15,y+.121,-.37,.42,.019,.029,'chrome',.006);
      boxAt(p,.15,y+.196,-.341,.105,.031,.002,'blackGlass');
      for(const x of [-.036,.33]){const knob=cylinder(p,x,y+.192,-.35,.018,.018,.018,'chrome');knob.rotation.x=Math.PI/2;}
    }
    obstacle(p,3.43,.57);
  }
  {
    const p=at('waterfall','Кухонный остров с варочной панелью','Кухня-столовая',0,226,569,0,kitchenSource,'Остров с двумя каменными торцами, высоким барным свесом и цилиндрической вытяжкой. Рисунок камня взят с поверхности острова на стр. 61.');
    const W=2.08,D=1.10,Y=.893;
    boxAt(p,0,Y/2,.10,W-.11,Y-.04,D-.34,'darkOak',.007);
    for(let i=0;i<3;i++)boxAt(p,-W/2+(i+.5)*W/3,.456,.47,W/3-.009,.78,.029,'lacquer',.004);
    for(let i=0;i<56;i++)boxAt(p,-W/2+.059+i*(W-.118)/55,.43,-.271,.012,.79,.014,'darkOak',.003);
    for(let s of [-1,1])boxAt(p,s*(W/2-.023),Y/2,0,.046,Y,D,'marble',.003);
    boxAt(p,0,Y-.02,0,W,.040,D,'marble',.005);
    boxAt(p,0,Y+.006,.16,.594,.012,.483,'blackGlass',.005);
    for(const xx of [-.148,.148])for(const zz of [.048,.274]){
      const ring=object(p,new T.TorusGeometry(.084,.0015,5,40),'trim',xx,Y+.014,zz);ring.rotation.x=Math.PI/2;
    }
    fruitBowl(p,-.67,Y,-.21);
    cylinder(p,0,2.22,.16,.155,.155,.95,'ink',40);
    cylinder(p,0,1.738,.16,.150,.150,.014,'shadowGap',40);
    const halo=object(p,new T.TorusGeometry(.13,.005,8,40),'strip',0,1.726,.16);halo.rotation.x=Math.PI/2;
    shadow(p,W+.40,D+.53);obstacle(p,W,D);
  }
  {
    const p=at('bar-seating','Три полубарных стула','Кухня-столовая',0,226,527,0,kitchenSource,'Посадка относительно барного свеса передана по листу мебели. Проверить пространство для ног и выдвижения.');
    for(const xx of [-.58,0,.58])chair(nested(p,xx,0,0,Math.PI),.644,'taupe',.47);
  }
  {
    const p=at('hearth','Каменная консоль биокамина','Кухня-столовая',0,226,491,0,kitchenSource,'Декоративный объём по листу мебели. Выбор и возможность эксплуатации изделия требуют отдельной проверки.');
    boxAt(p,0,.383,0,2.08,.766,.291,'marble',.008);boxAt(p,0,.772,0,1.58,.013,.097,'ink',.003);
    for(const v of [-1,1])boxAt(p,0,.844,v*.058,1.67,.135,.004,new T.MeshStandardMaterial({color:0xcecec5,transparent:true,opacity:.22,roughness:.12,depthWrite:false}));
    shadow(p,2.35,.67);obstacle(p,2.08,.29);
  }
  {
    const p=at('dining','Столовая группа на восемь мест','Кухня-столовая',0,203,393,0,kitchenSource,'Стол с деревянным верхом, мягкие стулья с обхватывающей спинкой и светильник над столом по стр. 63.');
    const W=.84,D=1.79,H=.748;
    boxAt(p,0,H,0,W,.043,D,'oak',.018);
    boxAt(p,0,H-.06,0,W-.14,.067,D-.20,'walnut',.012);deskFeet(p,W,D,H);
    for(const zz of [-.615,0,.615]){chair(nested(p,-.574,0,zz,-Math.PI/2));chair(nested(p,.574,0,zz,Math.PI/2))}
    chair(nested(p,0,0,-1.018,Math.PI));chair(nested(p,0,0,1.018));
    fruitBowl(p,0,H+.025,-.14);cup(p,.23,.30,H+.025);
    // A suspended constellation, modelled as small physical rods and light tips.
    const centres=[];
    for(let i=0;i<24;i++){
      const a=i*2.39996,yy=1.78+.71*(i/23),rr=.18+.10*Math.sin(i/23*Math.PI);
      centres.push([Math.cos(a)*rr,yy,Math.sin(a)*rr]);
      ball(p,Math.cos(a)*rr,yy,Math.sin(a)*rr,.010,.010,.010,'lamp');
      if(i>1)bar(p,centres[i-2],centres[i],.0026,'brass');
      if(i>3)bar(p,centres[i-4],centres[i],.0022,'bronze');
    }
    for(const k of [20,22])bar(p,centres[k],[centres[k][0],2.72,centres[k][2]],.0023,'bronze');
    shadow(p,1.18,2.28);obstacle(p,W,D);
  }
  // Furniture upholstery consists of a shaped carcass, separately seamed cushions,
  // and wrinkled covers. Shapes are in metres in the local furniture coordinate system.
  function pillow(p,x,y,z,w,h,d,fabric,lean=0,twist=0) {
    const group=nested(p,x,y,z);group.rotation.set(lean,twist,0);
    const upright=h>d,W=w/2,H=(upright?h:d)/2,thick=(upright?d:h)/2;
    const n=44,rings=9,ps=[],uv=[],ix=[],rim=[];
    const xy=a=>[Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.57),
                  Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.57)];
    for(let side=0;side<2;side++){
      const sign=side?1:-1;
      for(let j=0;j<=rings;j++)for(let i=0;i<=n;i++){
        const a=i/n*Math.PI*2,r=j/rings,[ax,ay]=xy(a);
        const wrinkles=Math.sin(a*14+2*Math.sin(a*5)+r*13)*.032*Math.pow(r,3);
        const xx=ax*r*W,yy=ay*r*H;
        const belly=thick*sign*(.045+.955*Math.sqrt(Math.max(0,1-Math.pow(r,3.8)))+wrinkles)+.013*Math.sin(2*a+.55)*r*r;
        ps.push(xx,upright?yy:belly,upright?belly:yy);uv.push(i/n,r);
        if(j<rings&&i<n){const k=side*(rings+1)*(n+1)+j*(n+1)+i;
          if(side)ix.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1);else ix.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
        if(side&&j===rings&&i<n){const t=.013*Math.sin(2*a+.55);rim.push(new T.Vector3(xx,upright?yy:t,upright?t:yy))}
      }
    }
    const offset=(rings+1)*(n+1),end=rings*(n+1);
    for(let i=0;i<n;i++){const k=end+i;ix.push(k,k+offset,k+1,k+1,k+offset,k+offset+1)}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
    const o=object(group,g,fabric);o.material.side=T.DoubleSide;
    object(group,new T.TubeGeometry(new T.CatmullRomCurve3(rim,true),60,.0028,6,true),fabric==='ivoryFabric'?'beige':fabric);
    return group;
  }
  function leafPlant(p,h=1.35){
    const potTop=h*.25;
    vessel(p,0,0,0,[[.001,0],[.17,0],[.218,.04],[.217,potTop-.025],[.211,potTop],[.197,potTop],[.19,potTop-.03]],'graphite');
    cylinder(p,0,potTop-.018,0,.193,.187,.018,'soil');
    const positions=[],uv=[],inds=[],materials=[
      new T.MeshStandardMaterial({color:0x52623e,roughness:.77,side:T.DoubleSide}),
      new T.MeshStandardMaterial({color:0x38452e,roughness:.73,side:T.DoubleSide})
    ];
    function leaflet(a,b,c,w){
      const start=positions.length/3;
      const sx=c[0]-a[0],sz=c[2]-a[2],len=Math.hypot(sx,sz)||1;
      const dx=-sz/len*w,dz=sx/len*w;
      positions.push(...a,b[0]+dx,b[1],b[2]+dz,b[0],b[1]+w*.48,b[2],b[0]-dx,b[1],b[2]-dz,...c);
      uv.push(0,.5,.48,1,.48,.5,.48,0,1,.5);
      inds.push(start,start+1,start+2,start,start+2,start+3,start+1,start+4,start+2,start+2,start+4,start+3);
    }
    for(let i=0;i<13;i++){
      const a=i*2.40,tall=h*(.47+.48*random()),len=h*(.21+.28*random()),ax=Math.cos(a),az=Math.sin(a);
      const pos=t=>[ax*(.05+len*t*t),potTop+tall*Math.sin(t*1.79),az*(.05+len*t*t)];
      arc(p,[pos(0),pos(.33),pos(.7),pos(1)],.004,'darkOak',10);
      for(let j=2;j<=12;j++){
        const t=j/13,m=pos(t),k=(.09+.12*Math.sin(t*3.0))*(1-.43*t)*h;
        for(const sign of [-1,1]){
          const dx=sign*(-az),dz=sign*ax;
          const tip=[m[0]+dx*k+ax*.085,m[1]+.027+(.35-t)*.082,m[2]+dz*k+az*.085];
          leaflet(m,[(m[0]+tip[0])/2,m[1]+.047,(m[2]+tip[2])/2],tip,.012+.004*random());
        }
      }
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(inds);g.computeVertexNormals();
    object(p,g,materials[0]);shadow(p,.73,.73);
  }
  function lampPendant(p,x,z,last=1.05){
    cylinder(p,x,2.638,z,.054,.054,.024,'bronze');bar(p,[x,2.63,z],[x,last+.19,z],.0026,'ink');
    cylinder(p,x,last+.095,z,.028,.028,.19,'brass');cylinder(p,x,last+.012,z,.024,.025,.052,'lamp');
    for(let i=0;i<8;i++){const a=i*Math.PI/4;
      bar(p,[x+.034*Math.cos(a),last+.035,z+.034*Math.sin(a)],[x+.034*Math.cos(a),last+.174,z+.034*Math.sin(a)],.0024,'brass')}
  }
  {
    const p=at('living-sofa','Модульный диван с шезлонгом','Гостиная',0,329,211,0,livingSource,'Раскладка продольных модулей по плану, низкий силуэт, оттоманка и текстиль по стр. 68–70.');
    const len=4.02;
    boxAt(p,0,.084,0,.78,.14,len-.1,'darkOak',.055);
    boxAt(p,0,.208,0,.91,.265,len,'beige',.096);
    for(let i=0;i<4;i++){
      const z=(i-1.5)*.983,d=i===0?1.56:.94;
      boxAt(p,(d-.94)*.49+.033,.367,z,d,.225,.966,'beige',.092);
            const half=(d-.94)*.49+.033,face=half+d*.5-.013;
      arc(p,[[face-.075,.390,z-.461],[face-.009,.391,z-.439],[face,.391,z-.365],[face,.391,z+.367],[face-.009,.391,z+.434],[face-.071,.390,z+.462]],.0025,'taupe',34);
      const back=boxAt(p,-.382,.596,z,.238,.48,.962,'beige',.086);back.rotation.z=.055;
      if(i!==2){
        const g=nested(p,-.205,.624,z+.084,Math.PI/2+.055*(i-1));
        const pp=pillow(g,0,0,0,.68,.477,.157,i===1?'taupe':'ivoryFabric',-.265);pp.rotation.z=(i-1)*.076;
      }
    }
    boxAt(p,-.005,.413,1.999,.94,.415,.158,'beige',.075);
    const floorLamp=nested(p,-.412,0,1.62);cylinder(floorLamp,0,.025,0,.21,.22,.05,'ink');
    arc(floorLamp,[[0,.035,0],[0,.98,0],[.074,1.69,-.015],[.46,1.995,-.13],[.88,1.99,-.18],[.981,1.750,-.19]],.014,'ink',26);
    vessel(floorLamp,.98,1.59,-.19,[[.188,0],[.186,.014],[.153,.089],[.074,.156],[.018,.167]],'ink');
    cylinder(floorLamp,.981,1.589,-.19,.176,.176,.005,'lamp');
    shadow(p,1.41,4.47);obstacle(p,.90,4.02);
  }
  {
    const p=at('living-rug','Фактурный ковёр и приставные столики','Гостиная',0,386,224,0,livingSource,'Ориентация ковра по листу мебели. Образец рисунка взят с ковра на стр. 67.');
    const G=new T.PlaneGeometry(1.40,3.08),rug=object(p,G,'rug',-.06,.0035,0);rug.rotation.x=-Math.PI/2;rug.userData.keepUV=true;
    const tab=nested(p,-.48,0,1.61);
    cylinder(tab,0,.024,0,.148,.159,.042,'ink');bar(tab,[0,.016,0],[0,.498,0],.018,'ink');cylinder(tab,0,.51,0,.236,.236,.022,'darkOak');
    pottery(tab,-.046,.522,0,.36,'ivory');cup(tab,.082,0,.522);
  }
  {
    const p=at('media','ТВ-панель, витрина и подвесная тумба','Гостиная',0,451,228,-Math.PI/2,livingSource,'Композиция по развёрткам и визуализации на стр. 71. Рисунок камня взят из палитры квартиры.');
    // The front of this assembly faces west towards the sofa.
    boxAt(p,0,1.30,0,2.67,2.54,.055,'marble');
    boxAt(p,0,1.31,.049,2.66,1.36,.084,'lacquer',.009);
    boxAt(p,0,2.012,.078,2.63,.013,.012,'strip');
    const low=nested(p,0,.21,.178,Math.PI);counter(low,2.60,.34,.29,4,'lacquer');
    boxAt(p,0,.577,.151,2.61,.028,.36,'marble');
    screen(p,0,1.347,.102,1.57,.884);
    boxAt(p,0,.613,.20,.88,.056,.065,'ink',.008);
    pottery(p,.99,.601,.19,.41,'ivory');
    const shelf=nested(p,1.67,0,.038);
    boxAt(shelf,0,1.29,-.016,.558,2.49,.052,'marble');
    for(const xx of [-.299,.299])boxAt(shelf,xx,1.28,.106,.032,2.50,.284,'ink');
    for(let i=0;i<7;i++){
      const sy=.16+i*.382;boxAt(shelf,0,sy,.103,.62,.025,.29,'darkOak');
      if(i>0&&i<6){boxAt(shelf,0,sy-.016,.139,.55,.007,.008,'strip');if(i%2)books(shelf,-.214,sy+.014,.084,9);else pottery(shelf,0,sy+.015,.104,.71,'graphite')}
    }
  }
  {
    const p=at('lounge-palms','Растения у гостиной','Гостиная',0,299,367,0,livingSource,'Свободно стоящее растение у дивана воспроизводит характер кадра на стр. 67.');
    leafPlant(p,1.29);
  }
  function bedding(p,w,master){
    shadow(p,w+.61,2.65);
    const col=master?'ivoryFabric':'taupe';
    for(const xx of [-1,1])for(const zz of [-1,1])cylinder(p,xx*(w/2-.065),.052,zz*.915,.022,.019,.104,'ink');
    boxAt(p,0,.211,0,w+.13,.288,2.066,col,.088);
    boxAt(p,0,.413,0,w,.242,2.017,'ivoryFabric',.106);
    boxAt(p,0,.593,-.995,w+.13,.88,.16,col,.072);
    if(master)boxAt(p,0,.75,-.909,.006,.47,.005,'taupe');
    const xs=64,zs=72,ps=[],uv=[],idx=[];
    for(let j=0;j<=zs;j++)for(let i=0;i<=xs;i++){
      const u=i/xs,v=j/zs;const sn=2*u-1,edge=Math.max(0,(Math.abs(sn)-.90)/.10),foot=Math.max(0,(v-.94)/.06);
      const sag=.126*edge*edge+.118*foot*foot;
      const wave=master?.028:.012,roll=Math.exp(-Math.pow((v-.13-.024*Math.sin(6*u))/.074,2))*(master?.096:.033);
      const crease=wave*Math.sin(u*26+v*8+.76*Math.sin(v*21))*Math.exp(-v*.67)+.012*Math.cos(u*12-v*23);
      const X=Math.sign(sn)*(Math.min(Math.abs(sn)/.90,1)*(w/2+.009)+.029*edge)+.006*Math.sin(v*18)*edge;
      const Z=-.64+1.648*Math.min(v/.94,1)+.039*foot+.040*(1-v)*Math.sin(u*19);
      ps.push(X,.595+crease+roll-sag,Z);uv.push(u,v);
      if(i<xs&&j<zs){const a=j*(xs+1)+i;idx.push(a,a+xs+1,a+1,a+1,a+xs+1,a+xs+2)}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    const o=object(p,g,master?'duvet':'charcoal');o.material.side=T.DoubleSide;
    for(const s of [-1,1]){
      const k=nested(p,s*w*.241,.608,-.734,s*.072);
      const pillowMesh=pillow(k,0,.012,0,w*.449,.217,.436,master?'ivoryFabric':'taupe',-.21);pillowMesh.rotation.z=s*.036;
      const x=s*(w/2+.325);
      boxAt(p,x,.354,-.796,.467,.247,.378,master?'lacquer':'white',.04);
      for(const k of [-1,1])bar(p,[x+k*.151,.240,-.823],[x+k*.176,.014,-.782],.016,'darkOak');
      boxAt(p,x,.478,-.792,.398,.008,.316,'darkOak',.003);
      lampPendant(p,x,-.807,.99+s*.077);if(master&&s<0){books(p,x-.11,.485,-.815,2,true);cup(p,x+.078,-.782,.488);}
    }
  }
  {
    const p=at('master-bed','Мастер-спальня · кровать и подвесы','Мастер-спальня',1,191,506,Math.PI/2,upperSource,'Двуспальная кровать развёрнута изголовьем к боковой стене по плану. Текстиль со складками и разновысотные подвесы по стр. 99.');
    bedding(p,1.81,true);obstacle(p,1.89,2.08);
  }
  {
    const p=at('child-bed','Детская · кровать с тумбами','Детская спальня',1,383,151,0,childSource,'Мягкое изголовье, свободная по краям заправка, пара подвесов по стр. 117.');
    bedding(p,1.53,false);obstacle(p,1.64,2.05);
  }
  function headwall(p,w,master){
    boxAt(p,0,.648,0,w,1.24,.078,master?'cliff':'greige');
    boxAt(p,0,1.967,-.034,w,1.355,.064,'greige');
    boxAt(p,0,1.289,.016,w-.032,.018,.016,'strip');
    wash(p,0,1.291,.046,w-.012,.46);
  }
  {
    const p=at('master-headwall','Панели и подсветка изголовья','Мастер-спальня',1,139,506,Math.PI/2,'Стр. PDF 94–101','Виды 99–100 задают рельефный нижний пояс, тёплую подсветку и серо-бежевую верхнюю панель.','finishes');
    headwall(p,3.14,true);
    const child=at('child-headwall','Серые фактурные панели','Детская спальня',1,382,96,0,'Стр. PDF 112–118','Матовая фактура воспроизведена из фрагмента стены на стр. 117.','finishes');
    headwall(child,3.26,false);
  }
  {
    const p=at('master-tv','ТВ-панель и комод','Мастер-спальня',1,348,533,-Math.PI/2,upperSource,'Подвесная белая тумба и телевизор по развёртке мастер-спальни.');
    boxAt(p,0,1.41,0,1.75,2.47,.032,'greige');screen(p,0,1.49,.06,1.19,.671);
    const c=nested(p,0,.318,.157,Math.PI);counter(c,1.71,.32,.31,3,'lacquer');pottery(p,.68,.647,.19,.43,'ivory');
    const tv=at('child-screen','Телевизор на стене','Детская спальня',1,358,248,Math.PI,childSource,'Расположение по визуализациям 116–118.');
    screen(tv,0,1.44,0,1.11,.626);
  }
  // Finish each plan cell only once. Clipping the combined orthogonal footprint
  // to the actual slab rectangles preserves the stair opening on the upper level.
  function roomAt(f,x,z) {
    if(!f){
      if(z<596&&x>650)return 'Кладовая';
      if(x>655&&z>766)return 'Гардеробная у входа';
      if(x>=490&&x<=655&&z>=686&&z<=850)return 'Санузел';
      if(x>=490&&z>=645)return 'Прихожая';
      if(x>392&&z<538)return 'Гостиная';
      return 'Кухня-столовая';
    }
    if(z<372&&x>=392)return 'Детская спальня';
    if(x<392&&z<593)return 'Лоджия';
    if(z<592||(x>=495&&x<632&&z<680))return 'Холл';
    if(x<495&&z<860)return 'Мастер-спальня';
    if(x<345)return 'Гардеробная спальни';
    if(x<495)return 'Душевая';
    if(x<632&&z>=680&&z<849)return 'Парная';
    return 'Ванная';
  }
  function fitFloors(f) {
    const rects=floors[f],cover=new Map();
    const xs=[...new Set(rects.flatMap(([a,b,c,d])=>[a,c]).concat([345,392,490,495,632,650,655]))].sort((a,b)=>a-b);
    const zs=[...new Set(rects.flatMap(([a,b,c,d])=>[b,d]).concat([372,538,592,593,645,680,686,766,849,850,860]))].sort((a,b)=>a-b);
    for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++) {
      const a=xs[i],b=zs[j],c=xs[i+1],d=zs[j+1],x=(a+c)/2,z=(b+d)/2;
      if(!rects.some(([l,t,r,u])=>x>l&&x<r&&z>t&&z<u))continue;
      const room=roomAt(f,x,z);
      if(!cover.has(room))cover.set(room,[]);
      cover.get(room).push([a,b,c,d]);
    }
    for(const [room,cells] of cover){
      const bath=['Санузел','Душевая','Ванная'].includes(room),sauna=room==='Парная';
      const description=bath?(room==='Душевая'?'Керамогранит 60 × 60':'Керамогранит · пол'):sauna?'Керамогранит под дерево':'Виниловое покрытие · дуб';
      const p=item('floor-'+f+'-'+String(cover.size)+'-'+cells[0][0]+'-'+cells[0][1],description,room,f,450,550,0,'Планы полов, листы 26–27 (стр. PDF 27–28).','Границы по контурам планов, раскладка и оттенок ориентировочные. Поправки к обмеру, швы и подрезку сверить по месту.','finishes');
      const pos=[],uv=[],idx=[];
      for(const [a,b,c,d] of cells){
        const start=pos.length/3;
        for(const [px,pz] of [[a,b],[c,b],[c,d],[a,d]]){
          const x=(px-450)*unit,z=(pz-550)*unit;
          pos.push(x,-.002,z);uv.push(x/(bath?1.6:3.26),z/(bath?1.6:3.26));
        }
        idx.push(start,start+2,start+1,start,start+3,start+2);
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
      const mesh=object(p,geo,bath?'ivory':sauna?'walnut':'oak');mesh.userData.keepUV=true;
      if(bath)wallJoints(p,cells);
    }
  }
  function wallJoints(p,cells){
    for(const [a,b,c,d] of cells){
      const l=(a-450)*unit,r=(c-450)*unit,t=(b-550)*unit,u=(d-550)*unit;
      for(let x=Math.ceil(l/.60)*.60;x<r;x+=.60)boxAt(p,x,-.0007,(t+u)/2,.0016,.0007,u-t,'taupe');
      for(let z=Math.ceil(t/1.20)*1.20;z<u;z+=1.20)boxAt(p,(l+r)/2,-.0007,z,r-l,.0007,.0017,'taupe');
    }
  }
  fitFloors(0); fitFloors(1);
  function curtain(p,w,h,mode='linen'){
    const seg=Math.max(48,Math.ceil(w/.018)),n=7,vert=[],uv=[],ind=[];
    for(let j=0;j<=n;j++)for(let i=0;i<=seg;i++){
      const u=i/seg,v=j/n;
      const wave=Math.sin(u*(mode==='linen'?Math.ceil(w/.095):Math.ceil(w/.064))*Math.PI*2+.24*v);
      const fullness=(.7+.27*v),d=wave*fullness*(mode==='linen'?.044:.018)+.006*Math.cos(v*3+u*9);
      vert.push((u-.5)*w*(.99+.017*v),.009+(h-.018)*v+.006*Math.sin(u*19)*(1-v),d);uv.push(u,v);
      if(j<n&&i<seg){const a=j*(seg+1)+i;ind.push(a,a+1,a+seg+1,a+1,a+seg+2,a+seg+1)}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vert,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();
    const curtainMat=mode==='linen'?mat('taupe'):new T.MeshStandardMaterial({color:0xfaf5e7,map:map('weave'),transparent:true,opacity:.63,side:T.DoubleSide,depthWrite:false,roughness:1});
    curtainMat.side=T.DoubleSide;object(p,g,curtainMat);
  }
  function drapes(id,room,f,px,pz,rotation,w,source){
    const p=item(id,'Тюль и боковые портьеры',room,f,px,pz,rotation,source,'Текстиль повторяет складки и палитру визуализации. Размещён вдоль оконных проёмов. Свободная часть сохраняет видимость остекления.');
    const h=levelHeight[f]-.122;
    curtain(nested(p,0,0,.023),w-.016,h,'voile');
    const edge=Math.min(.36,w*.238);
    curtain(nested(p,-w/2+edge*.48,0,.089),edge,h);
    curtain(nested(p,w/2-edge*.48,0,.089),edge,h);
    boxAt(p,0,h+.012,.028,w+.036,.026,.076,'trim',.007);
  }
  drapes('living-window','Гостиная',0,396,221,Math.PI/2,1.88,'Стр. PDF 67–72');
  drapes('child-window','Детская спальня',1,396,221,Math.PI/2,1.88,'Стр. PDF 116–118');
  drapes('dining-window','Кухня-столовая',0,212,456,0,.98,'Стр. PDF 63');
  drapes('dining-corner','Кухня-столовая',0,282,401,Math.PI/2,1.34,'Стр. PDF 63');
  // The rough relief has a cut perimeter as seen over the island in sheet 61.
  {
    const p=item('kitchen-rock','Рельефная стена напротив острова','Кухня-столовая',0,163,801,Math.PI/2,
      'Стр. PDF 61–63','Форма кромки и рельеф переданы по интерьерному виду. Основание, массу и технологию крепления выбрать после согласования образца.','finishes');
    const W=4.45,H=2.63,vs=[],uv=[],ind=[],nx=75,ny=30;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const u=i/nx,v=j/ny;
      const bottom=.14+(2.49)*(.51+.49*Math.tanh((u-.47)*3.4))+.085*Math.sin(15*u)+.026*Math.sin(67*u);
      const localH=bottom+(H-bottom)*v;
      vs.push((u-.5)*W,localH,.020+.015*Math.sin(u*59+v*4+.7*Math.sin(u*50-v*13))+.008*Math.sin(v*37+u*99));
      uv.push(u*2.3,localH*.87);
      if(i<nx&&j<ny){const a=j*(nx+1)+i;ind.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1)}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();object(p,g,'cliff');
    boxAt(p,0,H+.015,.012,W,.013,.016,'strip');wash(p,0,H+.014,.063,W,.55);
  }
  function track(p,a,b,y,positions){
    bar(p,[a[0],y,a[1]],[b[0],y,b[1]],.010,'ink');
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    for(const t of positions){
      const x=a[0]+dx*t,z=a[1]+dz*t;
      cylinder(p,x,y-.047,z,.030,.034,.09,'ink',20);
      cylinder(p,x,y-.094,z,.025,.025,.005,'lamp',20);
      const rail=boxAt(p,x+dx/len*.17,y-.012,z+dz/len*.17,.012,.012,.19,'strip');rail.rotation.y=Math.atan2(dx,dz);
    }
  }
  for(const [id,name,f,px,pz,w,d,ref] of [
    ['k','Кухня-столовая',0,321,819,2.87,2.75,61],['l','Гостиная',0,519,354,2.35,4.93,67],
    ['m','Мастер-спальня',1,329,722,2.95,2.25,99],['d','Детская спальня',1,519,244,2.40,2.52,117],
    ['h','Холл',1,508,482,1.96,1.80,83],['v','Ванная',1,686,716,.79,2.06,91],['e','Прихожая',0,706,714,.66,.83,47]
  ]){
    const p=item('ceiling-'+id,'Встроенный свет · трековая композиция',name,f,px,pz,0,'Стр. PDF 35–37, '+ref,'Визуальное исполнение светильников по рендерам. Точки подключения, группы и высоты смотреть на слое электрики.','finishes');
    const y=levelHeight[f]-.055;
    track(p,[-w/2,-d/2],[-w/2,d/2],y,[.14,.57,.86]);track(p,[w/2,-d/2],[w/2,d/2],y,[.24,.66]);
    track(p,[-w/2,-d/2],[w/2,-d/2],y,[]);track(p,[-w/2,d/2],[w/2,d/2],y,[]);
  }
  {
    const p=item('entry-cladding','Тёмная каменная облицовка у входа','Прихожая',0,757,713,-Math.PI/2,'Стр. PDF 45–48','Дверной проём сохранён по плану 08. Тёмная облицовка, тумба и пуф заданы интерьерными видами.','finishes');
    boxAt(p,0,1.21,.004,.917,2.12,.014,'graphite',.003);
    for(const x of [-.488,.488])boxAt(p,x,1.115,.015,.048,2.18,.032,'ink');
    boxAt(p,0,2.224,.015,1.02,.053,.041,'ink');
    boxAt(p,.287,1.195,.025,.021,1.49,.020,'brass',.003);
    boxAt(p,0,2.475,.003,1.79,.406,.028,'graphite');
    for(const x of [-.711,.711])boxAt(p,x,1.122,0,.403,2.244,.034,'graphite');
    boxAt(p,0,2.665,.029,1.79,.009,.012,'strip');wash(p,0,2.662,.044,1.77,.50);
    const hall=item('entry-seat','Пуф и консоль прихожей','Прихожая',0,703,750,Math.PI,'Стр. PDF 45–48','Пуф с тканевой обивкой и лаконичная подвесная консоль по визуализации прихожей.');
    shadow(hall,.62,.59);vessel(hall,0,0,0,[[.001,.015],[.156,.015],[.204,.067],[.224,.177],[.215,.312],[.176,.367],[.088,.389],[.001,.390]],'beige');
    for(const v of [-1,1])bar(hall,[v*.177,.010,.031],[v*.181,.148,.032],.012,'ink');
    boxAt(hall,-.266,.793,.156,.386,.151,.144,'ink',.009);pottery(hall,-.239,.875,.157,.31,'ivory');
  }
  function wallPanel(p,w,h,material,light){
    boxAt(p,0,h/2,0,w,h,.022,material,.003);
    const spacing=material==='ivory'?.61:.48;
    for(let xx=-w/2+spacing;xx<w/2-.02;xx+=spacing)boxAt(p,xx,h/2,.013,.0016,h,.003,'taupe');
    if(light){boxAt(p,0,h-.008,.022,w-.018,.011,.012,'strip');wash(p,0,h-.019,.025,w-.015,.54)}
  }
  {
    const p=item('bath-end','Мраморная облицовка ванной','Ванная',1,686,881,Math.PI,'Стр. PDF 88–93','Светлая облицовка с прожилками и подсветка. Образец фактуры выделен с поверхности стен на стр. 91.','finishes');
    wallPanel(p,1.75,2.65,'ivory',true);
    const side=item('bath-side','Боковая облицовка у ванны','Ванная',1,757,813,-Math.PI/2,'Стр. PDF 88–93','Акцентная стена в зоне ванны по визуализации. Подтвердить раскрой по развёрткам.','finishes');
    wallPanel(side,1.71,2.65,'ivory',true);
    const other=item('bath-vanitywall','Облицовка в зоне умывальника','Ванная',1,730,679,-Math.PI/2,'Стр. PDF 88–93','Панель у раковины на участке до выступа.','finishes');
    wallPanel(other,1.74,2.65,'ivory',true);
    const tub=at('bathtub','Встроенная ванна','Ванная',1,526,564,0,'Стр. PDF 16, 24–26, 88–93','Положение по листу 15. Чаша модeльная, выпуск, наполнение и съёмный экран проверить по выбранному изделию.');
    const W=.695,D=1.63,H=.536;
    for(const s of [-1,1]){
      boxAt(tub,s*(W/2-.009),H/2,0,.018,H,D,'lacquer',.005);
      boxAt(tub,0,H/2,s*(D/2-.009),W,H,.018,'lacquer',.005);
    }
    basin(tub,0,H,0,W,D,.333,'porcelain');
    const mixer=nested(tub,.32,.625,.47,-Math.PI/2);bar(mixer,[0,0,.001],[0,0,.16],.014,'ink');
    boxAt(mixer,.12,0,.006,.153,.07,.027,'ink',.008);
    arc(mixer,[[.12,0,.042],[.16,-.41,.141],[.24,-.38,.112],[.25,.207,.03]],.007,'ink');
    bar(mixer,[.25,.20,.03],[.25,.321,.037],.018,'ink');
    shadow(tub,.86,1.82);obstacle(tub,W,D);
  }
  function vanity(id,room,f,x,z,rot,ref){
    const p=at(id,'Умывальник, тумба и зеркало',room,f,x,z,rot,ref,'Положение и палитра по альбому, ниша и подключения уточняются под паспорт изделия.');
    boxAt(p,0,.54,.014,.69,.39,.376,'lacquer',.035);
    boxAt(p,0,.542,.206,.637,.006,.006,'taupe');
    basin(p,0,.768,.038,.72,.40,.109,'porcelain');
    boxAt(p,0,.695,.237,.708,.132,.025,'porcelain',.011);
    const mirror=cylinder(p,0,1.47,-.133,.303,.303,.021,'mirror',64);mirror.rotation.x=Math.PI/2;
    const ring=object(p,new T.TorusGeometry(.307,.008,8,70),'ink',0,1.470,-.128);
    const led=object(p,new T.TorusGeometry(.319,.007,8,70),'strip',0,1.470,-.141);
    faucet(p,.126,.776,-.098);
    const soap=cylinder(p,-.24,.834,-.051,.031,.032,.115,'bronze');cylinder(p,-.24,.908,-.051,.012,.013,.028,'ink');
  }
  vanity('vanity-upper','Ванная',1,508,441,-Math.PI/2,'Стр. PDF 16, 88–93');
  vanity('vanity-entry','Санузел',0,391,500,0,'Стр. PDF 14, 52–54');
  vanity('vanity-suite','Душевая',1,345,620,-Math.PI/2,'Стр. PDF 16, 102–105');
  function wc(id,room,f,x,z,angle,ref){
    const p=at(id,'Подвесной унитаз',room,f,x,z,angle,ref,'Габарит сантехнического прибора приблизительный. Проверить по паспорту инсталляции и чаши.');
    ball(p,0,.298,.03,.181,.123,.237,'porcelain');
    boxAt(p,0,.355,-.055,.33,.137,.259,'porcelain',.041);
    const lid=ball(p,0,.421,.042,.170,.025,.215,'porcelain');lid.rotation.x=-.035;
    boxAt(p,0,.886,-.221,.195,.103,.011,'ink',.007);
    for(const xx of [-.039,.043])boxAt(p,xx,.885,-.214,.044,.035,.003,'smoked',.006);
    shadow(p,.47,.57,0,.04);
  }
  wc('wc-lower','Санузел',0,410,539,Math.PI/2,'Стр. PDF 14, 52–54');
  wc('wc-upper','Ванная',1,512,491,-Math.PI/2,'Стр. PDF 16, 88–93');
  wc('wc-suite','Душевая',1,284,649,0,'Стр. PDF 16, 102–105');
  {
    const p=at('sauna-benches','Полки и деревянная обшивка','Парная',1,414,529,0,'Стр. PDF 16, 88–93','Декоративная модель полков. Условия размещения, тепловая защита и безопасные расстояния согласуются со специалистами.');
    for(let i=0;i<6;i++)boxAt(p,-.56+i*.069,.527,0,.062,.048,1.60,'oak',.008);
    for(let i=0;i<6;i++)boxAt(p,0,.806,-.65+i*.065,1.13,.049,.059,'oak',.007);
    const wall=nested(p,-.611,0,0,Math.PI/2);
    for(let i=0;i<24;i++)boxAt(wall,0,.097+i*.097,0,1.64,.093,.022,'oak',.008);
    boxAt(wall,0,.825,.016,1.60,.009,.012,'strip');
    shadow(p,1.29,1.82);
  }
  {
    const p=at('study','Кабинет в холле · стол и кресло','Холл',1,333,367,-.50,'Стр. PDF 16, 80–87','Рабочая зона в холле с открытыми полками по стр. 83–85.');
    boxAt(p,0,.753,0,.72,.054,1.37,'walnut',.024);
    deskFeet(p,.72,1.36,.73);chair(nested(p,.498,0,-.07,Math.PI/2),.45,'ivoryFabric');
    const laptop=nested(p,0,.785,.12,-Math.PI/2);
    boxAt(laptop,0,.007,0,.310,.014,.210,'chrome',.006);
    const display=boxAt(laptop,0,.108,-.120,.308,.205,.010,'ink',.006);display.rotation.x=-.18;
    books(p,-.12,.784,-.41,2,true);cup(p,.131,.32,.783);
    shadow(p,1.13,1.67);
    const panel=item('upper-art','Панно над лестничным холлом','Холл',1,638,479,Math.PI/2,'Стр. PDF 86–87','Декоративный мотив дымчатого оникса из интерьерного вида. Расположение и подложка иллюстративны.','finishes');
    // Keep the centre of the stair opening clear. The artwork belongs to a solid wall.
    panel.position.set((730-450)*unit,upper+.021,(456-550)*unit);panel.rotation.y=-Math.PI/2;
    boxAt(panel,0,1.53,0,.423,1.17,.027,'onyx',.005);
    const plant=at('terrace-planter','Лоджия · кресло-кокон и растение','Лоджия',1,243,275,0,'Стр. PDF 16, 109–111','Лёгкий подвесной кокон показан для оценки объёма. Подвес и крепление к конструкции требуют расчёта.');
    for(let i=0;i<17;i++){
      const a=-2.7+i*5.4/16;
      const pts=[];for(let j=0;j<10;j++){const t=j/9,rad=.392*Math.pow(Math.sin(Math.PI*t),.79);
        pts.push([Math.sin(a)*rad,.36+1.19*t,Math.cos(a)*rad*.95]);}
      arc(plant,pts,.007,'oak',19);
    }
    for(let j=1;j<9;j++){
      const t=j/9,r=.392*Math.pow(Math.sin(Math.PI*t),.79),pts=[];
      for(let i=0;i<=16;i++){const a=-2.7+i*5.4/16;pts.push([Math.sin(a)*r,.36+1.19*t,Math.cos(a)*r*.95])}
      arc(plant,pts,.006,'oak',26);
    }
    pillow(plant,0,.565,0,.589,.171,.593,'ivoryFabric',.04);
    arc(plant,[[0,1.55,0],[0,1.80,0],[0,2.64,0]],.0035,'ink',6);
    leafPlant(nested(plant,-.698,0,.92),.91);shadow(plant,.82,.89);
  }
  // Nearby depth discontinuities approximate the occlusion that joins cabinetry,
  // textiles and walls visually. The BIM data and geometry stay independent.
  let screenPass=null;
  function makeScreenPass() {
    if(!renderer.capabilities.isWebGL2 && !renderer.extensions.has('WEBGL_depth_texture'))return null;
    const target=new T.WebGLRenderTarget(1,1,{type:renderer.capabilities.isWebGL2?T.HalfFloatType:T.UnsignedByteType,
      minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false});
    target.depthTexture=new T.DepthTexture(1,1,renderer.capabilities.isWebGL2?T.UnsignedIntType:T.UnsignedShortType);
    const uniforms={inputColor:{value:target.texture},inputDepth:{value:target.depthTexture},size:{value:new T.Vector2()},
      projection:{value:new T.Matrix4()},inverseProjection:{value:new T.Matrix4()}};
    const post=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,uniforms,
      vertexShader:'varying vec2 screenUV;void main(){screenUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`
        uniform sampler2D inputColor,inputDepth;
        uniform vec2 size;
        uniform mat4 projection,inverseProjection;
        varying vec2 screenUV;
        vec3 pointAt(vec2 uv,float d){
          vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);
          return p.xyz/p.w;
        }
        void main(){
          vec3 color=texture2D(inputColor,screenUV).rgb;
          float depth=texture2D(inputDepth,screenUV).r;
          if(depth<.9999){
            vec3 pos=pointAt(screenUV,depth);
            vec3 normal=normalize(cross(dFdx(pos),dFdy(pos)));
            vec2 pixel=1./size;
            float radius=min(78.,size.y*projection[1][1]*.23/max(.26,-pos.z));
            float angle=6.28318*fract(.06711056*mod(gl_FragCoord.x,8.)+.1927541*mod(gl_FragCoord.y,8.));
            float sum=0.;
            for(int i=0;i<16;i++){
              float fi=float(i)+.55,scale=fi/16.;
              vec2 q=screenUV+vec2(cos(angle+fi*2.399963),sin(angle+fi*2.399963))*pixel*max(1.25,radius*scale);
              q=(floor(q*size)+.5)/size;float sd=texture2D(inputDepth,q).r;
              vec3 delta=pointAt(q,sd)-pos;float l=length(delta);
              float influence=(1.-smoothstep(.025,.49,l))*smoothstep(.005,.027,l);
              float facing=max(0.,(dot(normal,delta)-.004)/max(l,.0001)-.10);
              sum+=influence*facing;
            }
            float ao=clamp(1.-sum*.145,.58,1.);
            color*=vec3(ao,mix(ao*ao,ao,.86),mix(ao*ao,ao,.73));
          }
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const screen=new T.Scene(),quadCamera=new T.Camera();
    screen.add(new T.Mesh(new T.PlaneGeometry(2,2),post));
    return {target,uniforms,screen,quadCamera,width:0,height:0};
  }
  window.renderInteriorView=(world,eye)=>{
    if(!eye.isPerspectiveCamera){renderer.render(world,eye);return}
    if(screenPass===null)screenPass=makeScreenPass()||false;
    if(!screenPass){renderer.render(world,eye);return}
    const pass=screenPass,draw=renderer.getDrawingBufferSize(pass.uniforms.size.value);
    if(pass.width!==draw.x||pass.height!==draw.y){
      pass.target.setSize(draw.x,draw.y);pass.width=draw.x;pass.height=draw.y;
    }
    pass.uniforms.projection.value.copy(eye.projectionMatrix);
    pass.uniforms.inverseProjection.value.copy(eye.projectionMatrixInverse);
    const old=renderer.getRenderTarget();
    renderer.setRenderTarget(pass.target);renderer.render(world,eye);
    renderer.setRenderTarget(old);renderer.render(pass.screen,pass.quadCamera);
  };
  const plafond=new T.MeshStandardMaterial({color:0xf0ebe1,roughness:.87,emissive:0xbab09e,emissiveIntensity:.16});
  for(let f=0;f<2;f++){
    const p=item('ceiling-face-'+f,'Светлая поверхность потолка','',f,450,550,0,'Планы потолков, стр. PDF 32–34','Плоскость по контуру перекрытия, форма ниш и монтажные отметки проверяются по согласованным потолочным узлам.','finishes');
    p.userData.record.kind='ceiling';
    const rects=f?floors[0]:floors[1],xs=[...new Set(rects.flatMap(c=>[c[0],c[2]]))].sort((a,b)=>a-b),zs=[...new Set(rects.flatMap(c=>[c[1],c[3]]))].sort((a,b)=>a-b);
    const ps=[],uv=[],ix=[],Y=levelHeight[f]-.034;
    for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
      const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],x=(x0+x1)/2,z=(z0+z1)/2;
      if(!rects.some(([a,b,c,d])=>x>a&&x<c&&z>b&&z<d))continue;
      const base=ps.length/3;
      for(const [px,pz] of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]]){ps.push((px-450)*unit,Y,(pz-550)*unit);uv.push(px*unit,pz*unit)}
      ix.push(base,base+1,base+2,base,base+2,base+3);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();object(p,g,plafond);
  }
  {
    const p=item('living-end','Торцевая композиция гостиной','Гостиная',0,519,129,0,'Стр. PDF 67, 69, 72','Непрозрачная торцевая стена с двумя рельефными вставками и настенным панно по виду из гостиной.','finishes');
    for(const xx of [-1,1])boxAt(p,xx*1.11,1.307,0,.71,2.61,.039,'cliff');
    // In the render this abstract quadriptych is mounted on the solid end wall.
    const tones=[
      new T.MeshStandardMaterial({color:0x514639,roughness:.35,metalness:.36}),
      new T.MeshStandardMaterial({color:0xb1a28f,roughness:.43,metalness:.20}),
      new T.MeshStandardMaterial({color:0xc6bbac,roughness:.65,metalness:.13}),
      new T.MeshStandardMaterial({color:0x766756,roughness:.50,metalness:.29})
    ];
    for(let i=0;i<4;i++)boxAt(p,(i%2-.5)*.575,1.56+(i<2?.262:-.262),.032,.566,.516,.037,tones[i]);
    boxAt(p,0,2.637,.023,2.85,.009,.013,'strip');wash(p,0,2.629,.052,2.85,.52);
  }
  {
    const p=item('library','Книжный стеллаж холла','Холл',1,481,382,0,'Стр. PDF 16, 81–85','Открытые полки и закрытый нижний ярус по интерьерным видам. Закрывает глухую часть стены рядом с дверью детской.');
    const W=2.03;
    boxAt(p,0,1.272,-.008,W,2.51,.027,'lacquer');
    for(const v of [-.999,-.34,.32,.999])boxAt(p,v*(W/2-.012),1.28,.108,.028,2.51,.238,'lacquer');
    for(let k=0;k<5;k++){
      const y=.65+k*.398;boxAt(p,0,y,.115,W,.021,.255,'lacquer');
      if(k<4)for(let i=0;i<3;i++){
        const xx=(i-1)*.667-.205;
        if((k+i)%3)books(p,xx,y+.013,.094,5+(k+i)%4);
        else if(k%2)pottery(p,xx+.24,y+.017,.125,.77,'greige');
        else books(p,xx,y+.016,.122,3,true);
      }
    }
    const base=nested(p,0,.037,.12,Math.PI);counter(base,W,.53,.245,5,'taupe');
  }
  function closet(id,room,f,px,pz,rot,W,ref){
    const p=item(id,'Открытые секции гардеробной',room,f,px,pz,rot,ref,'Секции хранения и мягкая подсветка по визуализации. Вешала и ящики показаны в ориентировочных габаритах.');
    boxAt(p,0,1.265,-.231,W,2.48,.027,'darkOak');
    for(const xx of [-W/2,W/2])boxAt(p,xx,1.278,-.003,.025,2.49,.438,'darkOak');
    for(const yy of [.165,1.915,2.285]){
      boxAt(p,0,yy,0,W,.029,.455,'walnut');
      if(yy>1)boxAt(p,0,yy-.017,.163,W-.05,.008,.009,'strip');
    }
    bar(p,[-W/2+.03,1.786,.043],[W/2-.03,1.786,.043],.012,'bronze');
    // Coats are hanging cloth surfaces with flared hems, individual shoulders and pleats.
    const count=Math.max(5,Math.floor((W-.15)/.119));
    for(let i=0;i<count;i++){
      const x=-W/2+.112+i*(W-.226)/(count-1),o=nested(p,x,0,.032,Math.PI/2+.12*Math.sin(i));
      arc(o,[[0,1.784,-.027],[0,1.81,.002],[0,1.794,.023],[0,1.73,.011]],.0025,'chrome',10);
      bar(o,[0,1.726,0],[-.164,1.642,0],.008,'walnut');bar(o,[0,1.726,0],[.164,1.642,0],.008,'walnut');
      const ps=[],ix=[],uv=[],n=22,lo=.54+random()*.32,fabric=['taupe','charcoal','greige','beige'][i%4];
      for(let j=0;j<=5;j++)for(let a=0;a<=n;a++){
        const ang=2*Math.PI*a/n,v=j/5,w=.18+.132*(1-v)-.124*Math.pow(v,8),h=lo+(1.67-lo)*v;
        const deep=.040+.010*Math.sin(ang*9+i+v*2);
        ps.push(Math.sin(ang)*w,h+.015*Math.cos(ang*4)*(1-v),Math.cos(ang)*deep);
        uv.push(a/n,v);
        if(j<5&&a<n){const k=j*(n+1)+a;ix.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
      const coat=object(o,g,fabric);coat.material.side=T.DoubleSide;
    }
    for(let i=0;i<4;i++){const xx=-W*.30+i*(W*.19);
      boxAt(p,xx,2.068,-.021,W*.167,.244,.329,i%2?'beige':'taupe',.022);
      boxAt(p,xx,2.073,.146,.049,.015,.007,'bronze',.006);
    }
    shadow(p,W+.28,.71);
  }
  closet('wardrobe-entry','Гардеробная у входа',0,714,861,Math.PI,1.19,'Стр. PDF 49–51');
  closet('wardrobe-suite','Гардеробная спальни',1,254,964,Math.PI,2.08,'Стр. PDF 106–108');
  {
    const p=item('store','Стеллаж кладовой','Кладовая',0,708,148,0,'Стр. PDF 75–79','Хранение на открытом стеллаже по развёрткам кладовой.');
    const W=1.0;
    for(const xx of [-W/2,W/2])for(const zz of [-.12,.16])bar(p,[xx,.04,zz],[xx,2.23,zz],.013,'ink');
    for(let j=0;j<5;j++){
      const y=.13+j*.492;boxAt(p,0,y,.015,W,.026,.356,'oak',.004);
      for(let i=0;i<3;i++){
        const x=(i-1)*.289;
        if(j%2){boxAt(p,x,y+.124,.005,.245,.221,.209,'taupe',.013);boxAt(p,x,y+.144,.114,.062,.017,.005,'brass');}
        else vessel(p,x,y+.014,.022,[[.001,0],[.061,0],[.065,.016],[.068,.168],[.054,.186],[.051,.205],[.045,.205]],i%2?'greige':'ivory');
      }
    }
  }
  // register-assemblies
  for (const p of assembled) register(p);
  window.interiorObstacles=obstacles;
})();







