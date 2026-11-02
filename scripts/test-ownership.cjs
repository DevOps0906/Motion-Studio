// task-008: per-account data separation. Real route handlers run against a temp .local-data with two accounts (A, B) and an operator.
// 1 dynamic permission table over every exported app/api method  2 public image / render asset token rules  3 operator audit
// 4 inquiries column repair  5 migrate:owner  6 account:delete
const fs=require('fs'),os=require('os'),path=require('path'),ts=require('typescript'),assert=require('assert/strict'),sharp=require('sharp'),http=require('http'),crypto=require('crypto');
const {spawn}=require('child_process'),{DatabaseSync}=require('node:sqlite');
const ROOT=process.cwd(),BASE='http://studio.test',NF={error:'찾을 수 없습니다.'};
const tmpDir=prefix=>fs.mkdtempSync(path.join(os.tmpdir(),prefix));
// Loads TypeScript sources in the test realm (so Request/Response/File are the real ones). `process.cwd()` and `process.env` are per world.
function world({cwd,env={}}){
 const cache=new Map(),later=[];
 const fakeProcess={cwd:()=>cwd,env,platform:process.platform,stdout:process.stdout,stderr:process.stderr};
 const NextResponse={next:()=>({kind:'next',status:200}),json:(body,init={})=>({kind:'json',status:init.status||200,body}),redirect:url=>({kind:'redirect',status:307,location:String(url)})};
 const stubs={'server-only':{},'next/server':{after:task=>later.push(task),NextResponse}};
 function load(file){
  const key=path.resolve(file);if(cache.has(key))return cache.get(key).exports;
  const module={exports:{}};cache.set(key,module);
  const code=ts.transpileModule(fs.readFileSync(key,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const dir=path.dirname(key);
  const localRequire=id=>{
   if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id];
   if(id.startsWith('.')){
    const target=path.resolve(dir,id);if(id.endsWith('.json'))return require(target);
    for(const candidate of [target+'.ts',path.join(target,'index.ts')])if(fs.existsSync(candidate))return load(candidate);
    throw Error('cannot resolve '+id+' from '+key);
   }
   return require(id);
  };
  new Function('module','exports','require','process',code)(module,module.exports,localRequire,fakeProcess);
  return module.exports;
 }
 return {load,later};
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
function walk(dir,match,out=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full,match,out);else if(entry.name===match)out.push(full);}return out;}
function glb(){
 const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scenes:[{}],nodes:[{}],meshes:[{}]}));
 const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
 const header=Buffer.alloc(20);header.write('glTF',0,'ascii');header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
 return Buffer.concat([header,padded]);
}
// A port nobody listens on (fetch refuses port 9 as a bad port, which would look like an uncertain answer).
let DEAD_URL='http://127.0.0.1:1';
const pickDeadPort=()=>new Promise(resolve=>{const server=require('net').createServer();server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>resolve(`http://127.0.0.1:${port}`));});});
const run=(script,args,{cwd,env={},input=''})=>new Promise(resolve=>{
 const child=spawn(process.execPath,[path.join(ROOT,'scripts',script),...args],{cwd,env:{...process.env,MOTION_STUDIO_URL:DEAD_URL,...env}});
 let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
 child.on('close',status=>resolve({status,stdout,stderr}));child.stdin.end(input);
});
const hashTree=dir=>{const out={};(function visit(current){for(const entry of fs.readdirSync(current,{withFileTypes:true})){const full=path.join(current,entry.name);if(entry.isDirectory())visit(full);else out[path.relative(dir,full)]=crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex');}})(dir);return out;};

(async()=>{
 DEAD_URL=await pickDeadPort();
 const cwd=tmpDir('ms-own-'),data=path.join(cwd,'.local-data');
 const env={REQUIREMENTS_ADMIN_EMAILS:'op@example.com'};
 const {load,later}=world({cwd,env});
 const accounts=load('lib/account-store.ts');
 const make=async(name,email)=>{const account=await accounts.writeAccount({name,email,password:'correct horse 123'});const token=await accounts.createSession({id:account.id,name,email});return {id:account.id,email,cookie:`${accounts.SESSION_COOKIE}=${token}`};};
 const A=await make('가','a@example.com'),B=await make('나','b@example.com'),OP=await make('운영자','op@example.com');
 assert.match(A.id,/^[0-9a-f-]{36}$/);assert.notEqual(A.id,B.id);
 // A sample image for the shared source-* rule.
 const sample=require('../public/photos/manifest.json').sources[0];
 fs.mkdirSync(path.join(cwd,'input','images'),{recursive:true});fs.writeFileSync(path.join(cwd,'input','images',sample.file),await sharp({create:{width:8,height:8,channels:3,background:'#888'}}).png().toBuffer());
 fs.cpSync(path.join(ROOT,'public','photos'),path.join(cwd,'public','photos'),{recursive:true});
 const routeFiles=walk(path.join(ROOT,'app','api'),'route.ts');
 const routeKey=file=>'/'+path.relative(path.join(ROOT,'app'),path.dirname(file)).split(path.sep).join('/');
 const modules=Object.fromEntries(routeFiles.map(file=>[routeKey(file),load(file)]));
 const call=async(key,method,pathname,who,options={},params)=>{
  const handler=modules[key][method];assert.equal(typeof handler,'function',method+' '+key);
  return handler(request(method,pathname,{cookie:who?.cookie,...await sized(options)}),{params:Promise.resolve(params||{})});
 };
 const png=color=>sharp({create:{width:64,height:64,channels:3,background:color}}).png().toBuffer();
 const upload=async(who,color,extra={})=>{const form=new FormData();form.append('file',new File([await png(color)],'photo.png',{type:'image/png'}));for(const [k,v] of Object.entries(extra))form.append(k,v);return call('/api/media','POST','/api/media',who,{form});};
 const {EMPTY_WEBSITE}=load('lib/website.ts'),{DEFAULT_BLOG_SKIN}=load('lib/blog-skin.ts');
 const site=extra=>({...EMPTY_WEBSITE,title:'사이트',brand:'BRAND',headline:'제목',description:'설명',...extra});

 // ---- seed account A through the real handlers
 let res=await upload(A,'#ff0000',{ownerId:B.id});assert.equal(res.status,201);const pubMedia=await res.json();
 assert.equal(pubMedia.ownerId,A.id,'client ownerId is ignored on media');
 const privMedia=await (await upload(A,'#00ff00')).json();
 res=await call('/api/websites','POST','/api/websites',A,{json:site({heroImageId:pubMedia.id,inquiryForm:true,ownerId:B.id})});assert.equal(res.status,201);const siteA=await res.json();
 assert.equal(siteA.ownerId,A.id,'client ownerId is ignored on websites');
 res=await call('/api/projects','POST','/api/projects',A,{json:{title:'A 프로젝트',photos:[privMedia.id],ownerId:B.id}});assert.equal(res.status,201);const projA=await res.json();assert.equal(projA.ownerId,A.id);
 const modelForm=owner=>{const form=new FormData();form.append('file',new File([glb()],'a.glb'));if(owner)form.append('ownerId',owner);return form;};
 res=await call('/api/models','POST','/api/models',A,{form:modelForm(B.id)});assert.equal(res.status,201);const modelA=await res.json();assert.equal(modelA.ownerId,A.id);
 const viewBody={schemaVersion:1,name:'정면',camera:{position:[23,16,22],target:[0,5.2,0]},floors:[],exploded:false,background:'#101722'};
 res=await call('/api/models/[id]/views','POST','/x',A,{json:viewBody},{id:modelA.id});assert.equal(res.status,201);const viewA=await res.json();
 res=await call('/api/blog-skins','POST','/api/blog-skins',A,{json:{draft:DEFAULT_BLOG_SKIN}});assert.equal(res.status,201);const skinA=await res.json();assert.equal(skinA.ownerId,A.id);
 // A render job written directly (starting one would spawn the Remotion worker).
 const jobId=crypto.randomUUID(),assetToken=crypto.randomBytes(24).toString('hex'),now=new Date().toISOString();
 const jobDir=path.join(data,'render-files',jobId);fs.mkdirSync(path.join(jobDir,'assets'),{recursive:true});
 fs.writeFileSync(path.join(jobDir,'assets',privMedia.id),await png('#00ff00'));fs.writeFileSync(path.join(jobDir,'output.mp4'),'video');
 fs.writeFileSync(path.join(jobDir,'input.json'),JSON.stringify({project:projA,media:[{...privMedia,url:`${BASE}/api/renders/${jobId}/assets/${privMedia.id}?token=${assetToken}`}]}));
 fs.mkdirSync(path.join(data,'renders'),{recursive:true});
 fs.writeFileSync(path.join(data,'renders',jobId+'.json'),JSON.stringify({ownerId:A.id,assetToken,id:jobId,projectId:projA.id,projectSnapshot:projA,status:'completed',progress:100,stage:'완료',createdAt:now,updatedAt:now}));
 // Inquiry: public intake copies the website owner.
 res=await call('/api/inquiries','POST','/api/inquiries',null,{json:{websiteId:siteA.id,submissionKey:crypto.randomUUID(),name:'홍길동',contact:'guest@example.com',message:'문의합니다.',consent:true,website:''}});assert.equal(res.status,201);
 const listA=await (await call('/api/inquiries','GET','/api/inquiries',A)).json();assert.equal(listA.length,1);const inqA=listA[0];assert.equal(inqA.ownerId,A.id);
 console.log('PASS: seed — records created through the handlers carry the session account as owner, client ownerId ignored, inquiry owner copied from the website');

 // ---- 1. dynamic table: every exported method of every route must be classified; foreign ids give the fixed 404
 const item=(spec)=>spec;
 const ITEMS={
  'GET /api/projects/[id]':{url:`/api/projects/${projA.id}`,params:{id:projA.id}},
  'PATCH /api/projects/[id]':{url:`/api/projects/${projA.id}`,params:{id:projA.id},json:projA},
  'DELETE /api/projects/[id]':{url:`/api/projects/${projA.id}`,params:{id:projA.id}},
  'GET /api/media/[id]':{url:`/api/media/${privMedia.id}`,params:{id:privMedia.id}},
  'DELETE /api/media/[id]':{url:`/api/media/${privMedia.id}`,params:{id:privMedia.id}},
  'POST /api/media/[id]/crop':{url:`/api/media/${privMedia.id}/crop`,params:{id:privMedia.id},json:{left:0,top:0,width:50,height:50}},
  'GET /api/models/[id]':{url:`/api/models/${modelA.id}`,params:{id:modelA.id}},
  'DELETE /api/models/[id]':{url:`/api/models/${modelA.id}`,params:{id:modelA.id}},
  'GET /api/models/[id]/views':{url:`/api/models/${modelA.id}/views`,params:{id:modelA.id}},
  'POST /api/models/[id]/views':{url:`/api/models/${modelA.id}/views`,params:{id:modelA.id},json:viewBody},
  'GET /api/models/[id]/views/[viewId]':{url:`/api/models/${modelA.id}/views/${viewA.id}`,params:{id:modelA.id,viewId:viewA.id}},
  'PUT /api/models/[id]/views/[viewId]':{url:`/api/models/${modelA.id}/views/${viewA.id}`,params:{id:modelA.id,viewId:viewA.id},json:viewBody},
  'DELETE /api/models/[id]/views/[viewId]':{url:`/api/models/${modelA.id}/views/${viewA.id}`,params:{id:modelA.id,viewId:viewA.id}},
  'GET /api/models/[id]/edits':{url:`/api/models/${modelA.id}/edits`,params:{id:modelA.id}},
  'PUT /api/models/[id]/edits':{url:`/api/models/${modelA.id}/edits`,params:{id:modelA.id},json:{schemaVersion:1,revision:0,overrides:{}}},
  'GET /api/models/[id]/asset':{url:`/api/models/${modelA.id}/asset`,params:{id:modelA.id}},
  'GET /api/renders/[id]':{url:`/api/renders/${jobId}`,params:{id:jobId}},
  'POST /api/renders/[id]/cancel':{url:`/api/renders/${jobId}/cancel`,params:{id:jobId}},
  'GET /api/renders/[id]/download':{url:`/api/renders/${jobId}/download`,params:{id:jobId}},
  'GET /api/renders/[id]/capcut':{url:`/api/renders/${jobId}/capcut`,params:{id:jobId}},
  'GET /api/renders/[id]/assets/[assetId]':{url:`/api/renders/${jobId}/assets/${privMedia.id}`,params:{id:jobId,assetId:privMedia.id}},
  'GET /api/websites/[id]':{url:`/api/websites/${siteA.id}`,params:{id:siteA.id}},
  'PATCH /api/websites/[id]':{url:`/api/websites/${siteA.id}`,params:{id:siteA.id},json:siteA},
  'GET /api/websites/[id]/export':{url:`/api/websites/${siteA.id}/export`,params:{id:siteA.id}},
  'PATCH /api/inquiries/[id]':{url:`/api/inquiries/${inqA.id}`,params:{id:inqA.id}},
 };
 const LISTS=['GET /api/projects','GET /api/media','GET /api/models','GET /api/renders','GET /api/websites','GET /api/blog-skins','GET /api/inquiries'];
 const CREATES=['POST /api/projects','POST /api/media','POST /api/models','POST /api/websites','POST /api/blog-skins','POST /api/content-projects','POST /api/create-intro','POST /api/renders','POST /api/media/prepare','POST /api/blog-skins/export','POST /api/blog-skins/preview','GET /api/inquiries/unread'];
 // No stored data of an account is read or written by these.
 const NO_DATA=['GET /api/blog-skins/generate','POST /api/blog-skins/generate','GET /api/websites/draft','POST /api/websites/draft','POST /api/integrations/capcut/launch','GET /api/website-requirements','GET /api/templates','GET /api/website-references'];
 const PUBLIC=['GET /api/auth','POST /api/auth','DELETE /api/auth','POST /api/inquiries','POST /api/website-requirements','GET /api/health'];
 const found=[];
 for(const file of routeFiles){
  const key=routeKey(file),methods=[...fs.readFileSync(file,'utf8').matchAll(/export\s+(?:async\s+)?(?:function\s+|const\s+)(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)].map(match=>match[1]);
  for(const method of methods)found.push(`${method} ${key}`);
 }
 const classified=[...Object.keys(ITEMS),...LISTS,...CREATES,...NO_DATA,...PUBLIC];
 assert.deepEqual(found.filter(key=>!classified.includes(key)),[],'route methods without an ownership rule');
 assert.deepEqual(classified.filter(key=>!found.includes(key)),[],'rules for routes that do not exist');
 assert.equal(new Set(classified).size,classified.length);
 let checked=0;
 for(const [key,spec] of Object.entries(ITEMS)){
  const [method,route]=key.split(' ');
  const control=method==='GET'?await call(route,method,spec.url,A,{},spec.params):null;
  if(control)assert.equal(control.status,200,'owner control '+key);
  const response=await call(route,method,spec.url,B,spec.json?{json:spec.json}:{},spec.params);
  assert.equal(response.status,404,key);assert.deepEqual(await response.json(),NF,key+' must equal the missing-id body');
  // Same answer for an id that does not exist at all.
  const ghost=crypto.randomUUID(),ghostParams=Object.fromEntries(Object.keys(spec.params).map(name=>[name,name==='assetId'?spec.params[name]:ghost]));
  const missing=await call(route,method,spec.url.replace(spec.params.id,ghost),B,spec.json?{json:{...spec.json,id:ghost}}:{},ghostParams);
  assert.equal(missing.status,404,'missing '+key);assert.deepEqual(await missing.json(),NF,'missing '+key);
  checked++;
 }
 for(const key of LISTS){
  const [method,route]=key.split(' ');
  const body=await (await call(route,method,route,B)).text();
  for(const id of [projA.id,privMedia.id,pubMedia.id,modelA.id,jobId,siteA.id,skinA.id,inqA.id])assert.ok(!body.includes(id),`${key} lists another account's item`);
  const own=await (await call(route,method,route,A)).text();
  if(route!=='/api/media')assert.ok(own.length>2,`${key} owner sees own list`);
  const widened=await call(route,method,route+'?owner=all',B);assert.ok(widened.status<300);
  const widenedText=await widened.text();for(const id of [projA.id,privMedia.id,modelA.id,jobId,siteA.id,skinA.id,inqA.id])assert.ok(!widenedText.includes(id),'non-operators cannot widen scope '+key);
  checked++;
 }
 assert.deepEqual(await (await call('/api/inquiries/unread','GET','/api/inquiries/unread',B)).json(),{count:0});
 assert.deepEqual(await (await call('/api/inquiries/unread','GET','/api/inquiries/unread',A)).json(),{count:1});
 // A's data is untouched by all of B's attempts.
 assert.equal((await call('/api/projects/[id]','GET','/x',A,{},{id:projA.id})).status,200);
 assert.equal((await call('/api/media/[id]','GET','/x',A,{},{id:privMedia.id})).status,200);
 assert.equal((await call('/api/models/[id]','GET','/x',A,{},{id:modelA.id})).status,200);
 assert.equal((await call('/api/websites/[id]','GET','/x',A,{},{id:siteA.id})).status,200);
 // Creates by B: owner comes from the session, references to A's items are refused.
 const bProject=await (await call('/api/projects','POST','/api/projects',B,{json:{title:'B',photos:[],ownerId:A.id}})).json();assert.equal(bProject.ownerId,B.id);
 res=await call('/api/projects','POST','/api/projects',B,{json:{title:'B',photos:[privMedia.id]}});assert.equal(res.status,400);
 res=await call('/api/projects','POST','/api/projects',B,{json:{title:'B',photos:[],logoAssetId:privMedia.id}});assert.equal(res.status,201);
 res=await call('/api/projects/[id]','PATCH','/x',B,{json:{...bProject,brand:{...bProject.brand,logoAssetId:pubMedia.id}}},{id:bProject.id});assert.equal(res.status,400,"another account's media (even a public cover) cannot be referenced");
 const bMedia=await (await upload(B,'#0000ff',{ownerId:A.id})).json();assert.equal(bMedia.ownerId,B.id);
 res=await call('/api/models','POST','/api/models',B,{form:modelForm(A.id)});assert.equal((await res.json()).ownerId,B.id);
 res=await call('/api/websites','POST','/api/websites',B,{json:site({heroImageId:pubMedia.id})});assert.equal(res.status,400,'foreign image cannot be a hero image');
 res=await call('/api/websites','POST','/api/websites',B,{json:site({heroImageId:bMedia.id,ownerId:A.id})});assert.equal(res.status,201);assert.equal((await res.json()).ownerId,B.id);
 res=await call('/api/blog-skins','POST','/api/blog-skins',B,{json:{draft:{...DEFAULT_BLOG_SKIN,imageId:privMedia.id}}});assert.equal(res.status,400);
 res=await call('/api/blog-skins','POST','/api/blog-skins',B,{json:{draft:DEFAULT_BLOG_SKIN,id:skinA.id}});assert.equal(res.status,404);
 res=await call('/api/blog-skins','POST','/api/blog-skins',B,{json:{draft:DEFAULT_BLOG_SKIN}});assert.equal((await res.json()).ownerId,B.id);
 for(const route of ['/api/blog-skins/export','/api/blog-skins/preview']){res=await call(route,'POST',route,B,{json:{...DEFAULT_BLOG_SKIN,imageId:privMedia.id}});assert.equal(res.status,404,route);assert.deepEqual(await res.json(),NF);}
 res=await call('/api/content-projects','POST','/api/content-projects',B,{json:{...projA,contentType:'ranking-short'}});assert.equal(res.status,404);
 res=await call('/api/create-intro','POST','/api/create-intro',B,{json:{templateId:'photo-wall-intro-v1',photoIds:['a1','a2','a3','a4','a5','a6'],logoAssetId:privMedia.id}});assert.equal(res.status,400);
 res=await call('/api/renders','POST','/api/renders',B,{json:{project:projA}});assert.equal(res.status,400,'render of an account referencing foreign media is refused');
 res=await call('/api/media','POST','/api/media',B,{form:(()=>{const form=new FormData();form.append('file',new File([Buffer.from('x')],'v.mp4'));form.append('sourceAssetId',privMedia.id);return form;})()});assert.equal(res.status,400);
 res=await call('/api/media/[id]/crop','POST','/x',B,{json:{left:0,top:0,width:50,height:50}},{id:bMedia.id});assert.equal(res.status,201,'own media can be cropped');const bCrop=await res.json();assert.equal(bCrop.ownerId,B.id);
 res=await call('/api/media/prepare','POST','/api/media/prepare',B);assert.equal(res.status,200);
 const bMediaList=await (await call('/api/media','GET','/api/media',B)).json(),aMediaList=await (await call('/api/media','GET','/api/media',A)).json();
 assert.ok(bMediaList.filter(m=>m.role!=='source-capture').every(m=>m.ownerId===B.id));assert.ok(bMediaList.some(m=>m.name.startsWith('starter-')));
 assert.ok(!aMediaList.some(m=>m.name.startsWith('starter-')),'prepare is per account');
 assert.ok(bMediaList.some(m=>m.id===sample.id)&&aMediaList.some(m=>m.id===sample.id),'source-* samples are shared');
 assert.equal((await call('/api/media/[id]','GET','/x',B,{},{id:sample.id})).status,200);
 assert.equal((await call('/api/website-requirements','GET','/x',B)).status,403);
 // A session without an id (made before migrate:owner) cannot use owner routes.
 const legacy=await accounts.createSession({name:'옛 세션',email:'old@example.com'});
 for(const [route,method] of [['/api/projects','GET'],['/api/media','GET'],['/api/inquiries/unread','GET']])assert.equal((await call(route,method,route,{cookie:`${accounts.SESSION_COOKIE}=${legacy}`})).status,401,'session without id '+route);
 console.log(`PASS: ${found.length} route methods classified, ${checked} item/list rules — B session on A's real ids gets the fixed 404 (same body as a missing id), lists exclude A, creates take the session owner and refuse foreign references, id-less sessions get 401`);

 // ---- 2. public preview image / private media / render asset token
 assert.equal((await call('/api/media/[id]','GET','/x',B,{},{id:pubMedia.id})).status,200,"B session opens A's public preview image");
 assert.equal((await call('/api/media/[id]','GET','/x',null,{},{id:pubMedia.id})).status,200,'visitor opens the public preview image');
 assert.equal((await call('/api/media/[id]','GET','/x',B,{},{id:privMedia.id})).status,404,"A's private media is 404 for B");
 assert.equal((await call('/api/media/[id]','GET','/x',null,{},{id:privMedia.id})).status,404);
 const s=await call('/api/websites/[id]','PATCH','/x',A,{json:{...siteA,heroImageId:privMedia.id}},{id:siteA.id});assert.equal(s.status,200);
 assert.equal((await call('/api/media/[id]','GET','/x',B,{},{id:pubMedia.id})).status,404,'no longer a cover image -> private again');
 assert.equal((await call('/api/media/[id]','GET','/x',B,{},{id:privMedia.id})).status,200,'now the cover image -> public');
 const proxy=load('proxy.ts').proxy;
 const prox=(pathname,cookie)=>proxy({method:'GET',url:BASE+pathname,nextUrl:new URL(BASE+pathname),headers:new Headers({host:'studio.test',...(cookie?{cookie}:{})})});
 assert.equal((await prox(`/api/media/${privMedia.id}`)).kind,'next','visitor request for a cover image reaches the route');
 assert.equal((await prox(`/api/media/${pubMedia.id}`)).status,401,'visitor request for a non-public image stops at the proxy');
 assert.equal((await prox(`/api/media/${pubMedia.id}`,B.cookie)).kind,'next','with a session the proxy does not decide; the route does');
 const assetPath=`/api/renders/${jobId}/assets/${privMedia.id}`;
 assert.equal((await prox(assetPath)).status,401,'render asset without token or session stops at the proxy');
 assert.equal((await prox(assetPath+'?token=zz')).status,401);
 assert.equal((await prox(assetPath+'?token='+assetToken)).kind,'next','render worker (token, no cookie) reaches the route');
 const asset=(who,query='')=>call('/api/renders/[id]/assets/[assetId]','GET',assetPath+query,who,{},{id:jobId,assetId:privMedia.id});
 const jobFile=path.join(data,'renders',jobId+'.json'),setStatus=status=>fs.writeFileSync(jobFile,JSON.stringify({...JSON.parse(fs.readFileSync(jobFile,'utf8')),status,updatedAt:new Date().toISOString()}));
 setStatus('processing');
 assert.equal((await asset(null,'?token='+assetToken)).status,200);
 assert.equal((await asset(B,'?token='+assetToken)).status,200,'token alone is enough');
 setStatus('completed');assert.equal((await asset(null,'?token='+assetToken)).status,404,'token dies when the render ends');assert.equal((await asset(B,'?token='+assetToken)).status,404);
 assert.equal((await asset(null,'?token='+'0'.repeat(48))).status,404);assert.equal((await asset(null)).status,404);
 assert.equal((await asset(B)).status,404);assert.equal((await asset(B,'?token=short')).status,404);assert.equal((await asset(A)).status,200,'owner session without token');
 const renderJson=await (await call('/api/renders/[id]','GET','/x',A,{},{id:jobId})).json();assert.equal(renderJson.assetToken,undefined,'token never leaves through the API');
 assert.ok(!JSON.stringify(await (await call('/api/renders','GET','/api/renders',A)).json()).includes(assetToken));
 console.log('PASS: public preview image 200 for a B session and visitors, private media 404, cover switch applies at once, render asset needs token or owner, proxy only passes token-shaped asset requests');

 // ---- 3. operator: sees/deletes foreign items with an audit line, cannot change them, default scope is own
 const auditFile=path.join(data,'audit.log');assert.ok(!fs.existsSync(auditFile)||fs.readFileSync(auditFile,'utf8')==='');
 assert.deepEqual(await (await call('/api/projects','GET','/api/projects',OP)).json(),[]);
 const all=await (await call('/api/projects','GET','/api/projects?owner=all',OP)).json();assert.ok(all.some(p=>p.id===projA.id)&&all.some(p=>p.ownerId===B.id));
 assert.equal((await call('/api/websites/[id]','PATCH','/x',OP,{json:siteA},{id:siteA.id})).status,404,'operator cannot change foreign items');
 assert.equal((await call('/api/renders/[id]/cancel','POST','/x',OP,{},{id:jobId})).status,404);
 assert.equal((await call('/api/inquiries/[id]','PATCH','/x',OP,{},{id:inqA.id})).status,404);
 assert.equal((await call('/api/media/[id]','GET','/x',OP,{},{id:bCrop.id})).status,200,'operator views a private foreign media');
 assert.equal((await call('/api/projects/[id]','GET','/x',OP,{},{id:projA.id})).status,200);
 assert.equal((await call('/api/projects/[id]','DELETE','/x',OP,{},{id:bProject.id})).status,200);
 assert.equal((await call('/api/projects/[id]','GET','/x',B,{},{id:bProject.id})).status,404);
 const audit=fs.readFileSync(auditFile,'utf8').trim().split('\n').map(line=>JSON.parse(line));
 for(const line of audit){assert.deepEqual(Object.keys(line).sort(),['action','at','id','kind','operator','ownerId']);assert.equal(line.operator,OP.id);assert.ok(['view','delete'].includes(line.action));}
 assert.ok(audit.some(l=>l.action==='delete'&&l.kind==='project'&&l.id===bProject.id&&l.ownerId===B.id));
 assert.ok(audit.some(l=>l.action==='view'&&l.kind==='media'&&l.id===bCrop.id&&l.ownerId===B.id));
 assert.ok(audit.some(l=>l.action==='view'&&l.kind==='project'&&l.id===projA.id));
 const auditText=fs.readFileSync(auditFile,'utf8');
 for(const secret of ['a@example.com','b@example.com','op@example.com','홍길동','guest@example.com','문의합니다','127.0.0.1'])assert.ok(!auditText.includes(secret),'audit log has no '+secret);
 const before=audit.length;
 await call('/api/projects/[id]','GET','/x',A,{},{id:projA.id});await call('/api/projects','GET','/api/projects',A);
 assert.equal(fs.readFileSync(auditFile,'utf8').trim().split('\n').length,before,'own items are never audited');
 // task-009: operator all-accounts inbox. Non-operator ?owner=all stays own-only (table above); operator gets foreign rows, one audit line, masked owner label.
 {
  const lines=()=>fs.readFileSync(auditFile,'utf8').trim().split(String.fromCharCode(10)).length,n0=lines();
  const rows=await (await call('/api/inquiries','GET','/api/inquiries?owner=all',OP)).json();
  const row=rows.find(r=>r.id===inqA.id);assert.ok(row,'operator all view includes foreign inquiry');
  assert.equal(lines(),n0+1,'one audit line for the foreign inquiry');
  assert.ok(typeof row.ownerLabel==='string'&&row.ownerLabel.includes('***@')&&!JSON.stringify(rows).includes('a@example.com'),'owner label is masked, never the raw email');
  const mine=await (await call('/api/inquiries','GET','/api/inquiries',OP)).json();assert.deepEqual(mine,[]);assert.ok(mine.every(r=>r.ownerLabel===undefined));
  assert.equal(JSON.stringify(await (await call('/api/inquiries','GET','/api/inquiries?owner=all',B)).json()).includes('ownerLabel'),false,'non-operator gets no owner label');
  const page=fs.readFileSync(path.join(ROOT,'app/websites/inquiries/page.tsx'),'utf8'),ui=fs.readFileSync(path.join(ROOT,'components/WebsiteInquiriesInbox.tsx'),'utf8');
  assert.ok(page.includes('operator={isAdminEmail(account.email)}'),'operator decided on the server');
  assert.ok(ui.includes('{operator&&<div className="inquiry-scope"')&&ui.includes("next==='all'&&operator?"),'toggle and owner=all only for operators');
  console.log('PASS: operator all-accounts inbox — foreign rows with audit line, masked owner label, non-operators unchanged, toggle gated by server-side operator prop');
 }
 {
  const NL=String.fromCharCode(10),own=load('lib/server/owner.ts');
  assert.equal(own.maskEmail('a@x.com'),'***@x.com');assert.equal(own.maskEmail('ab@x.com'),'***@x.com');assert.equal(own.maskEmail('sky@x.com'),'sk***@x.com');
  const idb=crypto.randomUUID(),dbq=new DatabaseSync(path.join(data,'inquiries.sqlite'));
  dbq.prepare('INSERT INTO inquiries(id,submission_key,website_id,website_title,created_at,name,contact,message,consent_version,read_at,notify,owner_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)').run(idb,'k-legacy','w','t',new Date().toISOString(),'n','c','m','v',null,'{}');dbq.close();
  assert.equal((await call('/api/inquiries/[id]','PATCH','/x',B,{},{id:idb})).status,404,'non-operator cannot read ownerless inquiry');
  assert.equal((await call('/api/inquiries/[id]','PATCH','/x',OP,{},{id:idb})).status,200,'operator reads ownerless inquiry');
  assert.equal((await call('/api/inquiries/[id]','PATCH','/x',OP,{},{id:inqA.id})).status,404,'operator cannot read another account inquiry');
 }
 // Items without an owner (before migrate:owner) are operator only.
 fs.writeFileSync(path.join(data,'projects','legacy-1.json'),JSON.stringify({...projA,id:'legacy-1',ownerId:undefined}));
 assert.equal((await call('/api/projects/[id]','GET','/x',B,{},{id:'legacy-1'})).status,404);assert.equal((await call('/api/projects/[id]','GET','/x',A,{},{id:'legacy-1'})).status,404);
 assert.equal((await call('/api/projects/[id]','GET','/x',OP,{},{id:'legacy-1'})).status,200);
 console.log('PASS: operator default scope is own, ?owner=all and foreign view/delete are audited (no personal data), no foreign change, own items not audited, ownerless items operator-only');

 // ---- 4. inquiries table from before this change gets owner_id by itself (also after restoring an old backup)
 {
  const old=tmpDir('ms-own-old-'),root=path.join(old,'.local-data');fs.mkdirSync(root,{recursive:true});
  const db=new DatabaseSync(path.join(root,'inquiries.sqlite'));
  db.exec('CREATE TABLE inquiries(id TEXT PRIMARY KEY, submission_key TEXT UNIQUE NOT NULL, website_id TEXT NOT NULL, website_title TEXT NOT NULL, created_at TEXT NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT NOT NULL, consent_version TEXT NOT NULL, read_at TEXT, notify TEXT NOT NULL)');
  db.prepare('INSERT INTO inquiries VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('old-1','k1','w1','옛',new Date().toISOString(),'n','c','m','v',null,'{}');db.close();
  const w=world({cwd:old,env:{}});const inquiries=w.load('lib/server/inquiries.ts');
  assert.equal(inquiries.listInquiries(Date.now(),'acct-x').length,0);assert.equal(inquiries.listInquiries(Date.now(),'all').length,1,'old row stays, without an owner');
  assert.equal(inquiries.listInquiries(Date.now(),'all')[0].ownerId,undefined);
  const check=new DatabaseSync(path.join(root,'inquiries.sqlite'));
  assert.equal(check.prepare('PRAGMA table_info(inquiries)').all().filter(c=>c.name==='owner_id').length,1);check.close();
  assert.equal(w.load('lib/server/inquiries.ts'),inquiries);
  console.log('PASS: old inquiries table gets owner_id automatically (idempotent), old rows stay ownerless');
 }

 // ---- 5. migrate:owner
 {
  const dir=tmpDir('ms-own-migrate-'),root=path.join(dir,'.local-data');
  const w=world({cwd:dir,env});const store=w.load('lib/account-store.ts');
  const legacyAccount=async(name,email)=>{const account=await store.writeAccount({name,email,password:'correct horse 123'});await store.saveAccountRecord({...account,id:undefined});return store.createSession({name,email});};
  await legacyAccount('운영자','op@example.com');await legacyAccount('일반','user@example.com');
  const seed={projects:['p1','p2'],media:['m1'],websites:['w1'],'blog-skins':['b1'],renders:['r1'],models:['c1']};
  for(const [d,ids] of Object.entries(seed)){fs.mkdirSync(path.join(root,d),{recursive:true});for(const id of ids)fs.writeFileSync(path.join(root,d,id+'.json'),JSON.stringify({id,ownerId:id==='p2'?'someone-else':undefined,title:id}));}
  fs.writeFileSync(path.join(root,'models','c1.glb'),'binary');
  const dbFile=path.join(root,'inquiries.sqlite'),db=new DatabaseSync(dbFile);
  db.exec('CREATE TABLE inquiries(id TEXT PRIMARY KEY, submission_key TEXT UNIQUE NOT NULL, website_id TEXT NOT NULL, website_title TEXT NOT NULL, created_at TEXT NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT NOT NULL, consent_version TEXT NOT NULL, read_at TEXT, notify TEXT NOT NULL)');
  for(const id of ['i1','i2'])db.prepare('INSERT INTO inquiries VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,'k'+id,'w1','t',new Date().toISOString(),'n','c','m','v',null,'{}');db.close();
  const snapshot=()=>JSON.stringify({files:Object.entries(hashTree(root)).filter(([name])=>!name.startsWith('inquiries.sqlite')),sessions:fs.readdirSync(path.join(root,'accounts','sessions')).length});
  const unchanged=snapshot();
  // refused: not an operator email / missing --owner
  let r=await run('migrate-owner.cjs',['--owner','user@example.com'],{cwd:dir,env});assert.equal(r.status,1);assert.match(r.stderr,/REQUIREMENTS_ADMIN_EMAILS/);
  r=await run('migrate-owner.cjs',[],{cwd:dir,env});assert.equal(r.status,1);
  r=await run('migrate-owner.cjs',['--owner','op@example.com'],{cwd:dir,env:{}});assert.equal(r.status,1,'no admin list -> refused');
  // refused while the server answers its health URL
  const server=http.createServer((req,res)=>{res.writeHead(200);res.end('{"status":"ok"}');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  r=await run('migrate-owner.cjs',['--owner','op@example.com'],{cwd:dir,env:{...env,MOTION_STUDIO_URL:`http://127.0.0.1:${server.address().port}`}});
  await new Promise(resolve=>server.close(resolve));
  assert.equal(r.status,1);assert.match(r.stderr,/서버가 아직 응답/);assert.equal(snapshot(),unchanged,'nothing changed while the server answered');
  // dry-run: reports, changes nothing
  r=await run('migrate-owner.cjs',['--owner','op@example.com','--dry-run'],{cwd:dir,env});assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/dry-run/);assert.match(r.stdout,/계정 id 발급 2개/);assert.match(r.stdout,/문의 2건/);assert.equal(snapshot(),unchanged,'dry-run changes nothing');
  assert.equal(new DatabaseSync(dbFile).prepare('PRAGMA table_info(inquiries)').all().some(c=>c.name==='owner_id'),false,'dry-run does not alter the table');
  // real run
  r=await run('migrate-owner.cjs',['--owner','Op@Example.com'],{cwd:dir,env});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/검증: 소유자 없는 자료 0건/);
  const op=await store.readAccount('op@example.com'),user=await store.readAccount('user@example.com');
  assert.match(op.id,/^[0-9a-f-]{36}$/);assert.match(user.id,/^[0-9a-f-]{36}$/);assert.notEqual(op.id,user.id);
  for(const [d,ids] of Object.entries(seed))for(const id of ids){const rec=JSON.parse(fs.readFileSync(path.join(root,d,id+'.json'),'utf8'));assert.equal(rec.ownerId,id==='p2'?'someone-else':op.id,d+'/'+id);assert.equal(rec.title,id);}
  const migrated=new DatabaseSync(dbFile);assert.deepEqual(migrated.prepare('SELECT DISTINCT owner_id AS owner FROM inquiries').all().map(row=>row.owner),[op.id]);migrated.close();
  assert.deepEqual(fs.readdirSync(path.join(root,'accounts','sessions')),[],'all sessions revoked');
  assert.equal(fs.readFileSync(path.join(root,'models','c1.glb'),'utf8'),'binary');assert.deepEqual(fs.readdirSync(path.join(root,'projects')).filter(n=>n.endsWith('.tmp')),[]);
  // idempotent: same ids, no record rewritten
  const afterFirst=hashTree(root);
  r=await run('migrate-owner.cjs',['--owner','op@example.com'],{cwd:dir,env});assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/계정 id 발급 0개 · 소유자 지정: 없음 · 문의 0건/);
  const afterSecond=hashTree(root);for(const [name,hash] of Object.entries(afterFirst))if(!name.startsWith('inquiries.sqlite'))assert.equal(afterSecond[name],hash,'unchanged '+name);
  assert.equal((await store.readAccount('op@example.com')).id,op.id);
  console.log('PASS: migrate:owner refuses non-operator/no admin list/answering server, --dry-run changes nothing, run assigns every item/inquiry/account id and revokes sessions, rerun is a no-op');

  // ---- 6. account:delete (state continues from the migrated folder)
  const sessionFor=async email=>{const found=await store.readAccount(email);return store.createSession({id:found.id,name:found.name,email});};
  const addUser=async(email)=>{const account=await store.writeAccount({name:email,email,password:'correct horse 123'});return account;};
  const victim=await addUser('victim@example.com'),keeper=await addUser('keeper@example.com');
  await sessionFor('victim@example.com');const keeperSession=await sessionFor('keeper@example.com');
  fs.writeFileSync(path.join(root,'projects','v1.json'),JSON.stringify({id:'v1',ownerId:victim.id}));fs.writeFileSync(path.join(root,'media','v2.json'),JSON.stringify({id:'v2',ownerId:victim.id}));
  fs.writeFileSync(path.join(root,'projects','k1.json'),JSON.stringify({id:'k1',ownerId:keeper.id}));
  const insert=new DatabaseSync(dbFile);insert.prepare('INSERT INTO inquiries(id,submission_key,website_id,website_title,created_at,name,contact,message,consent_version,read_at,notify,owner_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('iv','kiv','w','t',new Date().toISOString(),'n','c','m','v',null,'{}',victim.id);
  insert.prepare('INSERT INTO inquiries(id,submission_key,website_id,website_title,created_at,name,contact,message,consent_version,read_at,notify,owner_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('ik','kik','w','t',new Date().toISOString(),'n','c','m','v',null,'{}',keeper.id);insert.close();
  const del=(args,extra={})=>run('account-delete.cjs',args,{cwd:dir,env:{...env,...extra}});
  assert.equal((await del(['victim@example.com'])).status,1,'needs --yes');
  assert.equal((await del(['op@example.com','--yes'])).status,1,'operator cannot be deleted');
  assert.equal((await del(['nobody@example.com','--yes'])).status,1);
  const guard=http.createServer((req,res)=>{res.writeHead(200);res.end('ok');});await new Promise(resolve=>guard.listen(0,'127.0.0.1',resolve));
  r=await del(['victim@example.com','--yes'],{MOTION_STUDIO_URL:`http://127.0.0.1:${guard.address().port}`});await new Promise(resolve=>guard.close(resolve));
  assert.equal(r.status,1);assert.match(r.stderr,/응답/);assert.ok(await store.readAccount('victim@example.com'));
  // Interrupted half way: a corrupt inquiries database fails the last data step; account file must still exist so the run can be repeated.
  const goodDb=fs.readFileSync(dbFile);fs.writeFileSync(dbFile,'not a database');
  r=await del(['victim@example.com','--yes']);assert.equal(r.status,1);
  assert.ok(await store.readAccount('victim@example.com'),'account file is deleted last');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'projects','v1.json'),'utf8')).ownerId,op.id,'items were already handed over');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'projects','k1.json'),'utf8')).ownerId,keeper.id);
  fs.writeFileSync(dbFile,goodDb);
  r=await del(['victim@example.com','--yes']);assert.equal(r.status,0,r.stderr);
  assert.equal(await store.readAccount('victim@example.com'),null);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'media','v2.json'),'utf8')).ownerId,op.id);
  const after=new DatabaseSync(dbFile),owners=Object.fromEntries(after.prepare('SELECT id,owner_id AS owner FROM inquiries WHERE id IN (?,?)').all('iv','ik').map(row=>[row.id,row.owner]));after.close();
  assert.deepEqual(owners,{iv:op.id,ik:keeper.id});
  assert.ok(await store.readSession(keeperSession),'other accounts keep their sessions');
  const sessions=fs.readdirSync(path.join(root,'accounts','sessions'));assert.equal(sessions.length,1,'victim sessions ended');
  assert.equal((await del(['victim@example.com','--yes'])).status,1,'already deleted');
  // Re-run of a half-finished deletion: account file back, nothing left to move.
  await store.saveAccountRecord(victim);r=await del(['victim@example.com','--yes']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/문의 0건/);
  // An account without id (before migrate) is refused.
  await store.writeAccount({name:'x',email:'noid@example.com',password:'correct horse 123'});const noid=await store.readAccount('noid@example.com');await store.saveAccountRecord({...noid,id:undefined});
  r=await del(['noid@example.com','--yes']);assert.equal(r.status,1);assert.match(r.stderr,/migrate:owner/);
  console.log('PASS: account:delete needs --yes, refuses operator/unknown/answering server/no id, revokes sessions, hands items+inquiries to the operator, deletes the account file last, can be re-run');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
