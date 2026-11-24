const tabs={model:'modelTab',schedule:'scheduleTab',photos:'photosTab'};
function changeTab(tab){
 state.tab=tab;movementKey.clear();
 Object.entries(tabs).forEach(([name,id])=>el(id).hidden=name!==tab);
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
 if(tab==='model'){resize();needsFrame=true}
 if(tab==='schedule')drawTable();
 if(tab==='photos')drawPhotos()
}
const allPages={4:'Обмеры первого этажа',5:'Обмеры второго этажа',8:'Монтажный план и лестница',9:'Монтажный план второго этажа',11:'Дверные проёмы',13:'Металлоконструкции',14:'Мебель — первый этаж, вариант 1',15:'Мебель — первый этаж, вариант 2',16:'Мебель — второй этаж',21:'Отопление первого этажа',22:'Отопление второго этажа',23:'Сантехника первого этажа',24:'Сантехника второго этажа',25:'Спецификация сантехники',26:'Спецификация сантехники',27:'Покрытия первого этажа',28:'Покрытия второго этажа',29:'Составы полов',30:'Тёплый пол первого этажа',31:'Тёплый пол второго этажа',32:'Потолки первого этажа',33:'Потолки второго этажа',35:'Свет первого этажа',36:'Свет второго этажа',37:'Спецификация освещения',38:'Выключатели первого этажа',39:'Выключатели второго этажа',40:'Электроточки первого этажа',41:'Электроточки второго этажа',42:'Спецификация электрофурнитуры'};
function setDoc(n){
 const key='assets/sheets/'+String(n).padStart(2,'0')+'.webp',img=el('sheetImage');
 const url=window.ASSETS[key];img.hidden=!url;el('sheetHint').hidden=!!url;
 if(url){img.src=url;img.alt='Страница '+n+' проекта · '+(allPages[n]||'Лист проекта')}
 el('fullPdf').href='https://github.com/mp-digital-tools-IP/nastroenie/releases/download/drawings-2024/nastroenie-album-2024.pdf'+'#page='+n;
}
function showSheets(pages){
 const list=el('docSelect');list.replaceChildren();const ordered=[...new Set([...pages,...Object.keys(allPages).map(Number)])];
 ordered.forEach(n=>list.add(option('PDF '+n+' · '+(allPages[n]||'Лист проекта'),n)));
 setDoc(ordered[0]);el('docs').showModal()
}
el('docSelect').onchange=e=>setDoc(+e.target.value);el('sourcesBtn').onclick=()=>showSheets(phase().pages);
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
el('helpBtn').onclick=()=>el('guide').showModal();
phases.forEach((p,i)=>{
 const b=button('',()=>applyPhase(p.id));b.className='phase';b.dataset.phase=p.id;
 const idx=document.createElement('span');idx.className='index';idx.textContent=String(i+1).padStart(2,'0');
 const label=document.createElement('span');label.textContent=p.name;b.append(idx,label);el('phaseList').append(b);
 el('taskStage').add(option(p.name,p.id))
});
roomTable.forEach((r,i)=>el('roomSelect').add(option(r[0]+' · '+(r[1]+1)+' эт.',i)));
el('roomSelect').onchange=e=>{jumpRoom(+e.target.value);selectRecord(null);updateVisibility();e.target.blur()};
el('floorSelect').onchange=e=>{setFloor(+e.target.value);e.target.blur()};
el('sideToggle').onclick=()=>el('sidebar').classList.toggle('open');
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>changeTab(b.dataset.tab));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
el('layersBtn').onclick=()=>{const m=el('layerMenu');m.hidden=!m.hidden;el('layersBtn').setAttribute('aria-expanded',!m.hidden)};
el('resetLayers').onclick=()=>{applyPhase(state.phase,false);el('layerMenu').hidden=true};
Object.entries(systemInfo).forEach(([sys,[name,color]])=>{
 const label=document.createElement('label'),cb=document.createElement('input'),dot=document.createElement('i');dot.className='legendDot';dot.style.background=color;cb.type='checkbox';cb.dataset.system=sys;
 cb.onchange=()=>{state.custom=true;if(sys==='stair'&&!cb.checked&&player.feet>.01&&player.feet<upper-.01)jumpRoom(player.feet>upper/2?6:0);if(cb.checked)state.systems.add(sys);else state.systems.delete(sys);updateVisibility()};
 label.append(cb,dot,document.createTextNode(name));el('systemsList').append(label);
 el('filterSystem').add(option(name,sys))
});
el('cumulative').onchange=e=>{state.cumulative=e.target.checked;applyPhase(state.phase,false)};
el('xray').onchange=e=>{state.xray=e.target.checked;updateVisibility()};
el('measureBtn').onclick=()=>{const desired=!state.measure;clearMeasure();state.measure=desired;syncUI();if(desired)notify('Укажите на плане две точки')};
el('closeInspect').onclick=()=>selectRecord(null);
for(const o of StairStudy.options)el('stairSelect').add(option(o.name,o.id));el('stairSelect').onchange=e=>setStair(e.target.value);
el('compareStairs').onclick=()=>{
 StairStudy.showComparison();
 const container=document.querySelector('#staircompare .st-body');
 if(!container)return;
 if(container.querySelector('.st-sheets')){window.refreshStairPhoto?.(state.stair);return}
 const wrap=document.createElement('div');wrap.className='st-photoBox';
 const img=document.createElement('img');img.alt='Физический рендер лестничной зоны';const panel=document.createElement('div');
 const title=document.createElement('h3');title.textContent='Сравнение с одной точки';
 const choices=document.createElement('select');choices.setAttribute('aria-label','Исполнение для сравнения');
 for(const o of StairStudy.options)choices.add(option(o.id==='none'?'Квартира сейчас':o.name,o.id));
 const view=document.createElement('select');view.setAttribute('aria-label','Положение камеры');view.add(option('Вид снизу','approach'));view.add(option('Вид с верхней площадки','landing'));
 const note=document.createElement('p');
 function showStairPhoto(){
  const id=choices.value,k='assets/stairviews/'+id+'-'+view.value+'.jpg';img.src=window.ASSETS[k]||k;
  const o=StairStudy.options.find(s=>s.id===id);note.textContent=id==='none'?'Бетонная коробка и открытая кромка по описанию собственника.':o.summary+' '+o.tradeoff;
 }
 choices.onchange=view.onchange=showStairPhoto;
 window.refreshStairPhoto=id=>{choices.value=id;showStairPhoto()};
 const use=button('Посмотреть в 3D',()=>{
  document.getElementById('staircompare').close();const id=choices.value;setStair(id);
  applyPhase(id==='none'?'existing':'interior',false);stairView(view.value==='approach'?0:1)
 });
 panel.append(title,choices,view,note,use);wrap.append(img,panel);container.insertBefore(wrap,container.querySelector('.st-cols'));window.refreshStairPhoto(state.stair);
 
 const row=document.createElement('div');row.className='st-sheets';
 for(const [page,key,caption] of [[13,'cut','Лист 13 · вырез 1060 × 1990 мм'],[8,'footprint','Лист 08 · пятно лестницы 2870 × 1780 мм']]){
  const fig=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');
  img.src=window.ASSETS['assets/overlays/'+key+'.png'];img.alt=caption;cap.textContent=caption;fig.append(img,cap);row.append(fig)
 }
 container.append(row);
 const file=document.createElement('a');file.href='Передача/Проём лестницы — лист обмера.pdf';file.target='_blank';file.rel='noopener';file.textContent='Открыть лист обмера для печати ↗';container.append(file);
};
function stairView(index){
 const v=StairStudy.views[index];state.floor=v.level;setView('walk',false);player.x=v.x;player.z=v.z;player.feet=v.level*upper;player.eye=1.59;player.yaw=v.yaw;player.pitch=v.pitch;el('roomSelect').value=v.level?6:5;updateVisibility()
}
el('belowStair').onclick=()=>stairView(0);el('aboveStair').onclick=()=>stairView(1);
el('zoomIn').onclick=()=>{orbit.span=Math.max(2,orbit.span/1.35);needsFrame=true};
el('zoomOut').onclick=()=>{orbit.span=Math.min(28,orbit.span*1.35);needsFrame=true};
el('zoomFit').onclick=()=>{fitFloor();needsFrame=true};
el('traceBtn').onclick=()=>{state.trace=!state.trace;syncUI();needsFrame=true};

