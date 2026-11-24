const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url'),{spawn}=require('node:child_process');
const dir=path.resolve(__dirname,'..'),scratch=path.join(os.tmpdir(),'nastr-bim-review');
fs.mkdirSync(scratch,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){
 const launcher=process.env.BIM_CHROME||path.join(process.env.LOCALAPPDATA,'ms-playwright','chromium_headless_shell-1223','chrome-headless-shell-win64','chrome-headless-shell.exe');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nastr-chrome-'));
 const proc=spawn(launcher,['--headless','--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1380,850','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let output='';proc.stderr.on('data',b=>output+=b.toString());
 for(let i=0;i<180&&!output.includes('DevTools listening on');i++)await wait(100);
 const port=/ws:\/\/127.0.0.1:(\d+)/.exec(output)?.[1];if(!port){proc.kill();throw Error(output)}
 const target=(await(await fetch('http://127.0.0.1:'+port+'/json')).json()).find(t=>t.type==='page');
 const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map(),errors=[];
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let seq=0;
 ws.onmessage=e=>{const a=JSON.parse(e.data);if(a.id){const p=pending.get(a.id);if(!p)return;pending.delete(a.id);a.error?p.reject(Error(JSON.stringify(a.error))):p.resolve(a.result)}else if(a.method==='Runtime.exceptionThrown'){const er=a.params.exceptionDetails;errors.push(er.exception?.description||er.text)}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{let id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({method,params,id}))});
 const ev=async exp=>{const res=await send('Runtime.evaluate',{expression:exp,awaitPromise:true,returnByValue:true,userGesture:true});if(res.exceptionDetails)throw Error(res.exceptionDetails.exception?.description||res.exceptionDetails.text);return res.result.value};
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1380,height:850,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(path.join(dir,'Модель ремонта.html')).href});
 for(let i=0;i<150;i++){await wait(250);if(errors.length)throw Error(errors.join('\n'));if(await ev("!!document.getElementById('bootmsg')?.hidden"))break}
 if(!await ev("document.getElementById('bootmsg')?.hidden"))throw Error('App did not initialize');
 const shot=async name=>{await wait(350);const b=await send('Page.captureScreenshot',{format:'jpeg',quality:85});fs.writeFileSync(path.join(scratch,name+'.jpg'),Buffer.from(b.data,'base64'))};
 return {ev,send,shot,errors,close(){ws.close();proc.kill();},proc}
}
module.exports={start,dir,scratch};
if(require.main===module)(async()=>{const app=await start();try{
 console.log(await app.ev("({records:BIM.records.length, systems:Object.fromEntries(Object.keys(systemInfo).map(k=>[k,BIM.records.filter(r=>r.system===k).length])), stairs:StairStudy.options.map(x=>x.id),triangles:renderer.info.render.triangles})"));
 await app.shot('01-interior');
 await app.ev("applyPhase('plumbing');");await app.shot('02-plumbing');
 await app.ev("applyPhase('stairs');StairStudy.showComparison();");await app.shot('03-stairs');
 console.log('errors',app.errors)
 }finally{app.close()}})().catch(e=>{console.error(e);process.exit(1)});
