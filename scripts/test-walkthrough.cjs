// task-010 B: 3D walkthrough (contentType walkthrough-3d). Real route handlers run against a temp cwd (never the real .local-data), like test-models.cjs.
// 1 limits and keyframe rules  2 no photos / intro regression  3 ownership (foreign model or view is 404, operator included) and invalid models
// 4 render snapshot: GLB copy is validated, served through the token route and removed  5 five-minute cap (fake worker)  6 real worker: own timer kills the tree, cancel removes the copy
const fs=require('fs'),os=require('os'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const ROOT=process.cwd(),BASE='http://studio.test';
function world({cwd,env={}}){
 const cache=new Map();
 // The real process, except cwd/env (spawn, kill and execPath are needed for the render worker).
 const fakeProcess=new Proxy(process,{get:(target,key)=>key==='cwd'?()=>cwd:key==='env'?env:typeof target[key]==='function'?target[key].bind(target):target[key]});
 const stubs={'server-only':{},'next/server':{after:()=>{},NextResponse:{next:()=>({}),json:(body,init={})=>({status:init.status||200,body})}}};
 function load(file){
  const key=path.resolve(file);if(cache.has(key))return cache.get(key).exports;
  const module={exports:{}};cache.set(key,module);
  const code=ts.transpileModule(fs.readFileSync(key,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const dir=path.dirname(key);
  const localRequire=id=>{
   if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id];
   if(id.startsWith('.')){const target=path.resolve(dir,id);if(id.endsWith('.json'))return require(target);for(const candidate of [target+'.ts',path.join(target,'index.ts')])if(fs.existsSync(candidate))return load(candidate);throw Error('cannot resolve '+id);}
   return require(id);
  };
  new Function('module','exports','require','process',code)(module,module.exports,localRequire,fakeProcess);
  return module.exports;
 }
 return {load};
}
function request(method,pathname,{cookie,json,body,headers={}}={}){
 const init={method,headers:{host:'studio.test',...(cookie?{cookie}:{}),...headers}};
 if(json!==undefined){init.body=JSON.stringify(json);init.headers['content-type']='application/json';init.headers['content-length']=String(Buffer.byteLength(init.body));}
 if(body!==undefined)init.body=body;
 if(!['GET','HEAD','OPTIONS'].includes(method))init.headers.origin=BASE;
 return new Request(BASE+pathname,init);
}
function glb(gltf={}){
 const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scenes:[{}],nodes:[{}],meshes:[{}],...gltf}));
 const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
 const header=Buffer.alloc(20);header.write('glTF',0,'ascii');header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
 return Buffer.concat([header,padded]);
}
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const waitFor=async(check,ms,label)=>{const end=Date.now()+ms;for(;;){const value=await check();if(value)return value;if(Date.now()>end)throw new Error('timeout: '+label);await new Promise(r=>setTimeout(r,200));}};

