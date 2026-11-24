/* Data export runs against the same in-memory scene as the apartment viewer. */
const fs=require('node:fs'),path=require('node:path');
const {start,dir,scratch}=require('./browser.cjs');
function exporter(){
 const c=path.join(dir,'assets','core');
 const source=name=>fs.readFileSync(path.join(c,name),'utf8').replace(/^\uFEFF/,'');
 const globals=s=>s.replace(/import\s*\{([\s\S]*?)\}\s*from 'three';/,'const {$1}=THREE;');
 const util=globals(source('TextureUtils.source.txt')).replace('export function decompress','function decompress');
 const body=globals(source('GLTFExporter.source.txt')).replace(/import \{ decompress \}[^;]+;/,'').replace(/export \{ GLTFExporter \};/,'window.BimGLTFExporter=GLTFExporter;');
 return '(()=>{const decompress=(()=>{'+util+';return decompress})();'+body+'})()';
}
async function main(){
 const browser=await start();
 try{
  await browser.ev("setView('walk',false);setStair('album');applyPhase('interior',false);StairStudy.setFinish?.(true);updateVisibility();");
  for(let i=0;i<80;i++){if(await browser.ev("BIM.records.every(r=>{let ok=true;r.object.traverse(o=>{if(o.material?.map&&(!o.material.map.image||o.material.map.image.complete===false))ok=false});return ok})"))break;await new Promise(r=>setTimeout(r,220))}
  await browser.ev(exporter());
  for(const extra of [false,true]){
  await browser.ev('window.exportExtra='+extra);
  const bytes=await browser.ev(`(async()=>{
   const out=new THREE.Scene();
   for(const r of BIM.records){
    if(window.exportExtra===r.object.visible)continue;
    const clone=r.object.clone(true);clone.name=r.id;clone.visible=true;
    const remove=[];clone.traverse(m=>{if(m.userData.noPhysicalRender)remove.push(m)});
    remove.forEach(m=>m.removeFromParent());
    clone.userData={bim_id:r.id,room:r.room||'',element_name:r.name,source:r.source,phase:r.stage,level:r.level,system:r.system,variant:r.variant||'',status:r.status,note:r.note};
    out.add(clone)
   }
   const bin=await new BimGLTFExporter().parseAsync(out,{binary:true,onlyVisible:true,maxTextureSize:1024});
   window.glbBytes=new Uint8Array(bin);
   return bin.byteLength
  })()`);
  const file=fs.openSync(path.join(scratch,extra?'overlay.glb':'model.glb'),'w');
  try{for(let i=0;i<bytes;i+=210000){
   const b64=await browser.ev(`(()=>{const bytes=window.glbBytes.subarray(${i},${i+210000});const chunks=[];for(let j=0;j<bytes.length;j+=24000)chunks.push(String.fromCharCode(...bytes.subarray(j,j+24000)));return btoa(chunks.join(''))})()`);
   fs.writeSync(file,Buffer.from(b64,'base64'))
  }}finally{fs.closeSync(file)}
  console.log(extra?'Technical layers GLB:':'Render scene GLB:',bytes);
  }
  const meta=await browser.ev(`BIM.records.map(r=>({id:r.id,name:r.name,room:r.room||'',level:r.level,stage:r.stage,system:r.system,variant:r.variant||'',source:r.source,status:r.status,note:r.note,kind:r.kind||'',ifcClass:r.ifcClass||'',count:r.count??null,mountHeight:r.mountHeight??null,area:r.areaM2??null,pages:sourcePages(r)}))`);
  const ifcFile=fs.openSync(path.join(scratch,'ifc-elements.ndjson'),'w');
  try{
   for(const [i,r] of meta.entries()){
    if(r.variant&&r.variant!=='album')continue;
    const geometry=await browser.ev(`(()=>{
     const r=BIM.byId.get(${JSON.stringify(r.id)}),verts=[],faces=[],p=new THREE.Vector3(),bound=new THREE.Box3();
     r.object.updateWorldMatrix(true,true);
     let n=0;const meshes=[];r.object.traverse(m=>{if(m.isMesh&&!m.userData.noPhysicalRender){meshes.push(m);n+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3}});
     const proxy=(r.system==='interior'&&n>1200)||(r.system==='finishes'&&n>3500);
     if(proxy){
      for(const m of meshes)bound.expandByObject(m);
      const min=bound.min,max=bound.max;
      for(const z of [min.z,max.z])for(const y of [min.y,max.y])for(const x of [min.x,max.x])verts.push([x,-z,y].map(a=>Math.round(a*1e4)/1e4));
      faces.push([0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]);
     }else{
      const seen=new Map();
      for(const m of meshes){
       const attr=m.geometry.attributes.position,index=m.geometry.index,local=[];
       for(let i=0;i<attr.count;i++){
        p.fromBufferAttribute(attr,i).applyMatrix4(m.matrixWorld);
        const xyz=[p.x,-p.z,p.y].map(a=>Math.round(a*1e4)/1e4),k=xyz.join(',');
        if(!seen.has(k)){seen.set(k,verts.length);verts.push(xyz)}local.push(seen.get(k))
       }
       const count=index?index.count:attr.count;
       for(let i=0;i<count;i+=3){const a=local[index?index.getX(i):i],b=local[index?index.getX(i+1):i+1],c=local[index?index.getX(i+2):i+2];if(a!==b&&b!==c&&a!==c)faces.push([a,b,c])}
      }
     }
     return {verts,faces,proxy}
    })()`);
    fs.writeSync(ifcFile,JSON.stringify({...r,...geometry})+'\n');
   }
  }finally{fs.closeSync(ifcFile)}
  const data=await browser.ev("({rooms:roomTable,photos:photoCatalog,stages:Object.fromEntries(phases.map(p=>[p.id,p.name])),systems:systemInfo,csv:csvText(BIM.records)})");
  fs.writeFileSync(path.join(dir,'Передача','Ведомость элементов.csv'),data.csv);
  delete data.csv;fs.writeFileSync(path.join(scratch,'model-info.json'),JSON.stringify(data));
  console.log('Coordination metadata:',meta.length,'objects; browser errors:',browser.errors)
 }finally{browser.close()}
}
main().catch(e=>{console.error(e);process.exit(1)});
