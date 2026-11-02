// task-010 plan A: GLB upload validation, upload concurrency limit, saved views (owner rules, schema, queue) and models:revalidate.
// Real route handlers run against a temp cwd (never the real .local-data), like test-ownership.cjs.
const fs=require('fs'),os=require('os'),path=require('path'),ts=require('typescript'),assert=require('assert/strict'),crypto=require('crypto');
const {spawn}=require('child_process');
const ROOT=process.cwd(),BASE='http://studio.test',NF={error:'찾을 수 없습니다.'};
function world({cwd,env={}}){
 const cache=new Map(),fakeProcess={cwd:()=>cwd,env,platform:process.platform,stdout:process.stdout,stderr:process.stderr};
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
function request(method,pathname,{cookie,json,form,body,headers={}}={}){
 const init={method,headers:{host:'studio.test',...(cookie?{cookie}:{}),...headers}};
 if(json!==undefined){init.body=JSON.stringify(json);init.headers['content-type']='application/json';init.headers['content-length']=String(Buffer.byteLength(init.body));}
 if(body!==undefined)init.body=body;
 if(form)init.body=form;
 if(!['GET','HEAD','OPTIONS'].includes(method))init.headers.origin=BASE;
 return new Request(BASE+pathname,init);
}
// Real clients send Content-Length; a multipart form is serialized once to learn it.
async function sized(options){
 if(!options.form)return options;
 const probe=new Response(options.form),bytes=Buffer.from(await probe.arrayBuffer());
 return {...options,form:undefined,body:bytes,headers:{...(options.headers||{}),'content-type':probe.headers.get('content-type'),'content-length':String(bytes.length)}};
}
// GLB builder: gltf object plus optional BIN chunk.
function glb(gltf={},bin){
 const base={asset:{version:'2.0'},scenes:[{}],nodes:[{}],meshes:[{}]};
 const json=Buffer.from(JSON.stringify({...base,...gltf}));
 const paddedJson=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
 const paddedBin=bin?Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]):null;
 const total=12+8+paddedJson.length+(paddedBin?8+paddedBin.length:0);
 const header=Buffer.alloc(20);header.write('glTF',0,'ascii');header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);header.writeUInt32LE(paddedJson.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const parts=[header,paddedJson];
 if(paddedBin){const chunk=Buffer.alloc(8);chunk.writeUInt32LE(paddedBin.length,0);chunk.writeUInt32LE(0x004e4942,4);parts.push(chunk,paddedBin);}
 return Buffer.concat(parts);
}
function png(width,height){const b=Buffer.alloc(33);Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(b);b.writeUInt32BE(13,8);b.write('IHDR',12,'ascii');b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);return b;}
const withImage=size=>glb({images:[{bufferView:0,mimeType:'image/png'}],bufferViews:[{buffer:0,byteOffset:0,byteLength:33}],buffers:[{byteLength:36}]},png(size,size));
// A port nobody listens on (fetch refuses port 9 as a bad port, which would look like an uncertain answer).
let DEAD_URL='http://127.0.0.1:1';
const pickDeadPort=()=>new Promise(resolve=>{const server=require('net').createServer();server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>resolve(`http://127.0.0.1:${port}`));});});
const run=(args,{cwd,url})=>new Promise(resolve=>{
 const child=spawn(process.execPath,[path.join(ROOT,'scripts','models-revalidate.cjs'),...args],{cwd,env:{...process.env,MOTION_STUDIO_URL:url||DEAD_URL}});
 let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);child.on('close',status=>resolve({status,stdout,stderr}));
});

