// task-005: auth gate (every route method enumerated), operator/signup rules, login limiter, account:create, backup/restore, health.
const fs=require('fs'),os=require('os'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),path=require('path'),http=require('http'),{spawnSync,spawn}=require('child_process'),{DatabaseSync}=require('node:sqlite');
const ROOT=process.cwd();
function world({stubs={},env={},cwd,stdout}={}){
 const cache=new Map(),sandboxProcess={env,cwd:()=>cwd||ROOT,stdout:stdout||{write:()=>true}};
 function load(file){
  const key=path.resolve(file);if(cache.has(key))return cache.get(key).exports;
  const module={exports:{}};cache.set(key,module);
  const code=ts.transpileModule(fs.readFileSync(key,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,process:sandboxProcess,Buffer,Date,URL,Response,Request,Headers,JSON,console,
   require:id=>{
    if(id==='server-only')return {};
    if(id.startsWith('node:'))return require(id);
    for(const [name,value] of Object.entries(stubs))if(id===name)return value;
    return load(path.resolve(path.dirname(key),id)+'.ts');
   }});
  return module.exports;
 }
 return load;
}
const tmpDir=prefix=>fs.mkdtempSync(path.join(os.tmpdir(),prefix));
const NextResponse={next:()=>({kind:'next',status:200}),json:(body,init={})=>({kind:'json',status:init.status||200,body}),redirect:url=>({kind:'redirect',status:307,location:String(url)})};
const BASE='http://studio.test';
const request=(method,pathname,cookie)=>({method,url:BASE+pathname,nextUrl:new URL(BASE+pathname),headers:new Headers({host:'studio.test',...(cookie?{cookie}:{}),...(['GET','HEAD','OPTIONS'].includes(method)?{}:{origin:BASE})})});
function walk(dir,match,out=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full,match,out);else if(entry.name===match)out.push(full);}return out;}
const routePath=(file,base,suffix)=>('/'+path.relative(base,path.dirname(file)).split(path.sep).join('/')).replace(/\[[^\]]+\]/g,'sample-id').replace(/\/$/,'')+suffix;
const run=(script,args,{cwd,env={},input=''})=>spawnSync(process.execPath,[path.join(ROOT,'scripts',script),...args],{cwd,env:{...process.env,...env},input,encoding:'utf8'});
(async()=>{
 // 1. Every exported method of every app/api route: 401 without a session unless on the public list.
 const data=tmpDir('ms-ops-gate-');fs.mkdirSync(path.join(data,'.local-data','websites'),{recursive:true});
 fs.writeFileSync(path.join(data,'.local-data','websites','site.json'),JSON.stringify({id:'site',heroImageId:'img-cover',pages:[{id:'about',heroImageId:'img-page'}]}));
 const load=world({stubs:{'next/server':{NextResponse}},cwd:data});
 const {proxy,config}=load('proxy.ts');const store=load('lib/account-store.ts');
 const token=await store.createSession({name:'운영자',email:'op@example.com'}),cookie=`${store.SESSION_COOKIE}=${token}`;
 const PUBLIC=new Set(['GET /api/auth','POST /api/auth','DELETE /api/auth','POST /api/inquiries','POST /api/website-requirements','GET /api/health']);
 const routes=walk(path.join(ROOT,'app','api'),'route.ts');let checked=0;
 assert.ok(routes.length>=34,'route files found: '+routes.length);
 for(const file of routes){
  const source=fs.readFileSync(file,'utf8'),pathname=routePath(file,path.join(ROOT,'app'),'');
  const methods=[...source.matchAll(/export\s+(?:async\s+)?(?:function\s+|const\s+)(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)].map(match=>match[1]);
  assert.ok(methods.length,'no handler in '+pathname);
  for(const method of methods.includes('GET')?[...methods,'HEAD']:methods){
   const key=`${method==='HEAD'?'GET':method} ${pathname}`;
   const anonymous=await proxy(request(method,pathname));
   if(PUBLIC.has(key))assert.equal(anonymous.kind,'next',key+' should be public');
   else{assert.equal(anonymous.status,401,`${method} ${pathname} should need login`);assert.equal(anonymous.body.error,'로그인이 필요합니다.');}
   assert.equal((await proxy(request(method,pathname,`${store.SESSION_COOKIE}=${'a'.repeat(64)}`))).status,PUBLIC.has(key)?200:401,key+' forged session');
   assert.equal((await proxy(request(method,pathname,cookie))).kind,'next',key+' with session');
   checked++;
  }
 }
 assert.equal((await proxy({...request('POST','/api/projects',cookie),headers:new Headers({host:'studio.test',cookie,origin:'https://evil.example'})})).status,403);
 assert.equal((await proxy(request('PUT','/api/health'))).status,401);assert.equal((await proxy(request('GET','/api/inquiries'))).status,401);assert.equal((await proxy(request('GET','/api/website-requirements'))).status,401);
 console.log(`PASS: ${routes.length} route files / ${checked} methods — anonymous 401 except public list, forged cookie 401, session passes, cross-site 403`);

 // 2. Media item is public only as a saved website's home/page cover image; the list and other methods stay private.
 for(const method of ['GET','HEAD']){assert.equal((await proxy(request(method,'/api/media/img-cover'))).kind,'next');assert.equal((await proxy(request(method,'/api/media/img-page'))).kind,'next');assert.equal((await proxy(request(method,'/api/media/img-other'))).status,401);}
 for(const [method,pathname] of [['GET','/api/media'],['DELETE','/api/media/img-cover'],['POST','/api/media/img-cover/crop'],['GET','/api/media/..%2Fx']])assert.equal((await proxy(request(method,pathname))).status,401,method+' '+pathname);
 console.log('PASS: /api/media/:id public only for website cover images (GET/HEAD), list/delete/crop private');

 // 3. Pages: only /login, /website-requirements, /websites/[id] and static files are public.
 const pages=walk(path.join(ROOT,'app'),'page.tsx').map(file=>routePath(file,path.join(ROOT,'app'),'')||'/');
 const publicPages=new Set(['/login','/website-requirements','/websites/sample-id']);
 for(const pathname of pages){
  const anonymous=await proxy(request('GET',pathname));
  if(publicPages.has(pathname))assert.equal(anonymous.kind,'next',pathname);else assert.equal(anonymous.location,BASE+'/login',pathname+' should redirect');
  assert.equal((await proxy(request('GET',pathname,cookie))).kind,'next',pathname+' with session');
 }
 for(const pathname of ['/websites/inquiries','/websites/editor','/websites','/','/intro/abc'])assert.equal((await proxy(request('GET',pathname))).kind,'redirect',pathname);
 for(const pathname of ['/_next/static/chunks/a.js','/icon.svg','/photos/01.jpg','/templates/x.json','/architecture.svg'])assert.equal((await proxy(request('GET',pathname))).kind,'next',pathname);
 assert.ok(config.matcher.some(item=>item.includes('_next/static')));
 console.log(`PASS: ${pages.length} pages — anonymous redirect to /login except public pages, static files pass`);

 // 4. Operator rule: production with empty REQUIREMENTS_ADMIN_EMAILS has no operator (Host is not trusted).
 let account={name:'운영자',email:'op@example.com'};const accounts={currentAccount:async()=>account};
 const operator=env=>world({stubs:{'./accounts':accounts},env})('lib/server/website-requirements.ts');
 assert.equal(await operator({NODE_ENV:'production'}).canReadRequirements(new Request('http://localhost/')),false);
 assert.equal(await operator({NODE_ENV:'production',REQUIREMENTS_ADMIN_EMAILS:'op@example.com'}).canReadRequirements(new Request('https://studio.example/')),true);
 assert.equal(await operator({NODE_ENV:'development'}).canReadRequirements(new Request('http://localhost/')),true);
 assert.equal(await operator({NODE_ENV:'development'}).canReadRequirements(new Request('http://studio.example/')),false);
 account=null;assert.equal(await operator({NODE_ENV:'production',REQUIREMENTS_ADMIN_EMAILS:'op@example.com'}).canReadRequirements(new Request('https://studio.example/')),false);
 console.log('PASS: production without admin list denies operator even on localhost; development keeps localhost rule');

 // 5. Signup: production default closed, SIGNUP_ENABLED=true opens it, development default open.
 const signupDir=tmpDir('ms-ops-signup-'),auth=env=>world({env,cwd:signupDir})('lib/server/accounts.ts');
 const register=email=>({action:'register',name:'테스트',email,password:'correct horse 123'});
 await assert.rejects(auth({NODE_ENV:'production'}).authenticate(register('a@example.com')),/가입이 닫혀/);
 await assert.rejects(auth({NODE_ENV:'development',SIGNUP_ENABLED:'false'}).authenticate(register('a@example.com')),/가입이 닫혀/);
 assert.match((await auth({NODE_ENV:'production',SIGNUP_ENABLED:'true'}).authenticate(register('a@example.com'))).token,/^[a-f0-9]{64}$/);
 assert.match((await auth({}).authenticate(register('b@example.com'))).token,/^[a-f0-9]{64}$/);
 assert.equal((await auth({NODE_ENV:'production'}).authenticate({action:'login',email:'A@example.com',password:'correct horse 123'})).identity.email,'a@example.com');
 await assert.rejects(auth({NODE_ENV:'production'}).authenticate({action:'login',email:'a@example.com',password:'wrong password'}),/비밀번호를 확인/);
 console.log('PASS: signup closed in production by default, SIGNUP_ENABLED overrides, login still works');

 // 6. Login limiter: per-email and global windows; many tracked emails drop oldest records instead of blocking everyone.
 const {createLoginLimiter}=auth({});
 const limiter=createLoginLimiter({emailLimit:2,globalLimit:4,globalWindow:1000,maxTracked:3});
 limiter.attempt('a@x.io',0);limiter.attempt('a@x.io',1);assert.throws(()=>limiter.attempt('a@x.io',2),/시도가 많습니다/);
 limiter.attempt('b@x.io',3);limiter.attempt('c@x.io',4);assert.throws(()=>limiter.attempt('d@x.io',5),/시도가 많습니다/);
 limiter.attempt('d@x.io',1001);limiter.attempt('e@x.io',1002);assert.ok(limiter.tracked<=3);
 const wide=createLoginLimiter({globalLimit:1e6,maxTracked:2000});for(let i=0;i<2500;i++)wide.attempt(`user${i}@x.io`,10);wide.attempt('operator@x.io',10);assert.equal(wide.tracked,2000);
 const known=createLoginLimiter({emailLimit:2,globalLimit:1,globalWindow:1000});known.attempt('ghost@x.io',0);assert.throws(()=>known.attempt('ghost2@x.io',1),/시도가 많습니다/);
 known.attempt('op@x.io',2,true);known.attempt('op@x.io',3,true);assert.throws(()=>known.attempt('op@x.io',4,true),/시도가 많습니다/);
 const liveAuth=auth({NODE_ENV:'production'});
 for(let i=0;i<300;i++)await assert.rejects(liveAuth.authenticate({action:'login',email:`ghost${i}@example.com`,password:'wrong password'}),/비밀번호를 확인/);
 await assert.rejects(liveAuth.authenticate({action:'login',email:'ghost-next@example.com',password:'wrong password'}),/시도가 많습니다/);
 assert.equal((await liveAuth.authenticate({action:'login',email:'a@example.com',password:'correct horse 123'})).identity.email,'a@example.com');
 console.log('PASS: login limiter per-email + global window (unknown emails only), 300 unknown-email logins do not lock out a real account, 2500 tracked emails do not lock out the operator');

 // 7. account:create — hidden prompt (stdin when no TTY), duplicate refused, --reset revokes sessions.
 const accountDir=tmpDir('ms-ops-account-');
 const create=(args,input)=>run('account-create.cjs',args,{cwd:accountDir,input});
 assert.equal(create([],'').status,1);
 assert.equal(create(['op@example.com'],'password-123\nother-pass-123\n').status,1);
 assert.equal(create(['op@example.com'],'short\nshort\n').status,1);
 let result=create(['Op@Example.com','--name','운영자'],'password-123\npassword-123\n');assert.equal(result.status,0,result.stderr);assert.doesNotMatch(result.stdout,/password-123/);
 const files=world({cwd:accountDir})('lib/account-store.ts');
 assert.equal((await files.verifyPassword('op@example.com','password-123')).name,'운영자');
 result=create(['op@example.com'],'password-456\npassword-456\n');assert.equal(result.status,1);assert.match(result.stderr,/이미 있는 계정/);
 assert.equal(create(['new@example.com','--reset'],'password-456\npassword-456\n').status,1);
 const oldToken=await files.createSession({name:'운영자',email:'op@example.com'});const otherToken=await files.createSession({name:'x',email:'x@example.com'});
 result=create(['op@example.com','--reset'],'password-456\npassword-456\n');assert.equal(result.status,0,result.stderr);
 assert.equal(await files.readSession(oldToken),null);assert.equal((await files.readSession(otherToken)).email,'x@example.com');
 assert.equal(await files.verifyPassword('op@example.com','password-123'),null);assert.equal((await files.verifyPassword('op@example.com','password-456')).name,'운영자');
 console.log('PASS: account:create creates operator, refuses duplicate and bad input, --reset changes password and ends its sessions');

 // 8. Backup: online SQLite copy, skipped lock/wal/shm, folder 0700, retention by count and total size.
 const site=tmpDir('ms-ops-backup-'),live=path.join(site,'.local-data');fs.mkdirSync(path.join(live,'renders'),{recursive:true});fs.mkdirSync(path.join(live,'files'),{recursive:true});
 const db=new DatabaseSync(path.join(live,'inquiries.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE t(v TEXT); INSERT INTO t VALUES (\'one\'),(\'two\');');
 fs.writeFileSync(path.join(live,'files','a.txt'),'original');fs.writeFileSync(path.join(live,'render.lock'),'job-1');
 fs.writeFileSync(path.join(live,'renders','job-1.json'),JSON.stringify({id:'job-1',status:'processing',pid:1234}));fs.writeFileSync(path.join(live,'renders','job-2.json'),JSON.stringify({id:'job-2',status:'completed'}));
 assert.ok(fs.existsSync(path.join(live,'inquiries.sqlite-wal')));
 const backups=path.join(site,'backups'),list=()=>fs.readdirSync(backups).filter(name=>!name.startsWith('.')).sort();
 for(let i=0;i<3;i++){result=run('backup.cjs',[],{cwd:site,env:{BACKUP_KEEP:'2'}});assert.equal(result.status,0,result.stderr);}
 assert.equal(list().length,2);
 const newest=path.join(backups,list().at(-1));
 assert.ok(fs.existsSync(path.join(newest,'manifest.json'))&&fs.existsSync(path.join(newest,'files','a.txt')));
 for(const skipped of ['render.lock','inquiries.sqlite-wal','inquiries.sqlite-shm'])assert.ok(!fs.existsSync(path.join(newest,skipped)),skipped);
 const copy=new DatabaseSync(path.join(newest,'inquiries.sqlite'));assert.equal(copy.prepare('SELECT count(*) AS n FROM t').get().n,2);copy.close();
 if(process.platform!=='win32')assert.equal(fs.statSync(backups).mode&0o777,0o700);
 result=run('backup.cjs',[],{cwd:site,env:{BACKUP_MAX_BYTES:'1'}});assert.equal(result.status,0,result.stderr);assert.equal(list().length,1,'size cap keeps only the newest');
 console.log('PASS: backup copies SQLite online (WAL), skips lock/wal/shm, keeps N newest and respects total size cap');

 // 9. Restore: needs --yes, refuses while the server answers, saves current data first, marks running renders failed.
 const source=list()[0];
 db.exec("INSERT INTO t VALUES ('three')");db.close();fs.writeFileSync(path.join(live,'files','a.txt'),'changed');fs.writeFileSync(path.join(live,'files','new.txt'),'new');
 const down={MOTION_STUDIO_URL:'http://127.0.0.1:9'};
 result=run('restore.cjs',[source],{cwd:site,env:down});assert.equal(result.status,1);assert.match(result.stderr,/--yes/);
 const server=http.createServer((_q,res)=>{res.statusCode=200;res.end('{}');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const up=await new Promise(resolve=>{const child=spawn(process.execPath,[path.join(ROOT,'scripts','restore.cjs'),source,'--yes'],{cwd:site,env:{...process.env,MOTION_STUDIO_URL:`http://127.0.0.1:${server.address().port}`}});let err='';child.stderr.on('data',chunk=>err+=chunk);child.on('close',code=>resolve({code,err}));});
 server.close();assert.equal(up.code,1);assert.match(up.err,/서버가 아직 응답/);
 assert.equal(fs.readFileSync(path.join(live,'files','a.txt'),'utf8'),'changed');
 result=run('restore.cjs',[source,'--yes'],{cwd:site,env:down});assert.equal(result.status,0,result.stderr);
 assert.equal(fs.readFileSync(path.join(live,'files','a.txt'),'utf8'),'original');assert.ok(!fs.existsSync(path.join(live,'files','new.txt')));assert.ok(!fs.existsSync(path.join(live,'manifest.json')));assert.ok(!fs.existsSync(path.join(live,'render.lock')));
 const restored=new DatabaseSync(path.join(live,'inquiries.sqlite'));assert.equal(restored.prepare('SELECT count(*) AS n FROM t').get().n,2);restored.close();
 const job=JSON.parse(fs.readFileSync(path.join(live,'renders','job-1.json'),'utf8'));assert.equal(job.status,'failed');assert.equal(job.pid,undefined);
 assert.equal(JSON.parse(fs.readFileSync(path.join(live,'renders','job-2.json'),'utf8')).status,'completed');
 const safety=list().find(name=>name.includes('pre-restore'));assert.ok(safety,'pre-restore backup');assert.equal(fs.readFileSync(path.join(backups,safety,'files','a.txt'),'utf8'),'changed');
 console.log('PASS: restore requires --yes and a stopped server, auto-backs up current data, marks running renders failed');

 // 10. Health: only {status}, no internal details; low disk -> 503 with a one-line JSON log (time/path/status).
 const healthDir=tmpDir('ms-ops-health-'),lines=[];
 const health=env=>world({env,cwd:healthDir,stdout:{write:line=>lines.push(line)}})('app/api/health/route.ts');
 let response=await health({}).GET();assert.equal(response.status,200);let text=await response.text();
 assert.deepEqual(JSON.parse(text),{status:'ok'});assert.ok(!text.includes(healthDir)&&!/version|path|disk/i.test(text));assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(fs.readdirSync(path.join(healthDir,'.local-data')),[]);
 response=await health({HEALTH_MIN_FREE_MB:'999999999999'}).GET();assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:'unavailable'});
 assert.equal(lines.length,1);const log=JSON.parse(lines[0]);assert.deepEqual(Object.keys(log).sort(),['level','path','status','time']);assert.equal(log.status,503);assert.equal(log.path,'/api/health');
 lines.length=0;const hook=world({cwd:healthDir,stdout:{write:line=>lines.push(line)}})('instrumentation.ts');
 hook.onRequestError(new Error('secret detail'),{path:'/api/projects?token=abc',method:'POST',headers:{}},{routerKind:'App Router',routePath:'/api/projects',routeType:'route'});
 assert.equal(lines.length,1);assert.ok(lines[0].endsWith('\n')&&!lines[0].slice(0,-1).includes('\n')&&!/secret|token/.test(lines[0]));
 assert.deepEqual((({time,...rest})=>rest)(JSON.parse(lines[0])),{level:'error',path:'/api/projects',status:500});
 console.log('PASS: health returns status only (200/503), probe file removed, error log is one JSON line; instrumentation onRequestError logs one JSON line (500, no query/error text)');
 for(const dir of [data,signupDir,accountDir,site,healthDir])try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
})().catch(error=>{console.error(error);process.exit(1);});