function filtered(){
 const query=el('search').value.trim().toLocaleLowerCase('ru');
 return BIM.records.filter(r=>(!el('filterSystem').value||r.system===el('filterSystem').value)&&(!el('filterFloor').value||r.level===+el('filterFloor').value)&&(!query||[r.id,r.name,r.room,r.source,r.note].join(' ').toLocaleLowerCase('ru').includes(query)))
}
function locate(r){
 changeTab('model');state.floor=r.level;
 if(r.variant){state.stair=r.variant;StairStudy.select(r.variant)}
 setView('plan',false);applyPhase(r.stage,false);state.systems.add(r.system);
 if(r.system==='stair'){setView('orbit',false)}
 state.revealId=r.id;state.xray=engineering.has(r.system);orbit.target.copy(r.center);orbit.target.y=upper*r.level+.4;
 const size=r.fullBox.getSize(new THREE.Vector3());orbit.span=THREE.MathUtils.clamp(Math.max(size.x,size.z)*1.6+3.6,4.4,14);
 updateVisibility();selectRecord(r)
}
function drawTable(){
 const body=el('tableBody'),data=filtered(),frag=document.createDocumentFragment();
 for(const r of data){
  const row=document.createElement('tr');row.tabIndex=0;row.onclick=()=>locate(r);row.onkeydown=e=>{if(e.key==='Enter')locate(r)};
  const name=document.createElement('td');name.textContent=r.name;
  const id=document.createElement('small');id.textContent=r.id;name.append(id);row.append(name);
  [r.room||'Общая геометрия',r.level+1,systemInfo[r.system]?.[0]||r.system,r.status].forEach(t=>{const a=document.createElement('td');a.textContent=t;row.append(a)});
  frag.append(row)
 }
 body.replaceChildren(frag);el('counts').textContent='Показано '+data.length+' из '+BIM.records.length
}
el('search').oninput=drawTable;el('filterFloor').onchange=el('filterSystem').onchange=drawTable;
function exportFile(name,type,data){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function csvText(data){
 const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 const rows=[['Код','Элемент','Этаж','Помещение','Система','Этап','Статус','Вариант','Источник','Тип объекта','Количество модулей или точек в группе','Отметка центра от чистого пола, м','Площадь на листе, м²','Примечание'],...data.map(r=>[r.id,r.name,r.level+1,r.room,systemInfo[r.system][0],phases.find(p=>p.id===r.stage)?.name,r.status,r.variant||'',r.source,r.kind||'',r.count??'',r.mountHeight??'',r.areaM2??'',r.note])];
 return '\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n')
}
el('csvBtn').onclick=()=>exportFile('Настроение — выборка элементов.csv','text/csv;charset=utf-8',csvText(filtered()));
const key='nastr.renovation.notes.v1';
let book={version:1,checks:{},notes:{}},memoKey=null;
function readBook(raw){
 if(raw?.version!==1||!raw.checks||!raw.notes||typeof raw.checks!=='object'||typeof raw.notes!=='object'||Array.isArray(raw.notes)||Array.isArray(raw.checks))throw Error('Неверная структура');
 const checked={},notes={};for(const [k,v] of Object.entries(raw.checks))if(/^\w+\.\d+$/.test(k)&&typeof v==='boolean')checked[k]=v;
 for(const [k,v] of Object.entries(raw.notes))if((k.startsWith('stage:')||k.startsWith('item:'))&&typeof v==='string')notes[k]=v.slice(0,12000);
 return {version:1,checks:checked,notes}
}
try{const saved=localStorage.getItem(key);if(saved)book=readBook(JSON.parse(saved))}catch{}
function saveBook(){try{localStorage.setItem(key,JSON.stringify(book));return true}catch{return false}}
function loadTask(stageId,id){
 const p=phases.find(s=>s.id===stageId)||phase();el('taskStage').value=p.id;el('taskLead').textContent=p.lead;
 el('checklist').replaceChildren();p.checks.forEach((entry,i)=>{
  const label=document.createElement('label'),cb=document.createElement('input'),k=p.id+'.'+i;cb.type='checkbox';cb.checked=!!book.checks[k];
  cb.onchange=()=>{book.checks[k]=cb.checked;const saved=saveBook();if(!saved)el('noteStatus').textContent='Хранилище браузера недоступно. Используйте экспорт JSON.'};
  label.append(cb,document.createTextNode(entry));el('checklist').append(label)
 });
 memoKey=id?'item:'+id:'stage:'+p.id;el('memoLabel').textContent=id?'Заметка к объекту '+id:'Заметка к этапу';el('memo').value=book.notes[memoKey]||'';
 el('noteStatus').textContent='Отметки ведёт владелец. Для передачи другому участнику экспортируйте JSON.'
}
function openTasks(stageId,id){loadTask(stageId,id);el('tasks').showModal()}
function commitMemo(){book.notes[memoKey]=el('memo').value.slice(0,12000);const ok=saveBook();el('noteStatus').textContent=ok?'Сохранено в этом браузере.':'Сохранено на время сеанса. Выгрузите JSON.'}
el('taskStage').onchange=e=>{commitMemo();loadTask(e.target.value)};
el('tasks').addEventListener('close',()=>{if(memoKey)commitMemo()});el('saveMemo').onclick=commitMemo;
el('checkBtn').onclick=el('phaseInfo').onclick=()=>openTasks(state.phase);
el('exportNotes').onclick=()=>{commitMemo();exportFile('Настроение — журнал ремонта.json','application/json',JSON.stringify(book,null,2))};
el('importNotes').onclick=()=>el('noteFile').click();
el('noteFile').onchange=async e=>{try{
 const file=e.target.files[0];if(!file)return;if(file.size>2e6)throw Error();
 const loaded=readBook(JSON.parse(await file.text()));commitMemo();Object.assign(book.checks,loaded.checks);Object.assign(book.notes,loaded.notes);saveBook();loadTask(el('taskStage').value,memoKey?.startsWith('item:')?memoKey.slice(5):null);
 el('noteStatus').textContent='Импортированные записи объединены с журналом.'
 }catch{el('noteStatus').textContent='Не удалось прочитать этот журнал.'}finally{e.target.value=''}};
