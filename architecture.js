// Coordinates use the mounting plans 08–09 at a drawing width of 1600 pixels.
const unit=4.36/334, upper=2.88, height=5.70;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(64,1,.04,80);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.id='world';renderer.domElement.tabIndex=0;
document.getElementById('viewport').prepend(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xfff7eb,0xa89686,1.27);
const sun=new THREE.DirectionalLight(0xfff2de,1.13);
sun.position.set(-6,7,-4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-8,right:8,top:9,bottom:-9,near:.1,far:28});sun.shadow.normalBias=.015;
scene.add(hemi,sun);scene.background=new THREE.Color(0xe4e5dc);
const groups=[0,1,2].map(()=>{const g=new THREE.Group();scene.add(g);return g});
const materials=new Map(),bounds=[],floors=[[],[]];
const BIM=window.BIM={
 records:[],byId:new Map(),
 add(record){
  if(!record.id||!record.object||this.byId.has(record.id))throw new Error('Повтор или неполная карточка: '+record.id);
  record.level=Number(record.level);record.object.name=record.id;
  record.object.userData.bimId=record.id;
  if(!record.object.parent)scene.add(record.object);
  this.records.push(record);this.byId.set(record.id,record);return record;
 }
};
function box(x,z,X,Z,y,h,color,g=0){
 const key=String(color);
 if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.87}));
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.012,(X-x)*unit),h,Math.max(.012,(Z-z)*unit)),materials.get(key));
 mesh.position.set(((x+X)/2-450)*unit,y+h/2,((z+Z)/2-550)*unit);
 mesh.receiveShadow=true;groups[g].add(mesh);return mesh;
}
const roomTable=[
 ['Прихожая',0,3.56,711,707,600,620],['Гардеробная у входа',0,2.19,713,803,710,880],
 ['Санузел',0,3.11,562,740,630,830],['Кладовая',0,4.79,704,261,709,128],
 ['Кухня-столовая',0,27.03,422,719,270,965],['Гостиная',0,22.85,530,549,515,180],
 ['Холл',1,10.71,548,481,648,380],['Ванная',1,5.85,679,667,726,841],
 ['Парная',1,3.20,565,756,525,820],['Мастер-спальня',1,14.75,431,695,210,728],
 ['Душевая',1,2.54,406,918,472,968],['Гардеробная спальни',1,3.91,246,927,172,960],
 ['Лоджия',1,5.18,289,507,308,370],['Детская спальня',1,15.23,550,315,478,172]
];
let elementCounter=0;
function archRecord(parts, data){
 const group=new THREE.Group();parts.forEach(m=>group.add(m));
 return BIM.add({id:'AR-'+String(++elementCounter).padStart(3,'0'),room:'',...data,object:group});
}
function segment(x,z,X,Z,f,g=0,t=12,type='wall'){
 const base=f*upper,H=f?height-upper:upper;
 const a=Math.min(x,X)-(x===X?t/2:0),b=Math.min(z,Z)-(z===Z?t/2:0),c=Math.max(x,X)+(x===X?t/2:0),d=Math.max(z,Z)+(z===Z?t/2:0);
 const parts=[], part=(...args)=>{const m=box(...args);parts.push(m);return m};
 if(type==='window'){
  const sill=f?.88:.04,top=f?2.48:2.49;
  part(a,b,c,d,base,sill,0xbab8ad);part(a,b,c,d,base+top,H-top,0xbab8ad);
  for(const k of [0,.5,1]){
   const px=x+(X-x)*k,pz=z+(Z-z)*k;part(px-1.7,pz-1.7,px+1.7,pz+1.7,base+sill,top-sill,0x443f39)
  }
  const v=part(a,b,c,d,base+sill,top-sill,0xbad0d3);
  v.material=new THREE.MeshPhysicalMaterial({color:0xc7dde0,roughness:.12,transparent:true,opacity:.13,depthWrite:false,metalness:.02});
 }else{const m=part(a,b,c,d,base,H,g?0xcdc5b6:0xb3afa5,g);m.userData.wall=true}
 const r=archRecord(parts,{name:type==='window'?'Оконный блок':g?'Проектная перегородка':'Стена по контуру',system:g?'partition':'structure',stage:g?'partitions':'existing',level:f,
  ifcClass:type==='window'?'IfcWindow':'IfcWall',
  source:g?'Монтажные планы, листы 08–09':'Обмеры 04–05, монтажные планы 08–09, уточнение собственника',
  pages:g?[f?9:8]:[f?5:4,f?9:8], status:g?'Чертёж':'По плану и описанию',
  note:type==='window'?'Положение по планам. Высоты подоконника и верха требуют обмера.':g?'Координаты по плану. Толщину и закладные уточнить до заказа перегородок.':'Непрозрачная стена. Тип конструкции, отделка и толщина требуют сверки на месте.',
  lengthModel:(Math.hypot(X-x,Z-z)*unit).toFixed(2)});
 bounds.push({a,b,c,d,f,g,id:r.id});
}
const rectangles=[[156,596,490,990],[490,646,765,891],[490,596,738,646],[392,122,738,596],[738,122,763,284],[164,452,365,570],[278,346,365,452],[175,570,349,596],[349,570,392,596],[365,346,392,570]];
const slabParts=[[],[]];
function slab(x,z,X,Z,f){
 floors[f].push([x,z,X,Z]);slabParts[f].push(box(x,z,X,Z,f*upper-.105,.105,0xb4b1a8));
}
for(const f of [0,1]){
 for(const [x,z,X,Z] of rectangles){
 if(f&&x===392){slab(x,z,X,376,f);slab(x,376,659,Z,f)}else slab(x,z,X,Z,f)
 }
 const perimeter=[[156,596,175,596],[156,596,156,990],[156,990,490,990],[490,990,490,891],[490,891,765,891],[765,646,765,676],[765,752,765,891],[738,646,765,646],[738,284,738,646],[738,284,763,284],[763,122,763,284],[392,122,763,122],[392,122,392,151],[392,292,392,402],[392,541,392,596],[349,596,392,596],[365,346,365,402],[365,541,365,570],[349,570,365,570],[164,570,175,570],[175,570,175,596],[349,570,349,596],[164,452,164,570],[164,452,173,452],[248,452,278,452],[278,346,278,350]];
 for(const p of perimeter)segment(...p,f);
 for(const p of [[392,151,392,292],[392,402,392,541],[278,346,365,346],[278,350,278,452],[173,452,248,452]])segment(...p,f,0,5,'window');
 if(f)segment(765,676,765,752,f);
 else {
  // PR-1 opens out into the common corridor. Model its closed apartment face.
  const wallCount=groups[0].children.length;
  box(760,677,762,751,0,2.1,0x6e6358);
  box(757,686,760,696,.99,.026,0x403d39);
  box(760,676,766,752,2.09,.79,0xb3afa5);
  bounds.push({a:759,b:676,c:768,d:752,f:0,g:0});
  archRecord(groups[0].children.slice(wallCount),{name:'Входная дверь ПР-1',system:'structure',stage:'existing',level:0,ifcClass:'IfcDoor',source:'Листы 08, 11',pages:[8,11],status:'Чертёж',note:'Закрытое положение. Вход со стороны общего коридора.'});
 }
}
const partitions=[
 [[650,122,650,151],[650,203,650,532],[490,686,586,686],[640,686,655,686],[490,686,490,891],[655,686,655,891],[490,848,655,848],[655,766,680,766],[737,766,765,766]],
 [[392,371,578,371],[638,371,738,371],[666,122,666,180],[666,235,666,284],[666,284,763,284],[392,591,500,591],[495,591,495,608],[495,665,495,891],[495,680,632,680],[632,599,738,599],[632,599,632,611],[632,666,632,740],[632,792,632,849],[495,849,632,849],[156,860,207,860],[267,860,375,860],[425,860,490,860],[345,860,345,990],[175,577,181,577],[250,577,349,577]]
];
partitions.forEach((lines,f)=>lines.forEach(p=>segment(...p,f,1,9)));
 // Headers give interior doors their actual function as bounded openings.
 const openings=[
  [[650,151,650,203],[586,686,640,686],[680,766,737,766]],
  [[578,371,638,371],[666,180,666,235],[495,608,495,665],[632,611,632,666],[632,740,632,792],[207,860,267,860],[375,860,425,860],[181,577,250,577]]
 ];
 openings.forEach((items,f)=>items.forEach(([x,z,X,Z])=>{
  const y=f*upper+2.10,top=f?height:upper;
  const header=box(x-(x===X?4.5:0),z-(z===Z?4.5:0),X+(x===X?4.5:0),Z+(z===Z?4.5:0),y,top-y,0xdcd8d0,1);
  archRecord([header],{name:'Участок стены над дверью',system:'partition',stage:'partitions',level:f,ifcClass:'IfcWall',source:'Монтажные планы, листы 08–09',pages:[f?9:8],status:'Чертёж',note:'Положение проёма по плану, высота в модели ориентировочная.'});
 }));