(async()=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'ms-walk-')),data=path.join(cwd,'.local-data'),scripts=path.join(cwd,'scripts'),workerFile=path.join(scripts,'render-worker.cjs');
 fs.mkdirSync(scripts,{recursive:true});
 const fakeWorker='setInterval(()=>{},1000);';
 fs.writeFileSync(workerFile,fakeWorker);
 process.env.NODE_PATH=path.join(ROOT,'node_modules'); // the copied real worker finds @remotion/* from the temp cwd
 const pids=[],junction=path.join(cwd,'remotion');
 fs.symlinkSync(path.join(ROOT,'remotion'),junction,'junction'); // the real worker bundles cwd/remotion
 try{
 const {load}=world({cwd,env:{REQUIREMENTS_ADMIN_EMAILS:'op@example.com'}});
 const accounts=load('lib/account-store.ts'),model=load('lib/model.ts'),glbCheck=load('lib/glb-validate.ts'),renderLib=load('lib/server/render.ts');
 const make=async(name,email)=>{const account=await accounts.writeAccount({name,email,password:'correct horse 123'});const token=await accounts.createSession({id:account.id,name,email});return {id:account.id,cookie:`${accounts.SESSION_COOKIE}=${token}`};};
 const A=await make('가','a@example.com'),B=await make('나','b@example.com'),OP=await make('운영자','op@example.com');
 const routes={
  models:load('app/api/models/route.ts'),views:load('app/api/models/[id]/views/route.ts'),
  content:load('app/api/content-projects/route.ts'),renders:load('app/api/renders/route.ts'),render:load('app/api/renders/[id]/route.ts'),
  cancel:load('app/api/renders/[id]/cancel/route.ts'),asset:load('app/api/renders/[id]/assets/[assetId]/route.ts'),
 };
 const call=(mod,method,pathname,who,options={},params={})=>mod[method](request(method,pathname,{cookie:who?.cookie,...options}),{params:Promise.resolve(params)});
 const upload=async(who,bytes,name='m.glb')=>{const form=new FormData();form.append('file',new File([bytes],name));const probe=new Response(form),body=Buffer.from(await probe.arrayBuffer());return call(routes.models,'POST','/api/models',who,{body,headers:{'content-type':probe.headers.get('content-type'),'content-length':String(body.length)}});};
 const cameraOf=(x,y,z)=>({position:[x,y,z],target:[0,5,0]});
 const addView=async(who,id,storeyCount,name,camera)=>{const res=await call(routes.views,'POST',`/api/models/${id}/views`,who,{json:{schemaVersion:1,name,camera,floors:Array(storeyCount).fill(true),exploded:false,background:'#101820'}},{id});assert.equal(res.status,201,'view '+name);return res.json();};

 // fixtures: A has the demo pavilion with two views, B has a tiny model with one view
 const demoBytes=fs.readFileSync(path.join(ROOT,'public','models','pavilion-demo.glb'));
 let res=await upload(A,demoBytes,'pavilion-demo.glb');assert.equal(res.status,201);const mA=await res.json();
 const v1=await addView(A,mA.id,mA.storeyCount,'앞',cameraOf(23,16,22)),v2=await addView(A,mA.id,mA.storeyCount,'뒤',cameraOf(-20,14,-24));
 res=await upload(B,glb(),'b.glb');assert.equal(res.status,201);const mB=await res.json();
 const vB=await addView(B,mB.id,mB.storeyCount,'B뷰',cameraOf(20,12,20));
 const scene=(modelId,views,times=[0,2.9],easing='easeInOut')=>({modelId,easing,keyframes:views.map((v,i)=>({viewId:v.id,camera:v.camera,atSeconds:times[i]}))});
 const project=(over={})=>({...JSON.parse(JSON.stringify(model.DEFAULT_PROJECT)),contentType:'walkthrough-3d',title:'워크스루',durationSeconds:3,fps:30,resolution:{width:1280,height:720},photos:[],brand:{...model.DEFAULT_PROJECT.brand,startSeconds:0,endSeconds:3},scene3d:scene(mA.id,[v1,v2]),...over});
 const withScene=(patch,over={})=>project({...over,scene3d:{...scene(mA.id,[v1,v2]),...patch}});
 const save=(who,p)=>call(routes.content,'POST','/api/content-projects',who,{json:p});
 const startRender=(who,p)=>call(routes.renders,'POST','/api/renders',who,{json:{project:p}});

 // ---- 1. limits and keyframe rules
 model.validateProject(project());
 const kf=(n)=>Array.from({length:n},(_,i)=>({viewId:v1.id,camera:v1.camera,atSeconds:i*.3}));
 const bad={
  '1080p':project({resolution:{width:1920,height:1080}}),'portrait 720p':project({resolution:{width:720,height:1280}}),
  '60fps':project({fps:60}),'11 seconds':project({durationSeconds:11,brand:{...model.DEFAULT_PROJECT.brand,startSeconds:0,endSeconds:11}}),
  'no scene3d':project({scene3d:undefined}),
  '1 keyframe':withScene({keyframes:kf(1)}),'9 keyframes':withScene({keyframes:kf(9)}),
  'equal times':withScene({keyframes:[{...kf(2)[0],atSeconds:1},{...kf(2)[1],atSeconds:1}]}),
  'decreasing times':withScene({keyframes:[{...kf(2)[0],atSeconds:2},{...kf(2)[1],atSeconds:1}]}),
  'negative time':withScene({keyframes:[{...kf(2)[0],atSeconds:-1},{...kf(2)[1],atSeconds:1}]}),
  'last keyframe on the frame after the end (3s clip)':withScene({keyframes:[{...kf(2)[0],atSeconds:0},{...kf(2)[1],atSeconds:3}]}),
  'creative on a walkthrough':project({creative:{heading:'x',rows:[]}}),'templateId on a walkthrough':project({templateId:'ranking-countdown'}),
  'time past the end':withScene({keyframes:[{...kf(2)[0],atSeconds:0},{...kf(2)[1],atSeconds:3.5}]}),
  'camera too close':withScene({keyframes:[{...kf(2)[0],camera:{position:[3,5,0],target:[0,5,0]}},kf(2)[1]]}),
  'camera too far':withScene({keyframes:[{...kf(2)[0],camera:{position:[70,5,0],target:[0,5,0]}},kf(2)[1]]}),
  'camera below horizon':withScene({keyframes:[{...kf(2)[0],camera:{position:[30,-2,0],target:[0,5,0]}},kf(2)[1]]}),
  'camera NaN':withScene({keyframes:[{...kf(2)[0],camera:{position:[null,5,0],target:[0,5,0]}},kf(2)[1]]}),
  'unknown easing':withScene({easing:'bounce'}),'unknown scene field':withScene({extra:1}),
  'scene3d on an intro':{...model.DEFAULT_PROJECT,photos:[],scene3d:scene(mA.id,[v1,v2])},
 };
 for(const [label,p] of Object.entries(bad)){assert.throws(()=>model.validateProject(p),Error,label);}
 for(const label of ['1080p','60fps','11 seconds','1 keyframe','9 keyframes','decreasing times','camera too far']){res=await save(A,bad[label]);assert.equal(res.status,400,'route: '+label);res=await startRender(A,bad[label]);assert.equal(res.status,400,'render route: '+label);}
 assert.ok(!fs.existsSync(path.join(data,'render.lock')),'refused renders leave no lock');
 model.validateProject(project({durationSeconds:10,brand:{...model.DEFAULT_PROJECT.brand,startSeconds:0,endSeconds:10}}));
 model.validateProject(withScene({keyframes:kf(8)}));
 model.validateProject(withScene({keyframes:[{...kf(2)[0],atSeconds:0},{...kf(2)[1],atSeconds:89/30}]}));assert.equal(model.lastFrameSeconds(3,30),89/30);
 // placeStoreys: numeric storeyId nodes sit at elevationM (or floor*3.6), roof at its elevationM, others stay
 const node=(userData,y=9)=>({userData,position:{y}}),nodes=[node({storeyId:'02',elevationM:3.6}),node({storeyId:'03'}),node({storeyId:'x1'}),node({system:'roof',elevationM:11}),node({})];
 model.placeStoreys({traverse:visit=>nodes.forEach(visit)});assert.deepEqual(nodes.map(n=>n.position.y),[3.6,7.2,9,11,9],'floor-height branch');
 const linear={modelId:mA.id,easing:'linear',keyframes:[{viewId:'a',camera:{position:[0,0,20],target:[0,0,0]},atSeconds:1},{viewId:'b',camera:{position:[10,0,20],target:[0,0,0]},atSeconds:3}]};
 assert.deepEqual(model.cameraAt(linear,0).position,[0,0,20]);assert.deepEqual(model.cameraAt(linear,2).position,[5,0,20]);assert.deepEqual(model.cameraAt(linear,9).position,[10,0,20]);
 assert.equal(model.cameraAt({...linear,easing:'easeInOut'},2).position[0],5);assert.ok(model.cameraAt({...linear,easing:'easeInOut'},1.5).position[0]<2.5);
 console.log('PASS: 3D limits (720p, 30fps, 10s), 2~8 monotonic keyframes and camera ranges give 400; cameraAt holds and interpolates');

 // ---- 2. no photos, camera copied from the view, intro regression
 const tampered=withScene({keyframes:[{viewId:v1.id,camera:cameraOf(40,20,40),atSeconds:0},{viewId:v2.id,camera:cameraOf(-40,20,40),atSeconds:2.9}]});
 res=await save(A,tampered);assert.equal(res.status,201,'zero photos allowed');const saved=await res.json();
 assert.deepEqual(saved.photos,[]);assert.deepEqual(saved.scene3d.keyframes.map(k=>k.camera),[v1.camera,v2.camera],'saved cameras are copies of the views, not what the client sent');
 assert.equal(saved.ownerId,A.id);
 model.validateProject({...model.DEFAULT_PROJECT,photos:[]});
 res=await startRender(A,{...model.DEFAULT_PROJECT,id:'preview',photos:[]});assert.equal(res.status,400);assert.match((await res.json()).error,/사진/,'an intro without photos is still refused');
 assert.ok(!fs.existsSync(path.join(data,'render.lock')));
 console.log('PASS: walkthrough with zero photos saves with the view cameras copied; the intro keeps its photo requirement');

 // ---- 3. ownership and invalid models (404 for foreign ids, operator included)
 for(const [who,label] of [[B,'other account'],[OP,'operator']]){
  res=await save(who,project());assert.equal(res.status,404,label+' save with a foreign model');
  res=await startRender(who,project());assert.equal(res.status,404,label+' render with a foreign model');
 }
 const ownB=project({scene3d:scene(mB.id,[vB],[0])});
 res=await save(B,{...ownB,scene3d:{...scene(mB.id,[vB,{...vB}],[0,2.9])}});assert.equal(res.status,201,'own model and view pass');
 res=await save(B,{...ownB,scene3d:{...scene(mB.id,[vB,v1],[0,2.9])}});assert.equal(res.status,404,'a view of another model');
 res=await save(A,{...ownB,scene3d:scene(mB.id,[vB,vB],[0,2.9])});assert.equal(res.status,404,'A with the model of B');
 res=await save(A,project({scene3d:scene(mA.id,[v1,{...v2,id:'00000000-0000-0000-0000-000000000000'}])}));assert.equal(res.status,404,'unknown view id');
 res=await save(A,project({scene3d:scene('11111111-1111-1111-1111-111111111111',[v1,v2])}));assert.equal(res.status,404,'unknown model id');
 res=await upload(A,glb(),'invalid.glb');const mInvalid=await res.json();const vI=await addView(A,mInvalid.id,mInvalid.storeyCount,'x',cameraOf(20,12,20));
 const invalidJson=path.join(data,'models',mInvalid.id+'.json');fs.writeFileSync(invalidJson,JSON.stringify({...JSON.parse(fs.readFileSync(invalidJson,'utf8')),invalid:'검증 실패'}));
 res=await save(A,project({scene3d:scene(mInvalid.id,[vI,vI],[0,2.9])}));assert.equal(res.status,400,'invalid model refused on save');
 res=await startRender(A,project({scene3d:scene(mInvalid.id,[vI,vI],[0,2.9])}));assert.equal(res.status,400,'invalid model refused on render');
 assert.ok(!fs.existsSync(path.join(data,'render.lock')));
 console.log('PASS: foreign models and views are 404 (operator too), invalid models are 400');

 // ---- 4. the snapshot copy is validated again, served through the token route and gone after the render
 res=await upload(A,glb(),'tamper.glb');const mT=await res.json();const vT=await addView(A,mT.id,mT.storeyCount,'t',cameraOf(20,12,20));
 const tamperedGlb=glb({extensionsUsed:['EXT_meshopt_compression']}); // passed validation when uploaded, bad now
 fs.writeFileSync(path.join(data,'models',mT.id+'.glb'),tamperedGlb);
 res=await startRender(A,project({scene3d:scene(mT.id,[vT,vT],[0,2.9])}));assert.equal(res.status,400,'the copy is validated, not just the upload');assert.match((await res.json()).error,/meshopt|압축/);
 assert.ok(!fs.existsSync(path.join(data,'render.lock')),'failed start releases the lock');
 const leftovers=fs.existsSync(path.join(data,'render-files'))?fs.readdirSync(path.join(data,'render-files')).flatMap(id=>fs.existsSync(path.join(data,'render-files',id,'assets'))?fs.readdirSync(path.join(data,'render-files',id,'assets')):[]):[];
 assert.deepEqual(leftovers,[],'no model copy left after a refused start');

 // the render trusts the saved cameras: a keyframe whose view was deleted still renders
 res=await startRender(A,project({scene3d:{...scene(mA.id,[v1,v2]),keyframes:[{viewId:'deleted-view',camera:v1.camera,atSeconds:0},{viewId:v2.id,camera:v2.camera,atSeconds:2.9}]}}));assert.equal(res.status,202,'deleted view does not fail the render');const job1=await res.json();pids.push(job1.pid);
 const dir1=path.join(data,'render-files',job1.id),assetId='model-'+mA.id,copy=path.join(dir1,'assets',assetId);
 assert.ok(fs.readFileSync(copy).equals(demoBytes),'snapshot holds a byte copy of the GLB');glbCheck.validateGlb(fs.readFileSync(copy));
 const input=JSON.parse(fs.readFileSync(path.join(dir1,'input.json'),'utf8'));
 assert.equal(input.model.assetId,assetId);assert.equal(input.model.mimeType,'model/gltf-binary');assert.equal(input.edits,null,'edit slot exists and is empty');
 assert.deepEqual(input.project.scene3d.keyframes.map(k=>k.camera),[v1.camera,v2.camera]);
 const token=JSON.parse(fs.readFileSync(path.join(data,'renders',job1.id+'.json'),'utf8')).assetToken;
 assert.ok(input.model.url.endsWith(`/api/renders/${job1.id}/assets/${assetId}?token=${token}`));
 const getAsset=(who,query)=>call(routes.asset,'GET',`/api/renders/${job1.id}/assets/${assetId}${query}`,who,{},{id:job1.id,assetId});
 res=await getAsset(null,'?token='+token);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'model/gltf-binary');assert.ok(Buffer.from(await res.arrayBuffer()).equals(demoBytes));
 assert.equal((await getAsset(null,'?token=wrong')).status,404);assert.equal((await getAsset(null,'')).status,404);assert.equal((await getAsset(B,'')).status,404);assert.equal((await getAsset(A,'')).status,200,'owner session works without a token');
 res=await call(routes.render,'GET','/x',A,{},{id:job1.id});const publicJob=await res.json();assert.equal(publicJob.assetToken,undefined);
 res=await startRender(A,project());assert.equal(res.status,400,'one render at a time (global lock)');
 console.log('PASS: the copy is validated again, served on the token path (wrong token / other account 404)');

 // ---- 5. five minutes: a live worker is killed and the job fails; the copy goes away
 assert.ok(alive(job1.pid));
 const jobFile=path.join(data,'renders',job1.id+'.json');
 let jobJson=JSON.parse(fs.readFileSync(jobFile,'utf8'));jobJson.createdAt=new Date(Date.now()-4*60*1000).toISOString();fs.writeFileSync(jobFile,JSON.stringify(jobJson));
 res=await call(routes.render,'GET','/x',A,{},{id:job1.id});assert.notEqual((await res.json()).status,'failed','4 minutes is still within the cap');assert.ok(alive(job1.pid));
 jobJson=JSON.parse(fs.readFileSync(jobFile,'utf8'));jobJson.createdAt=new Date(Date.now()-5*60*1000-5000).toISOString();jobJson.updatedAt=new Date().toISOString();jobJson.workerToken='fake-token';fs.writeFileSync(jobFile,JSON.stringify(jobJson));
 res=await call(routes.render,'GET','/x',A,{},{id:job1.id});const timedOut=await res.json();
 assert.equal(timedOut.workerToken,undefined,'worker token is not public');assert.equal(timedOut.status,'failed');assert.match(timedOut.error,/5분/);
 await waitFor(()=>!alive(job1.pid),10000,'worker killed');
 assert.ok(!fs.existsSync(copy),'model copy removed when the job is failed by the cap');
 console.log('PASS: a job past five minutes is failed with its live worker killed and the GLB copy removed');

 // ---- 6. real worker: own timer, and cancel (both remove the copy and release the lock)
 const realWorker=fs.readFileSync(path.join(ROOT,'scripts','render-worker.cjs'),'utf8');
 assert.ok(realWorker.includes(',300000)'),'worker limit constant');
 // a worker without our token/heartbeat is never killed (pid reuse): the job is only marked failed
 const stranger=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)']);pids.push(stranger.pid);
 const oldIso=new Date(Date.now()-6*60*1000).toISOString();fs.writeFileSync(path.join(data,'renders','stranger.json'),JSON.stringify({id:'stranger',projectId:'x',projectSnapshot:{contentType:'walkthrough-3d'},status:'processing',progress:0,stage:'x',createdAt:oldIso,updatedAt:new Date().toISOString(),pid:stranger.pid}));
 assert.equal((await renderLib.getJob('stranger')).status,'failed');assert.ok(alive(stranger.pid),'no token: not killed');
 // a stale GLB copy of a finished job is swept by the next start
 fs.mkdirSync(path.join(data,'render-files',job1.id,'assets'),{recursive:true});fs.writeFileSync(path.join(data,'render-files',job1.id,'assets','model-stale'),'x');
 const startReal=async()=>{res=await startRender(A,project());assert.equal(res.status,202);const job=await res.json();pids.push(job.pid);return job;};
 fs.writeFileSync(workerFile,realWorker.replace(',300000)',',2500)'));
 const job2=await startReal();
 assert.ok(!fs.existsSync(path.join(data,'render-files',job1.id,'assets','model-stale')),'leftover copy of a finished job removed on start');
 const failed2=await waitFor(()=>{const j=JSON.parse(fs.readFileSync(path.join(data,'renders',job2.id+'.json'),'utf8'));return j.status==='failed'&&j;},60000,'worker timer');
 assert.match(failed2.error,/5분/);
 await waitFor(()=>!alive(failed2.pid),15000,'worker exited');
 assert.ok(!fs.existsSync(path.join(data,'render-files',job2.id,'assets','model-'+mA.id)),'timer removed the copy');assert.ok(!fs.existsSync(path.join(data,'render.lock')),'timer released the lock');
 fs.writeFileSync(workerFile,realWorker);
 const job3=await startReal();
 assert.ok(fs.existsSync(path.join(data,'render-files',job3.id,'assets','model-'+mA.id)));
 res=await call(routes.cancel,'POST','/x',A,{},{id:job3.id});assert.equal(res.status,200);
 const canceled=await waitFor(async()=>{const j=await (await call(routes.render,'GET','/x',A,{},{id:job3.id})).json();return j.status==='canceled'&&j;},120000,'worker cancel');
 await waitFor(()=>!fs.existsSync(path.join(data,'render.lock')),10000,'lock released');
 assert.ok(!fs.existsSync(path.join(data,'render-files',job3.id,'assets','model-'+mA.id)),'cancel removed the copy');
 assert.equal(canceled.status,'canceled');
 console.log('PASS: the worker kills itself at the cap and a canceled render removes the GLB copy; the lock is released');
 }finally{
  for(const pid of pids)try{if(pid)process.kill(pid,'SIGKILL');}catch{}
  await new Promise(r=>setTimeout(r,500));
  try{fs.rmdirSync(junction);}catch{} // remove the link only, never the target
  fs.rmSync(cwd,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