function photoPath(p,src){return src?'assets/references/'+p.page+'.jpg':'assets/renders/'+p.id+'.jpg'}
function drawPhotos(){
 const p=photoCatalog[state.photo];el('photoName').textContent=p.name;
 const key=photoPath(p,state.photoSource);el('photoMain').src=window.ASSETS[key]||key;
 el('photoMain').alt=(state.photoSource?'Визуализация из альбома: ':'Рендер нашей модели: ')+p.name;
 el('photoType').textContent=state.photoSource?'Альбом · PDF '+p.page:'Рендер модели · Cycles';
 el('photoMain').hidden=!!state.pano;el('panoCanvas').hidden=!state.pano;el('panoRender').classList.toggle('on',!!state.pano);if(state.pano){el('photoType').textContent='360° · потяните для поворота';window.showPanorama(p)}
 el('ownRender').classList.toggle('on',!state.photoSource&&!state.pano);el('refRender').classList.toggle('on',state.photoSource);
 el('photoList').replaceChildren();photoCatalog.forEach((p,i)=>{
  const b=button('',()=>{state.photo=i;drawPhotos()});b.className='photoCard'+(i===state.photo?' on':'');
  const img=document.createElement('img'),k=photoPath(p,false);img.src=window.ASSETS[k]||k;img.alt='';
  b.append(img,document.createTextNode(p.name));el('photoList').append(b)
 })
}
el('ownRender').onclick=()=>{state.pano=false;state.photoSource=false;drawPhotos()};el('refRender').onclick=()=>{state.pano=false;state.photoSource=true;drawPhotos()};
el('panoRender').onclick=()=>{state.pano=true;state.photoSource=false;drawPhotos()};
function photoView(i){
 const p=photoCatalog[i],r=roomTable[p.room];jumpRoom(p.room);
 player.x=p.from[0];player.z=p.from[1];player.eye=p.eye;player.feet=r[1]*upper;
 player.yaw=Math.atan2(-(p.to[0]-p.from[0]),-(p.to[1]-p.from[1]));player.pitch=p.pitch??-.042;
 needsFrame=true
}
el('walkPhoto').onclick=()=>{changeTab('model');state.cumulative=false;setStair('album');applyPhase('interior',false);setView('walk',false);photoView(state.photo);if(!state.photoSource&&state.pano&&window.lastPanoLook){player.yaw+=window.lastPanoLook.yaw;player.pitch=window.lastPanoLook.pitch}updateVisibility()};
function stationStart(){StairStudy.select('album');jumpRoom(4);applyPhase('interior',false);photoView(0);resize();updateVisibility();requestAnimationFrame(tick);el('bootmsg').hidden=true}
stationStart();
// Produce an annotated snapshot of the selected stage, using the model and plan
// canvases in the same render call. Browser controls are intentionally excluded.
el('snapshotBtn').onclick=()=>{
 render();
 const source=renderer.domElement,shot=document.createElement('canvas'),w=Math.max(900,source.width),ratio=w/source.width;
 const picture=Math.round(source.height*ratio),head=79,foot=93;
 shot.width=w;shot.height=picture+head+foot;
 const c=shot.getContext('2d');c.fillStyle='#f8f8f1';c.fillRect(0,0,shot.width,shot.height);
 c.fillStyle='#526054';c.font='600 13px "Segoe UI"';c.fillText('ЖК НАСТРОЕНИЕ  /  МОДЕЛЬ РЕМОНТА',24,25);
 c.fillStyle='#22352a';c.font='29px Georgia';c.fillText(phase().name,24,62);
 const mode={walk:'Прогулка',orbit:'Разрез 3D',plan:'План'}[state.view];
 c.font='600 15px "Segoe UI"';c.textAlign='right';c.fillText(mode+' · '+(state.floor+1)+' этаж',w-24,60);c.textAlign='left';
 c.drawImage(source,0,head,w,picture);
 if(state.view==='plan')c.drawImage(el('planInk'),0,head,w,picture);
 c.fillStyle='#2b4333';c.font='600 15px "Segoe UI"';
 const r=state.selected?BIM.byId.get(state.selected):null;
 c.fillText(r?r.id+' · '+r.name:(state.phase==='existing'?'Состояние по описанию владельца':'Проектный вариант')+' · '+[...state.systems].map(s=>systemInfo[s][0]).join(', '),24,head+picture+26,w-48);
 c.fillStyle='#506052';c.font='13px "Segoe UI"';const src=r?r.source:'PDF · страницы '+phase().pages.join(', ');
 c.fillText('Источник — '+src,24,head+picture+48,w-48);
 const stair=stairOn()?StairStudy.options.find(o=>o.id===state.stair).name:'без лестницы';
 c.fillText('Лестница — '+stair+'. Размеры и положение конструкций требуют обмера.',24,head+picture+70,w-48);
 shot.toBlob(b=>{if(!b){notify('Снимок не сохранён');return}const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='Настроение — '+phase().short+' — этаж '+(state.floor+1)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),1800);notify('Снимок этапа сохранён')},'image/png')
};