for(let f=0;f<2;f++)archRecord(slabParts[f],{name:f?'Межэтажное перекрытие с лестничным проёмом':'Основание первого этажа',system:'structure',stage:'existing',level:f,ifcClass:'IfcSlab',kind:'slab',source:'Листы 04–05, 08–09, 13 и сведения собственника',pages:[f?9:8,13],status:'По описанию владельца',note:f?'Добавленный участок уже выполнен. Контур и толщина показаны схематически. Границы исходной плиты и достройки, армирование и узлы опирания требуют обследования.':'Толщина в модели условная. Состав существующих слоёв и отметки уточнить на объекте.'});
const roof=rectangles.map(([x,z,X,Z])=>box(x,z,X,Z,height,.09,0xe1dcd0));
archRecord(roof,{name:'Верхнее перекрытие',system:'structure',stage:'existing',level:1,kind:'roof',ifcClass:'IfcSlab',source:'Обмерные планы 04–05',pages:[4,5],status:'Чертёж',note:'Габарит по обмерной высоте 5,70 м. В плане и аксонометрии скрывается для обзора.'});
const wetZones=[
 ['Санузел',0,[[496,697],[646,697],[646,842],[496,842]]],
 ['Ванная',1,[[638,606],[731,606],[731,751],[758,751],[758,879],[662,879],[662,845],[638,845]]],
 ['Парная',1,[[503,688],[625,688],[625,840],[526,840],[526,797],[503,797]]],
 ['Душевая',1,[[353,868],[484,868],[484,984],[414,984],[414,961],[353,961]]]];
for(const [room,f,points] of wetZones){
 const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2((x-450)*unit,(550-z)*unit)));
 const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);
 const film=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x47a8ac,roughness:.70,side:THREE.DoubleSide,transparent:true,opacity:.85}));
 film.position.y=f*upper+.035;
 archRecord([film],{name:'Зона гидроизоляции · '+room,room,system:'waterproof',stage:'bases',level:f,ifcClass:'IfcCovering',source:'Монтажные планы 08–09, составы полов, лист 28',pages:[f?9:8,29],status:'Схема проекта',note:'Цветом отмечен пол мокрой зоны. Завод на стены, манжеты, узлы проходок, порог и толщины уточнить до устройства. Закрывать после приёмки скрытых работ.'});
}