(async()=>{
 DEAD_URL=await pickDeadPort();
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'ms-models-')),data=path.join(cwd,'.local-data'),modelDir=path.join(data,'models');
 const {load}=world({cwd,env:{REQUIREMENTS_ADMIN_EMAILS:'op@example.com'}});
 const accounts=load('lib/account-store.ts');
 const make=async(name,email)=>{const account=await accounts.writeAccount({name,email,password:'correct horse 123'});const token=await accounts.createSession({id:account.id,name,email});return {id:account.id,cookie:`${accounts.SESSION_COOKIE}=${token}`};};
 const A=await make('가','a@example.com'),B=await make('나','b@example.com'),OP=await make('운영자','op@example.com');
 const routes={
  list:load('app/api/models/route.ts'),item:load('app/api/models/[id]/route.ts'),
  views:load('app/api/models/[id]/views/route.ts'),view:load('app/api/models/[id]/views/[viewId]/route.ts'),
 };
 const slots=load('lib/server/cad-models.ts');
 const call=async(mod,method,pathname,who,options={},params={})=>mod[method](request(method,pathname,{cookie:who?.cookie,...await sized(options)}),{params:Promise.resolve(params)});
 const upload=(who,bytes,name='m.glb')=>{const form=new FormData();form.append('file',new File([bytes],name));return call(routes.list,'POST','/api/models',who,{form});};
 const views=(method,who,id,json)=>call(routes.views,method,`/api/models/${id}/views`,who,json===undefined?{}:{json},{id});
 const oneView=(method,who,id,viewId,json)=>call(routes.view,method,`/api/models/${id}/views/${viewId}`,who,json===undefined?{}:{json},{id,viewId});
 let res;

 // ---- 1. upload validation
 const bad={
  'external buffer uri':glb({buffers:[{byteLength:4,uri:'http://evil.example/a.bin'}]}),
  'relative buffer uri':glb({buffers:[{byteLength:4,uri:'a.bin'}]}),
  'data buffer uri':glb({buffers:[{byteLength:4,uri:'data:application/octet-stream;base64,AAAA'}]}),
  'external image uri':glb({images:[{uri:'file:///etc/passwd'}]}),
  'data image uri':glb({images:[{uri:'data:image/png;base64,AAAA'}]}),
  'draco required':glb({extensionsRequired:['KHR_draco_mesh_compression']}),
  'meshopt required':glb({extensionsRequired:['EXT_meshopt_compression']}),
  'ktx2 required':glb({extensionsRequired:['KHR_texture_basisu']}),
  'texture over 2048px':withImage(4096),
  'too many textures':glb({images:Array.from({length:65},()=>({bufferView:0}))},png(8,8)),
  'nodes over 10000':glb({nodes:Array.from({length:10001},()=>({}))}),
  'accessors over 20000':glb({accessors:Array.from({length:20001},()=>({}))}),
  'json over 4MiB':glb({extras:'x'.repeat(4*1024*1024+16)}),
 };
 for(const [label,bytes] of Object.entries(bad)){res=await upload(A,bytes);assert.equal(res.status,400,label);assert.ok((await res.json()).error,label);}
 assert.deepEqual(fs.existsSync(modelDir)?fs.readdirSync(modelDir):[],[],'refused uploads leave no files');
 const good={'texture exactly 2048px':withImage(2048),'allowed extensions':glb({extensionsRequired:['KHR_materials_pbrSpecularGlossiness','KHR_materials_emissive_strength','KHR_texture_transform','KHR_mesh_quantization']})};
 for(const [label,bytes] of Object.entries(good)){res=await upload(A,bytes);assert.equal(res.status,201,label);await call(routes.item,'DELETE','/x',A,{},{id:(await res.json()).id});}
 const demoBytes=fs.readFileSync(path.join(ROOT,'public','models','pavilion-demo.glb'));
 res=await upload(A,demoBytes,'pavilion-demo.glb');assert.equal(res.status,201,'demo pavilion passes');
 const demo=await res.json();assert.ok(demo.storeyCount>0&&demo.nodeCount>0);
 console.log('PASS: upload validation — external/data uri, disallowed extensions, texture/node/accessor/JSON caps give 400 with no files left; the demo pavilion passes');

 res=await call(routes.list,'POST','/api/models',A,{body:Buffer.from('x')});assert.equal(res.status,411,'no Content-Length');
 res=await call(routes.list,'POST','/api/models',A,{body:Buffer.from('x'),headers:{'content-length':'abc'}});assert.equal(res.status,411,'NaN Content-Length');

 // ---- 2. concurrent uploads
 const held=[slots.acquireUploadSlot(),slots.acquireUploadSlot()];assert.ok(held[0]&&held[1]);
 assert.equal(slots.acquireUploadSlot(),null);
 res=await upload(A,glb());assert.equal(res.status,429);
 held[0]();held[0]();res=await upload(A,glb());assert.equal(res.status,201,'slot released (double release counts once)');
 held[1]();
 console.log('PASS: third concurrent upload gets 429, slots free after release');

 // ---- 3. views
 const view=(extra={})=>({schemaVersion:1,name:'정면',camera:{position:[23,16,22],target:[0,5.2,0]},floors:Array(demo.storeyCount).fill(true),exploded:false,background:'#101722',...extra});
 res=await views('POST',A,demo.id,view());assert.equal(res.status,201);const v1=await res.json();assert.match(v1.id,/^[0-9a-f-]{36}$/);
 assert.equal((await (await views('GET',A,demo.id)).json()).length,1);
 assert.equal((await oneView('GET',A,demo.id,v1.id)).status,200);
 res=await oneView('PUT',A,demo.id,v1.id,view({name:'측면',exploded:true}));assert.equal(res.status,200);assert.equal((await res.json()).name,'측면');
 assert.equal((await (await call(routes.item,'GET','/x',A,{},{id:demo.id})).json()).views[0].exploded,true);
 for(const who of [B,OP]){
  const label=who===B?'B':'operator';
  for(const [method,fn] of [['POST',()=>views('POST',who,demo.id,view())],['PUT',()=>oneView('PUT',who,demo.id,v1.id,view())],['DELETE',()=>oneView('DELETE',who,demo.id,v1.id)]]){
   const r=await fn();assert.equal(r.status,404,`${label} ${method}`);assert.deepEqual(await r.json(),NF);
  }
 }
 for(const fn of [()=>views('GET',B,demo.id),()=>oneView('GET',B,demo.id,v1.id)]){const r=await fn();assert.equal(r.status,404);assert.deepEqual(await r.json(),NF);}
 assert.equal((await views('GET',OP,demo.id)).status,200,'operator may view');
 assert.equal((await (await views('GET',A,demo.id)).json()).length,1,'foreign attempts changed nothing');
 res=await oneView('GET',A,demo.id,crypto.randomUUID());assert.equal(res.status,404);
 console.log('PASS: view create/read/update — B session and operator change get the fixed 404, nothing changed, operator view allowed');

 const bodyOf=json=>({body:Buffer.from(JSON.stringify(json))});
 res=await call(routes.views,'POST','/x',A,bodyOf(view()),{id:demo.id});assert.equal(res.status,411,'view POST without Content-Length');
 res=await call(routes.view,'PUT','/x',A,bodyOf(view()),{id:demo.id,viewId:v1.id});assert.equal(res.status,411,'view PUT without Content-Length');
 for(const [mod,method,params] of [[routes.views,'POST',{id:demo.id}],[routes.view,'PUT',{id:demo.id,viewId:v1.id}]]){res=await call(mod,method,'/x',A,{...bodyOf(view()),headers:{'content-length':'9000'}},params);assert.equal(res.status,413,'view body over 8KB '+method);}
 const invalid={
  'schemaVersion 2':view({schemaVersion:2}),'no schemaVersion':(({schemaVersion,...rest})=>rest)(view()),'unknown field':view({keyframes:[]}),'client id':view({id:crypto.randomUUID()}),
  'empty name':view({name:'  '}),'long name':view({name:'가'.repeat(61)}),'floors length':view({floors:[true]}),'floors type':view({floors:Array(demo.storeyCount).fill(1)}),
  'exploded type':view({exploded:'yes'}),'background':view({background:'red'}),'unknown camera field':view({camera:{position:[23,16,22],target:[0,5.2,0],fov:50}}),
  'string coordinate':view({camera:{position:[23,'16',22],target:[0,5.2,0]}}),'too close':view({camera:{position:[1,5.2,0],target:[0,5.2,0]}}),'too far':view({camera:{position:[100,5.2,0],target:[0,5.2,0]}}),
  'below horizon':view({camera:{position:[0,0,30],target:[0,5.2,0]}}),'huge coordinate':view({camera:{position:[5000,0,0],target:[0,0,0]}}),
 };
 for(const [label,body] of Object.entries(invalid)){res=await views('POST',A,demo.id,body);assert.equal(res.status,400,label);}
 res=await views('POST',A,demo.id,null);assert.equal(res.status,400);
 assert.equal((await oneView('PUT',A,demo.id,v1.id,view({schemaVersion:2}))).status,400);
 const edge=view({camera:{position:[0,5.2+12*Math.cos(Math.PI*0.48),12*Math.sin(Math.PI*0.48)],target:[0,5.2,0]}});
 assert.equal((await views('POST',A,demo.id,edge)).status,201,'range edge is accepted');
 for(let i=0;i<18;i++)assert.equal((await views('POST',A,demo.id,view({name:'v'+i}))).status,201);
 res=await views('POST',A,demo.id,view());assert.equal(res.status,400,'21st view');
 assert.equal((await (await views('GET',A,demo.id)).json()).length,20);
 // a model without storeys takes an empty floors array
 res=await upload(A,glb());const plain=await res.json();assert.equal(plain.storeyCount,0);
 assert.equal((await views('POST',A,plain.id,view({floors:[]}))).status,201);assert.equal((await views('POST',A,plain.id,view({floors:[true]}))).status,400);
 // concurrent writes are serialized: none lost
 const burst=await Promise.all(Array.from({length:5},(_,i)=>views('POST',A,plain.id,view({floors:[],name:'burst'+i}))));
 assert.ok(burst.every(r=>r.status===201));assert.equal((await (await views('GET',A,plain.id)).json()).length,6);
 res=await oneView('DELETE',A,demo.id,v1.id);assert.equal(res.status,200);assert.equal((await oneView('GET',A,demo.id,v1.id)).status,404);
 console.log('PASS: view schema — version/fields/ranges/floors give 400, 21st view 400, concurrent writes keep all, delete works');

 // ---- 4. deleted .glb is not revived by a view write
 const jsonFile=path.join(modelDir,plain.id+'.json'),before=fs.readFileSync(jsonFile,'utf8');
 fs.rmSync(path.join(modelDir,plain.id+'.glb'));
 res=await views('POST',A,plain.id,view({floors:[]}));assert.equal(res.status,404);assert.deepEqual(await res.json(),NF);
 assert.equal((await oneView('DELETE',A,plain.id,JSON.parse(before).views[0].id)).status,404);
 assert.equal(fs.readFileSync(jsonFile,'utf8'),before,'JSON untouched');
 // a model deleted through the API: the next view write is a plain 404 and creates nothing
 res=await call(routes.item,'DELETE','/x',A,{},{id:demo.id});assert.equal(res.status,200);
 res=await views('POST',A,demo.id,view());assert.equal(res.status,404);assert.ok(!fs.existsSync(path.join(modelDir,demo.id+'.json')),'JSON not revived');
 console.log('PASS: view write after the .glb or model is gone gives 404 and does not recreate/modify the JSON');

 // ---- 5. models:revalidate
 const okId=crypto.randomUUID(),badId=crypto.randomUUID(),lostId=crypto.randomUUID();
 const record=id=>({ownerId:A.id,id,name:'x.glb',sizeBytes:1,createdAt:new Date().toISOString(),gltfVersion:'2.0',sceneCount:1,nodeCount:1,meshCount:1,materialCount:0,storeyCount:0});
 for(const [id,bytes] of [[okId,glb()],[badId,glb({buffers:[{byteLength:4,uri:'http://evil.example/a.bin'}]})]]){fs.writeFileSync(path.join(modelDir,id+'.glb'),bytes);fs.writeFileSync(path.join(modelDir,id+'.json'),JSON.stringify(record(id)));}
 fs.writeFileSync(path.join(modelDir,lostId+'.json'),JSON.stringify(record(lostId)));
 const snapshot=()=>Object.fromEntries(fs.readdirSync(modelDir).map(n=>[n,fs.readFileSync(path.join(modelDir,n),'hex')]));
 const beforeAll=snapshot();
 let out=await run(['--dry-run'],{cwd});assert.equal(out.status,0,out.stderr);
 assert.match(out.stdout,/\[dry-run\].*invalid 표시/);assert.deepEqual(snapshot(),beforeAll,'dry-run changes nothing');
 out=await run([],{cwd});assert.equal(out.status,0,out.stderr);
 const read=id=>JSON.parse(fs.readFileSync(path.join(modelDir,id+'.json'),'utf8'));
 assert.ok(read(badId).invalid&&read(lostId).invalid);assert.equal(read(okId).invalid,undefined);
 assert.match(out.stdout,/invalid 3 \(파일 없음 2\)/);
 // an invalid model refuses views; the others keep working
 assert.equal((await views('POST',A,badId,view({floors:[]}))).status,400);
 assert.equal((await views('POST',A,okId,view({floors:[]}))).status,201);
 out=await run([],{cwd});assert.match(out.stdout,/표시 변경 0/,'second run is a no-op');
 fs.writeFileSync(path.join(modelDir,badId+'.glb'),glb());
 out=await run([],{cwd});assert.equal(read(badId).invalid,undefined,'passing again clears the mark');
 assert.equal((await run(['--bogus'],{cwd})).status,1);
 // a JSON that is not an object is skipped on its own; the rest is still processed
 for(const [name,text] of [['null','null'],['array','[]'],['number','7']])fs.writeFileSync(path.join(modelDir,`${crypto.randomUUID()}.json`),text);
 out=await run([],{cwd});assert.equal(out.status,0,out.stderr);assert.equal((out.stdout.match(/건너뜀/g)||[]).length,3,'three non-object files skipped');
 // an invalid model still allows deleting its views, but not saving or editing
 const keep=(await (await views('GET',A,okId)).json())[0];
 fs.writeFileSync(path.join(modelDir,okId+'.glb'),glb({buffers:[{byteLength:4,uri:'http://evil.example/a.bin'}]}));
 await run([],{cwd});assert.ok(read(okId).invalid);
 assert.equal((await views('POST',A,okId,view({floors:[]}))).status,400);
 assert.equal((await oneView('PUT',A,okId,keep.id,view({floors:[]}))).status,400);
 assert.equal((await oneView('DELETE',A,okId,keep.id)).status,200);assert.equal((await (await views('GET',A,okId)).json()).length,0);
 // a server that accepts the connection but never answers is uncertain: stop, do not proceed
 const hang=require('net').createServer(()=>{});await new Promise(resolve=>hang.listen(0,'127.0.0.1',resolve));
 out=await run([],{cwd,url:`http://127.0.0.1:${hang.address().port}`});hang.close();assert.equal(out.status,1,'timeout counts as a running server');
 console.log('PASS: models:revalidate — dry-run changes nothing, invalid/missing models are marked and refuse views, rerun is idempotent, fixed models are cleared');
})().catch(error=>{console.error(error);process.exit(1);});
