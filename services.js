/* Engineering overlays from the supplied 2024 design album. Each marker has
   an independent source and is selectable. Measurements in the tables below
   use the left plan area of the engineering pages rendered at width 2000,
   cropped by (120,100). Those sheets share a single unrotated registration. */
(() => {
  'use strict';
  const factor = 334 / 380;
  const metresPerPixel = unit * factor;
  const floorOriginX = (156 - 450) * unit;
  const floorOriginZ = (990 - 550) * unit;
  function position(x, z, elevation, level) {
    return new THREE.Vector3(
      floorOriginX + (x - 98) * metresPerPixel,
      level * upper + elevation,
      floorOriginZ + (z - 1037) * metresPerPixel
    );
  }

  const catalog = new Map();
  const ink = {
    cold: 0x317eeb, hot: 0xfd6764, drain: 0x24a58e, drainEdge: 0x1b7360,
    socket: 0xf1b04a, controls: 0xce8b41, low: 0x8d7bda, plate: 0xf4eee0,
    dark: 0x33383c, metal: 0x60737b, white: 0xe6e0c8,
    heat: 0xe78c55, radiator: 0xd8bead, light: 0xffdf9b, rail: 0x535865
  };
  function material(color) {
    if (!catalog.has(color)) {
      catalog.set(color, new THREE.MeshStandardMaterial({color, roughness: .65,
        metalness: color === ink.metal ? .48 : .12, emissive: color,
        emissiveIntensity: color === ink.light ? .50 : .13}));
    }
    return catalog.get(color);
  }
  function piece(group, geometry, color, center) {
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.position.copy(center);
    group.add(mesh);
    return mesh;
  }
  function block(group, w, h, d, color, x, y, z) {
    return piece(group, new THREE.BoxGeometry(w, h, d), color, new THREE.Vector3(x, y, z));
  }
  function pipe(group, a, b, radius, color, sides=10) {
    const difference = new THREE.Vector3().subVectors(b, a);
    if (difference.lengthSq() < 1e-10) return;
    const geom = new THREE.CylinderGeometry(radius, radius, difference.length(), sides);
    const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(.5);
    const mesh = piece(group, geom, color, center);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), difference.normalize());
    return mesh;
  }
  function source(sheet) { return 'Лист ' + sheet + ' · PDF, стр. ' + (sheet + 1); }
  function publish(record, mesh) {
    // A sensible local origin is useful for inspectors, scene export and focus.
    mesh.updateMatrixWorld(true);
    const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const root = new THREE.Group();
    root.position.copy(center);
    mesh.position.sub(center);
    root.add(mesh);
    root.name = record.id;
    BIM.add({...record, object: root});
  }
  const kitchen='Кухня-столовая', living='Гостиная', utility='Кладовая', hall='Холл',
    entrance='Прихожая', wardrobe='Гардеробная', wc='Санузел',
    master='Мастер-спальня', child='Детская', bath='Ванная', shower='Душевая',
    loggia='Лоджия', sauna='Парная';
  const facing = {S:0,E:Math.PI/2,N:Math.PI,W:-Math.PI/2};
  function mounted(x,z,h,level,face,relief=.06) {
    const g = new THREE.Group();
    g.position.copy(position(x,z,h,level));
    g.rotation.y = facing[face];
    g.translateZ(relief);
    return g;
  }
  const fixedHeights = 'Отметка центра указана от чистого пола соответствующего этажа. ';
  const plainHeights = 'Положение в плане перенесено со знака на листе. Высота в модели условная. До монтажа нужны техническая карта выбранного прибора и развёртка стены.';

  // Water draw-off points. These are short terminal symbols only; the album
  // provides no supply manifold layout, branch topology or routing elevation.
  const outlets = [
    [0,'K01',kitchen,'Кухонная мойка',178,1026,'N',.60,true,'Поз. 22, комплект Paulmark.'],
    [0,'K02',kitchen,'Посудомоечная машина',192,1028,'N',.50,false,'Вывод ХВС на листе возле мойки.'],
    [0,'K03',kitchen,'Стиральная машина',470,790,'W',.65,false,'На рисунке показан синий вывод ХВС. Выноска рядом с машиной упоминает ГВС и ХВС; комплект подключений проверить по паспорту.'],
    [0,'K04',kitchen,'Хозяйственная мойка',471,821,'W',.65,true,'Поз. 23, 24. Соседствует с колонной стиральной и сушильной машин.'],
    [0,'B01',wc,'Душевой гарнитур',499,727,'E',1.05,true,'Поз. 7–9 по спецификации.'],
    [0,'B02',wc,'Инсталляция унитаза',548,821,'E',.55,false,'Поз. 1–3 по спецификации.'],
    [0,'B03',wc,'Гигиенический душ',575,863,'N',.65,true,'Выноска гигиенического душа на листе 22.'],
    [0,'B04',wc,'Смеситель умывальника',641,863,'N',.65,true,'Поз. 5, 6.'],
    [1,'B05',bath,'Смеситель умывальника',750,645,'W',.65,true,'Поз. 21, 17.'],
    [1,'B06',bath,'Гигиенический душ',750,693,'W',.65,true,'Поз. 15.'],
    [1,'B07',bath,'Инсталляция унитаза',749,725,'W',.55,false,'Поз. 1, 4 и 2.'],
    [1,'B08',bath,'Подвод к ванне',777,772,'N',.60,true,'Ванна и душевая система, поз. 11, 12. Увязать встроенную часть с бортом выбранной ванны.'],
    [1,'B09',bath,'Верхний душ у ванны',698,912,'N',1.05,true,'Поз. 19, 20.'],
    [1,'M01',shower,'Смеситель раковины',466,928,'W',.65,true,'Поз. 16, 17.'],
    [1,'M02',shower,'Душевой гарнитур',470,996,'W',1.05,true,'Поз. 7–9.'],
    [1,'M03',shower,'Гигиенический душ',326,976,'E',.65,true,'Выноска возле инсталляции.'],
    [1,'M04',shower,'Инсталляция унитаза',355,1008,'N',.55,false,'Поз. 1, 3 и 2.']
  ];
  outlets.forEach(([level,id,room,name,x,z,face,h,pair,extra]) => {
    const mesh=mounted(x,z,h,level,face,.075);
    const colors=pair?[ink.hot,ink.cold]:[ink.cold];
    colors.forEach((color,i)=>{
      const localX=pair?(i-.5)*.115:0;
      const a=new THREE.Vector3(localX,0,-.025), b=new THREE.Vector3(localX,0,.105);
      pipe(mesh,a,b,.026,color,14);
      pipe(mesh,new THREE.Vector3(localX,0,.078),new THREE.Vector3(localX,0,.102),.035,ink.metal,12);
      pipe(mesh,new THREE.Vector3(localX,0,.102),new THREE.Vector3(localX,0,.113),.027,color,14);
    });
    publish({id:'W-'+id,name:name+' · '+(pair?'ГВС и ХВС':'ХВС'),level,room,system:'water',
      stage:'plumbing',source:source(22+level),sourcePage:23+level,status:'Чертёж',
      note:extra+' '+plainHeights,kind:'Точка подключения',count:1},mesh);
  });

  // Drain routes reproduce only green lines in sheets 22/23. Arrows point
  // towards the sewer stack in plan. Their displayed Z height is schematic.
  const drains = [
    [0,'D1',kitchen,'Мойка и посудомоечная → шахта',[[178,1028],[178,1036],[478,1036],[478,845],[499,845]]],
    [0,'D2',kitchen,'Хозяйственная мойка и техника → шахта',[[470,855],[478,855],[478,845],[499,845]]],
    [0,'D3',wc,'Душ → шахта',[[499,741],[492,741],[492,845],[499,845]]],
    [0,'D4',wc,'Унитаз → шахта',[[557,822],[526,822],[526,844],[499,844]]],
    [0,'D5',wc,'Умывальник → шахта',[[641,867],[641,871],[505,871]]],
    [1,'D6',bath,'Умывальник и унитаз → шахта',[[749,646],[758,646],[758,766],[789,766],[789,923],[508,923],[499,840]]],
    [1,'D7',bath,'Ванна → ветка вдоль стены',[[775,784],[775,769],[789,769]]],
    [1,'D8',bath,'Душ → ветка вдоль стены',[[698,822],[698,923]]],
    [1,'D9',shower,'Унитаз и душ → шахта',[[355,1005],[355,1037],[478,1037],[478,923],[508,923]]],
    [1,'D10',shower,'Умывальник → общая ветка',[[451,924],[478,924]]]
  ];
  drains.forEach(([level,id,room,name,points])=>{
    const mesh=new THREE.Group();
    const h=.09;
    const path=points.map(([x,z])=>position(x,z,h,level));
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],v=b.clone().sub(a);
      pipe(mesh,a,b,.032,ink.drain);
      if(v.length()>.40){
        const arrow=piece(mesh,new THREE.ConeGeometry(.064,.15,10),
          ink.drainEdge,a.clone().lerp(b,.64));
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
      }
    }
    publish({id:'S-'+id,name:'Слив · '+name,room,level,system:'drain',stage:'plumbing',
      kind:'Направление стока',status:'Схема проекта',source:source(22+level),sourcePage:23+level,
      note:'В плане повторена условная зелёная линия автора. Стрелки показывают направление стока. Линия приподнята над поверхностью для обзора. Высоты врезок, уклон, сечения и способ обхода конструкций согласует проектировщик.'},mesh);
  });
  for(const level of [0,1]){
    const stack=new THREE.Group();
    const a=position(499,840,.015,level),b=position(499,840,level?height-upper:upper,level);
    pipe(stack,a,b,.065,ink.drainEdge,18);
    [0,.42,.94].forEach(t=>{
      const start=a.clone().lerp(b,t);
      pipe(stack,start,start.clone().add(new THREE.Vector3(0,.075,0)),.077,ink.drain,18);
    });
    publish({id:'S-R'+(level+1),name:'Канализационный стояк',room:'Инженерная шахта',level,
      kind:'Стояк',system:'drain',stage:'plumbing',status:'Чертёж',source:source(22+level),sourcePage:23+level,
      note:'По одному зелёному знаку стояка на этаж. Два фрагмента относятся к одному стояку. Проверить отметки тройников и доступ к ревизии в натуре.'},stack);
  }
  // A block is represented at the centre marked on sheets 39/40. Modules
  // form one selectable item. P = socket, W = splash-protected socket,
  // I = data, S = switch, T = floor-heating thermostat.
  const blocks = [
    [0,'L01',living,'Блок у дивана',428,50,'S',.30,'PPP'],
    [0,'L02',living,'Выключатель у кладовой',650,159,'W',.90,'S'],
    [0,'L03',living,'ТВ-зона · верхний блок',650,299,'W',1.20,'PPPI'],
    [0,'L04',living,'ТВ-зона · второй блок',650,473,'W',1.10,'PPPI'],
    [0,'L05',living,'Управление светом у лестницы',660,516,'S',.90,'S'],
    [0,'K01',kitchen,'Розетки у кресла',334,335,'W',.30,'PP'],
    [0,'K02',kitchen,'Столовая · свет и тёплый пол',110,535,'E',.90,'ST'],
    [0,'K03',kitchen,'Блок управления со стороны кухни',498,690,'N',.90,'SSSSS'],
    [0,'K04',kitchen,'Свет и регулятор у санузла',571,690,'N',.90,'SSSST'],
    [0,'K05',kitchen,'Стиральная машина',478,755,'W',1.00,'W'],
    [0,'K06',kitchen,'Сушильная машина',478,892,'W',1.00,'W'],
    [0,'K07',kitchen,'Блок у кухонного фронта',126,1037,'N',1.00,'WWS'],
    [0,'K08',kitchen,'Посудомоечная машина',230,1037,'N',.30,'W'],
    [0,'K09',kitchen,'Холодильник',282,1037,'N',.30,'P'],
    [0,'K10',kitchen,'Блок техники · нижний уровень',334,1037,'N',.05,'P'],
    [0,'K11',kitchen,'Блок техники · средний уровень',334,1037,'N',1.20,'P'],
    [0,'K12',kitchen,'Блок техники · верхний уровень',334,1037,'N',1.80,'P'],
    [0,'K13',kitchen,'Остров · двойная розетка',192,850,'S',null,'PP'],
    [0,'K14',kitchen,'Остров · точка у варочной панели',258,849,'N',null,'P'],
    [0,'K15',kitchen,'Остров · нижняя точка',258,875,'S',null,'P'],
    [0,'H01',entrance,'Розетки в прихожей',790,658,'W',.30,'PP'],
    [0,'H02',entrance,'Выключатели у входа',673,742,'E',.90,'SSSS'],
    [0,'H03',wardrobe,'Розетка в гардеробной',790,820,'W',.30,'P'],
    [0,'B01',wc,'Влагозащищённая розетка',575,870,'N',.30,'W'],
    [1,'C01',child,'Прикроватный блок слева',418,50,'S',.70,'PPS'],
    [1,'C02',child,'Прикроватный блок справа',614,50,'S',.70,'SSSPP'],
    [1,'C03',child,'Тройной блок у ТВ',480,327,'N',.90,'PPP'],
    [1,'C04',child,'Управление при входе',564,327,'N',.90,'S'],
    [1,'C05',child,'Блок у рабочего места',744,327,'N',.30,'PPP'],
    [1,'H01',hall,'Выключатели у лестницы',661,340,'S',.90,'SS'],
    [1,'H02',hall,'Рабочее место · сеть и питание',416,579,'N',.30,'PPPI'],
    [1,'H03',hall,'Рабочее место · дополнительный блок',456,579,'N',.30,'PP'],
    [1,'H04',hall,'Свет ванной, парной и регулятор',629,597,'W',.90,'TSS'],
    [1,'H05',loggia,'Регулятор тёплого пола',119,558,'N',.90,'T'],
    [1,'M01',master,'Прикроватный блок со стороны лоджии',98,636,'E',.80,'PPSSS'],
    [1,'M02',master,'Прикроватный блок со стороны гардеробной',98,846,'E',.80,'SPP'],
    [1,'M03',master,'Выключатель и розетки у входа',478,688,'W',.90,'SPP'],
    [1,'M04',master,'ТВ-зона',478,767,'W',.90,'PPP'],
    [1,'M05',master,'Выключатель у гардеробной',270,885,'N',.90,'S'],
    [1,'M06',master,'Свет и регулятор душевой',318,885,'N',.90,'ST'],
    [1,'B01',bath,'Блок у умывальника',734,600,'S',1.20,'WW'],
    [1,'B02',shower,'Блок у раковины',452,893,'S',1.20,'WW'],
    [1,'B03',shower,'Розетка у инсталляции',320,962,'E',.30,'W']
  ];
  const names={P:'розетка',W:'влагозащищённая розетка',I:'порт интернета',S:'выключатель',T:'терморегулятор'};
  for(const [level,id,room,name,x,z,face,h,modules] of blocks){
    const g=mounted(x,z,h===null?.74:h,level,face,.105), pitch=.073;
    block(g,modules.length*pitch+.021,.09,.023,ink.dark,0,0,0);
    [...modules].forEach((type,i)=>{
      const dx=(i-(modules.length-1)/2)*pitch;
      block(g,.068,.079,.016,ink.plate,dx,0,.018);
      if(type==='P'||type==='W'){
        pipe(g,new THREE.Vector3(dx,0,.027),new THREE.Vector3(dx,0,.036),.023,ink.socket,14);
        for(const sign of [-1,1])pipe(g,new THREE.Vector3(dx+sign*.008,0,.035),new THREE.Vector3(dx+sign*.008,0,.040),.0035,ink.dark,8);
        if(type==='W')block(g,.048,.01,.01,ink.metal,dx,.024,.034);
      }else{
        block(g,.052,type==='S'?.056:.032,.01,type==='I'?ink.low:type==='S'?ink.controls:ink.dark,dx,0,.031);
      }
    });
    const details=Object.entries(names).filter(([key])=>modules.includes(key)).map(([key,label])=>label+' × '+[...modules].filter(v=>v===key).length).join(', ');
    const elevation=h===null?'Отметка символа условная. Согласовать положение с развёртками и поставщиком кухни.':'Центр блока '+h.toFixed(2).replace('.',',')+' м от чистого пола. Для розетки без отдельной подписи на листе дано 0,30 м.';
    publish({id:'E-'+(level+1)+'-'+id,name,room,level,system:'electrical',stage:'electric',
      kind:'Установочный блок',source:source(39+level)+(/[ST]/.test(modules)?' · управление на л. '+(37+level):''),
      sourcePage:40+level,status:'Чертёж',count:modules.length,mountHeight:h,
      note:details+'. '+elevation+' Группы щита и кабельные трассы уточнить по рабочей электросхеме.'},g);
  }
  const radiators=[
    [0,'R01',living,368,163,'E',.860],[0,'R02',living,368,447,'E',.860],
    [0,'R03',kitchen,342,592,'S',.500],[1,'R04',child,370,163,'E',.860],
    [1,'R05',hall,371,554,'E',.540],[1,'R06',master,343,593,'S',.860]
  ];
  for(const [level,id,room,x,z,face,w] of radiators){
    const g=mounted(x,z,.20,level,face,.10), H=1.75;
    block(g,w,H,.045,ink.radiator,0,H/2,0);
    const n=Math.round(w/.037);
    for(let i=0;i<n;i++){
      const xx=-w/2+(i+.5)*w/n;
      block(g,w/n-.004,H-.035,.028,ink.radiator,xx,H/2,.037);
    }
    publish({id:'C-'+id,name:'Стальной радиатор · '+Math.round(w*1000)+' мм',
      kind:'Радиатор',room,level,stage:'climate',system:'climate',status:'Чертёж',
      source:source(20+level),sourcePage:21+level,
      note:'КЗТО «Параллели» В2-1750. Длина в плане перенесена из размерной цепочки. Монтажная высота, подключение и конфигурация корпуса в модели условные; сверить паспорт и привязки с отопительной организацией.'},g);
  }
  const floorZones=[
    [0,'F01',kitchen,4.13,[[120,437],[250,437],[250,317],[324,317],[324,547],[120,547]]],
    [0,'F02',wc,.99,[[586,711],[651,711],[651,828],[586,828]]],
    [1,'F03',loggia,4.12,[[120,437],[250,437],[250,317],[324,317],[324,547],[120,547]]],
    [1,'F04',bath,1.81,[[649,608],[703,608],[703,764],[715,764],[715,860],[649,860]]],
    [1,'F05',shower,.61,[[342,903],[421,903],[421,949],[382,949],[382,958],[342,958]]]
  ];
  for(const [level,id,room,area,outline] of floorZones){
    const g=new THREE.Group();
    const corners=outline.map(([x,z])=>position(x,z,.035,level));
    const shape=new THREE.Shape();
    corners.forEach((v,i)=>shape[i?'lineTo':'moveTo'](v.x,-v.z));
    shape.closePath();
    const geom=new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI/2);
    const fill=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color:ink.heat,transparent:true,opacity:.40,depthWrite:false,side:THREE.DoubleSide}));
    fill.position.y=level*upper+.036;
    g.add(fill);
    corners.forEach((v,i)=>pipe(g,v,corners[(i+1)%corners.length],.009,ink.heat,6));
    publish({id:'C-'+id,name:'Зона тёплого пола · '+area.toFixed(2).replace('.',',')+' м²',
      room,level,stage:'climate',system:'climate',kind:'Зона тёплого пола',status:'Чертёж',
      source:source(29+level),sourcePage:30+level,areaM2:area,unit:'м²',quantity:area,
      note:'Граница штриховки и площадь по подписи внутри зоны. Тип и мощность системы требуют выбора. Сумма пяти подписей — 11,66 м²; в повторяющейся ведомости альбома указано 11,67 м² и пять регуляторов на квартиру.'},g);
  }
  // Red track axes and lamp centres from sheet 34 (PDF 35) and sheet 35
  // (PDF 36). Dotted dimension lines on the drawing are deliberately omitted.
  const rectangle=(x,z,X,Z)=>[[x,z],[X,z],[X,Z],[x,Z],[x,z]];
  const tracks=[
    [0,'T01',living,'Линия у дивана · первая секция',[[453,68],[453,285]],[[453,92],[453,260]]],
    [0,'T02',living,'Линия у ТВ · первая секция',[[564,68],[564,285]],[[564,92],[564,260]]],
    [0,'T03',living,'Линия у дивана · вторая секция',[[453,371],[453,588]],[[453,392],[453,560]]],
    [0,'T04',living,'Линия у ТВ · вторая секция',[[564,371],[564,588]],[[564,392],[564,560]]],
    [0,'T05',kitchen,'Трек над обеденным столом',rectangle(174,465,264,642),[[174,501],[264,501],[174,604],[264,604]]],
    [0,'T06',kitchen,'Трек над островом',rectangle(167,822,349,883),[[195,822],[308,822],[195,883],[308,883]]],
    [0,'T07',kitchen,'Внешний трек кухонной зоны',rectangle(120,761,406,945),[]],
    [0,'T08',kitchen,'Линия прохода в кухню',[[384,643],[671,643]],[[527,643]]],
    [0,'T09',entrance,'Линия в прихожей',[[707,630],[707,751]],[[707,642],[707,698],[707,751]]],
    [0,'T10',wardrobe,'Секция в гардеробной',[[707,789],[707,876]],[]],
    [1,'T11',child,'Трек спальни',rectangle(427,118,620,261),[[427,118],[617,118],[427,261],[617,261]]],
    [1,'T12',hall,'Трек холла',rectangle(424,386,621,532),[[427,387],[617,387],[427,531],[617,531]]],
    [1,'T13',master,'Трек мастер-спальни',rectangle(173,637,311,835),[[173,637],[311,637],[173,835],[311,835]]],
    [1,'T14',bath,'Трек ванной',rectangle(668,634,731,806),[[668,634],[731,634],[668,713],[731,713],[668,796]]]
  ];
  function trackProfile(g,a,b){
    const v=b.clone().sub(a),c=a.clone().lerp(b,.5);
    const bar=piece(g,new THREE.BoxGeometry(.034,.024,v.length()),ink.rail,c);
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),v.normalize());
    const glow=piece(g,new THREE.BoxGeometry(.014,.005,v.length()>.5?.23:v.length()*.52),
      ink.light,c.clone().add(new THREE.Vector3(0,-.015,0)));
    glow.quaternion.copy(bar.quaternion);
  }
  for(const [level,id,room,name,route,spots] of tracks){
    const g=new THREE.Group(),h=2.52;
    const path=route.map(([x,z])=>position(x,z,h,level));
    for(let i=1;i<path.length;i++)trackProfile(g,path[i-1],path[i]);
    for(const [x,z] of spots){
      pipe(g,position(x,z,h,level),position(x,z,h-.089,level),.033,ink.rail,14);
      pipe(g,position(x,z,h-.089,level),position(x,z,h-.095,level),.029,ink.light,14);
    }
    publish({id:'L-'+id,name,room,level,system:'electrical',stage:'electric',kind:'Трек освещения',
      status:'Чертёж',source:source(34+level),sourcePage:35+level,
      note:'Ось шинопровода по плану освещения. Высота показана условно. Сверить опуск подвесного потолка, нишу и доступ к блоку питания. Световые модули показаны для ориентации; для заказа сверять спецификацию листа 36.'},g);
  }
  const lightGroups=[
    [0,'P01',kitchen,'Люстра над столовой',[[218,553]],true],
    [0,'P02',wc,'Накладные светильники санузла',[[618,737],[618,780],[618,823]],false],
    [0,'P03',wc,'Подвесы умывальной зоны',[[559,784],[553,800]],true],
    [1,'P04',loggia,'Накладные светильники лоджии',[[287,344],[287,393],[287,443],[287,492],[225,492],[162,492]],false],
    [1,'P05',child,'Прикроватные подвесы',[[410,82],[418,82],[616,82],[625,82]],true],
    [1,'P06',master,'Подвесы у изголовья',[[118,636],[118,847]],true],
    [1,'P07',wardrobe,'Потолочные точки гардеробной',[[204,916],[204,960]],false],
    [1,'P08',shower,'Накладные светильники душевой',[[354,924],[393,924],[432,924],[354,968]],false]
  ];
  for(const [level,id,room,name,points,pendant] of lightGroups){
    const g=new THREE.Group(),top=2.52,bottom=pendant?2.06:2.43;
    for(const [x,z] of points){
      if(pendant)pipe(g,position(x,z,top,level),position(x,z,bottom+.085,level),.006,ink.rail,8);
      pipe(g,position(x,z,bottom+.085,level),position(x,z,bottom,level),.038,ink.rail,14);
      pipe(g,position(x,z,bottom,level),position(x,z,bottom-.005,level),.035,ink.light,14);
    }
    publish({id:'L-'+id,name,level,room,stage:'electric',system:'electrical',kind:'Светильник',
      count:points.length,status:'Чертёж',source:source(34+level),sourcePage:35+level,
      note:'Количество центров в этой группе — '+points.length+'. Расположение в плане перенесено по символам. Высота посадки и длина подвесов в объёме схематические; согласовать с реальным потолком и выбранным прибором.'},g);
  }

  // Explicit outputs are shown as short markers. No wire between outlets or
  // guessed panel installation is represented as construction information.
  const leads=[
    [0,'L-EDGE',living,'Вывод подсветки у дивана',470,50,'S',2.20,'Группа 6.4 на листе 37.'],
    [0,'L-TV',living,'Вывод у стены ТВ',650,417,'W',1.18,'Связать с развёрткой ТВ-панели.'],
    [0,'L-STAIR',living,'Вывод подсветки перил',760,373,'W',.95,'Привязка зависит от окончательного варианта лестницы.'],
    [0,'PANTRY1',utility,'Первый электровывод кладовой',789,180,'W',1.80,'Проверить по проекту мест хранения и света.'],
    [0,'PANTRY2',utility,'Второй электровывод кладовой',789,225,'W',1.80,'Проверить по проекту мест хранения и света.'],
    [0,'K-ISLAND',kitchen,'Вывод у камина',174,716,'S',.45,'Проверить с выбранным оборудованием.'],
    [0,'D-CAB',wardrobe,'Вывод в гардеробной',742,923,'N',1.85,'Вывод у задней стенки.'],
    [1,'C-CAB',child,'Вывод подсветки мест хранения',789,67,'W',1.85,'Назначение подписано на листе 35.'],
    [1,'C-EDGE',child,'Вывод у изголовья',375,50,'S',1.20,'Сверить с узлом подсветки.'],
    [1,'M-CAB',wardrobe,'Вывод подсветки шкафов',308,911,'W',1.90,'Назначение подписано на листе 35.'],
    [1,'SA-H',sauna,'Вывод для печи парной',532,866,'N',.45,'Выбрать печь и подтвердить доступную мощность и схему с проектировщиком.'],
    [1,'SA-F',sauna,'Вывод для вентиляции парной',610,866,'N',.80,'Увязать с вентиляционным решением и оборудованием.']
  ];
  for(const [level,id,room,name,x,z,face,h,extra] of leads){
    const g=mounted(x,z,h,level,face,.095);
    const p=[new THREE.Vector3(0,0,0),new THREE.Vector3(.018,-.015,.047),
      new THREE.Vector3(.015,-.056,.061),new THREE.Vector3(.047,-.079,.072)];
    for(let i=1;i<p.length;i++)pipe(g,p[i-1],p[i],.011,ink.socket);
    pipe(g,new THREE.Vector3(0,0,-.018),new THREE.Vector3(0,0,.015),.035,ink.dark);
    publish({id:'E-'+id,name,room,level,system:'electrical',stage:'electric',kind:'Электровывод',
      source:source(39+level)+' · л. '+(34+level),sourcePage:40+level,status:'Чертёж',
      note:extra+' Высота символа условная. Отметку, номер группы и кабельную трассу требуется согласовать.'},g);
  }
})();
