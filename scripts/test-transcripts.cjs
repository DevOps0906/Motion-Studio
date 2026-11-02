// task-011: speech transcription. Real route handlers + the real worker script run against a temp .local-data.
// The engines are fake executables (ffmpeg / whisper-cli stand-ins) and the external service is a local HTTP server: no model, binary or network download is ever used.
const fs=require('fs'),os=require('os'),path=require('path'),ts=require('typescript'),assert=require('assert/strict'),http=require('http'),crypto=require('crypto');
const {spawn}=require('child_process');
const ROOT=process.cwd(),BASE='http://studio.test',NF={error:'찾을 수 없습니다.'};
const tmpDir=prefix=>fs.mkdtempSync(path.join(os.tmpdir(),prefix));
let PIDFILE='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,what,timeout=25000){const start=Date.now();for(;;){const value=await check();if(value)return value;if(Date.now()-start>timeout)throw new Error('timeout waiting for '+what);await sleep(120);}}
const readPids=()=>{try{return JSON.parse(fs.readFileSync(PIDFILE,'utf8'));}catch{return false;}};
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
// TypeScript loader as in test-ownership.cjs; process.env is the real environment so the spawned worker sees the same STT_* settings.
function world(cwd){
 const cache=new Map();
 const fakeProcess={cwd:()=>cwd,env:process.env,platform:process.platform,execPath:process.execPath,kill:process.kill.bind(process),stdout:process.stdout,stderr:process.stderr};
 const stubs={'server-only':{},'next/server':{after:()=>{},NextResponse:{}}};
 function load(file){
  const key=path.resolve(file);if(cache.has(key))return cache.get(key).exports;
  const module={exports:{}};cache.set(key,module);
  const code=ts.transpileModule(fs.readFileSync(key,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const dir=path.dirname(key);
  const localRequire=id=>{
   if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id];
   if(id.startsWith('.')){const target=path.resolve(dir,id);if(id.endsWith('.json'))return require(target);for(const candidate of [target+'.ts',path.join(target,'index.ts')])if(fs.existsSync(candidate))return load(candidate);throw Error('cannot resolve '+id+' from '+key);}
   return require(id);
  };
  new Function('module','exports','require','process',code)(module,module.exports,localRequire,fakeProcess);
  return module.exports;
 }
 return {load};
}
function request(method,pathname,{cookie,json}={}){
 const init={method,headers:{host:'studio.test',...(cookie?{cookie}:{})}};
 if(json!==undefined){init.body=JSON.stringify(json);init.headers['content-type']='application/json';init.headers['content-length']=String(Buffer.byteLength(init.body));}
 if(!['GET','HEAD','OPTIONS'].includes(method))init.headers.origin=BASE;
 return new Request(BASE+pathname,init);
}
const FAKE_FFMPEG=`
const fs=require('fs');const args=process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG,JSON.stringify({tool:'ffmpeg',args})+'\\n');
if(process.env.FAKE_MODE==='noaudio'){process.stderr.write("Stream map '0:a:0' matches no streams.\\n");process.exit(1);}
fs.writeFileSync(args[args.length-1],Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(200)]));
`;
const FAKE_WHISPER=`
const fs=require('fs'),{spawn}=require('child_process');const args=process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG,JSON.stringify({tool:'whisper',args})+'\\n');
const out=args[args.indexOf('-of')+1]+'.json',mode=process.env.FAKE_MODE||'ok';
const seg=(from,to,text)=>({offsets:{from,to},text});
if(mode==='hang'){
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 fs.writeFileSync(process.env.FAKE_PIDFILE,JSON.stringify([process.pid,child.pid]));
 setInterval(()=>{},1000);
}else{
 process.stderr.write('whisper_print_progress_callback: progress =  50%\\n');
 let list=[seg(0,2500,' <i>안녕하세요</i> 반갑습니다 '),seg(2500,6000,' 두 번째\\n\\n문장 --> 끝 ')];
 if(mode==='many')list=Array.from({length:501},(_,i)=>seg(i*10,i*10+9,'문장 '+i));
 if(mode==='long')list=[seg(0,1000,'가'.repeat(201))];
 if(mode==='clamp')list=[seg(0,2000,'[BLANK_AUDIO]'),seg(2000,4000,' (음악) '),seg(4000,5000,'♪ ♪'),seg(5000,6000,'말'),seg(18000,25000,'끝부분'),seg(30000,31000,'버림')];
 if(mode==='order')list=[seg(0,5000,'하나'),seg(2000,6000,'둘')];
 fs.writeFileSync(out,JSON.stringify({transcription:list}));
}
`;

(async()=>{
 const cwd=tmpDir('ms-stt-'),data=path.join(cwd,'.local-data'),bin=tmpDir('ms-stt-bin-'),models=path.join(cwd,'models-stt');
 fs.mkdirSync(path.join(cwd,'scripts'),{recursive:true});fs.copyFileSync(path.join(ROOT,'scripts','transcribe-worker.cjs'),path.join(cwd,'scripts','transcribe-worker.cjs'));
 fs.cpSync(path.join(ROOT,'public','photos'),path.join(cwd,'public','photos'),{recursive:true});
 const ffmpeg=path.join(bin,'fake-ffmpeg.cjs'),whisper=path.join(bin,'fake-whisper.cjs');
 fs.writeFileSync(ffmpeg,FAKE_FFMPEG);fs.writeFileSync(whisper,FAKE_WHISPER);fs.chmodSync(whisper,0o755);
 fs.mkdirSync(models,{recursive:true});
 const manifest={models:{}};for(const name of ['small','base']){fs.writeFileSync(path.join(models,`ggml-${name}.bin`),'fake-model-'+name);manifest.models[name]={file:`ggml-${name}.bin`,size:('fake-model-'+name).length};}
 fs.writeFileSync(path.join(models,'manifest.json'),JSON.stringify(manifest));
 const log=path.join(bin,'calls.log'),pidfile=path.join(bin,'pids.json');PIDFILE=pidfile;
 // remote service double
 const hits=[];
 let remoteBig=false;
 const remote=http.createServer((req,res)=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{const body=Buffer.concat(chunks);if(remoteBig){hits.push({big:true});res.writeHead(200,{'content-type':'application/json'});res.end(Buffer.alloc(6*1024*1024,32));return;}hits.push({auth:req.headers.authorization,type:req.headers['content-type'],hasModel:body.includes('stt-test'),size:body.length});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({segments:[{start:0,end:3,text:'외부 결과 문장'}]}));});});
 await new Promise(resolve=>remote.listen(0,'127.0.0.1',resolve));
 Object.assign(process.env,{REQUIREMENTS_ADMIN_EMAILS:'op@example.com',STT_MODEL_DIR:models,STT_WHISPER_BIN:whisper,STT_FFMPEG_BIN:ffmpeg,STT_TIMEOUT_MS:'20000',STT_LOCK_POLL_MS:'150',STT_THREADS:'2',FAKE_LOG:log,FAKE_PIDFILE:pidfile,FAKE_MODE:'ok',
  OPENAI_API_KEY:'sk-test-secret-key',OPENAI_STT_MODEL:'stt-test',STT_REMOTE_ENDPOINT:`http://127.0.0.1:${remote.address().port}/v1/audio/transcriptions`});
 const {load}=world(cwd);
 const accounts=load('lib/account-store.ts');
 const make=async(name,email)=>{const account=await accounts.writeAccount({name,email,password:'correct horse 123'});const token=await accounts.createSession({id:account.id,name,email});return {id:account.id,cookie:`${accounts.SESSION_COOKIE}=${token}`};};
 const A=await make('가','a@example.com'),B=await make('나','b@example.com'),OP=await make('운영자','op@example.com');
 const routes={list:load('app/api/transcripts/route.ts'),engines:load('app/api/transcripts/engines/route.ts'),item:load('app/api/transcripts/[id]/route.ts'),cancel:load('app/api/transcripts/[id]/cancel/route.ts'),exp:load('app/api/transcripts/[id]/export/route.ts'),media:load('app/api/media/[id]/route.ts')};
 const call=(route,method,pathname,who,json,id)=>routes[route][method](request(method,pathname,{cookie:who?.cookie,json}),{params:Promise.resolve(id?{id}:{})});
 const start=(who,body)=>call('list','POST','/api/transcripts',who,body);
 const get=(who,id)=>call('item','GET','/api/transcripts/'+id,who,undefined,id);
 const finish=async(who,id,statuses=['done','failed','canceled'])=>until(async()=>{const job=await (await get(who,id)).json();return statuses.includes(job.status)?job:null;},'job '+statuses);
 const addMedia=(owner,extra={})=>{
  const id=crypto.randomUUID();fs.mkdirSync(path.join(data,'media'),{recursive:true});fs.mkdirSync(path.join(data,'files'),{recursive:true});
  const record={ownerId:owner.id,id,name:'Ünï talk.mp4',type:'video',role:'reference-video',mimeType:'video/mp4',sizeBytes:10,url:'/api/media/'+id,createdAt:new Date().toISOString(),durationSeconds:20,...extra};
  fs.writeFileSync(path.join(data,'media',id+'.json'),JSON.stringify(record));fs.writeFileSync(path.join(data,'files',id),'bytes');return record;
 };
 const calls=tool=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(c=>c.tool===tool):[];
 const mediaA=addMedia(A),audioA=addMedia(A,{name:'voice.wav',type:'audio',role:'audio',mimeType:'audio/wav'});

 // ---- pure helpers: output limits and SRT
 {
  const model=load('lib/model.ts'),t=load('lib/transcript.ts');
  const ok=[{start:0,end:1,text:' a '},{start:1,end:2.5,text:'b'}];
  assert.deepEqual(model.validateSegments(ok,3),[{start:0,end:1,text:'a'},{start:1,end:2.5,text:'b'}]);
  assert.throws(()=>model.validateSegments(Array.from({length:501},(_,i)=>({start:i,end:i+.5,text:'x'}))),/500/);
  assert.equal(model.validateSegments(Array.from({length:500},(_,i)=>({start:i,end:i+.5,text:'x'}))).length,500);
  assert.throws(()=>model.validateSegments([{start:0,end:1,text:'가'.repeat(201)}]),/200/);
  assert.equal(model.validateSegments([{start:0,end:1,text:'가'.repeat(200)}]).length,1);
  assert.throws(()=>model.validateSegments([{start:1,end:1,text:'x'}]),/시작/,'start<end');
  assert.throws(()=>model.validateSegments([{start:0,end:2,text:'x'},{start:1,end:3,text:'y'}]),/시작/,'monotonic');
  assert.throws(()=>model.validateSegments([{start:0,end:4,text:'x'}],3),/길이/,'inside the media length');
  assert.throws(()=>model.validateSegments([{start:0,end:1,text:'  '}]));assert.throws(()=>model.validateSegments([{start:0,end:Infinity,text:'x'}]));
  const project={...load('lib/model.ts').DEFAULT_PROJECT,captions:ok};model.validateProject(project);
  assert.throws(()=>model.validateProject({...project,captions:[{start:2,end:1,text:'x'}]}),/시작/,'validateProject checks captions');
  assert.throws(()=>model.validateProject({...project,captions:Array.from({length:501},(_,i)=>({start:i,end:i+.5,text:'x'}))}),/500/);
  const srt=t.toSrt([{start:0,end:1.5,text:'a\r\n\r\nb\nc\n<i>d</i> {\\an8}e --> f ---> g'},{start:3661.007,end:3662,text:'<b></b>'},{start:4000,end:4001,text:'x\r'}]);
  assert.ok(!srt.startsWith('﻿'));assert.ok(!/(^|[^\r])\n/.test(srt),'CRLF only');
  assert.equal(srt,'1\r\n00:00:00,000 --> 00:00:01,500\r\na\r\nb c d e -> f -> g\r\n\r\n2\r\n01:06:40,000 --> 01:06:41,000\r\nx\r\n\r\n');
  assert.equal(t.srtTime(3661.007),'01:01:01,007');
  const disposition=t.srtDisposition('Ünï "talk"\r\n.mp4');assert.match(disposition,/^attachment; filename="[A-Za-z0-9._-]+\.srt"; filename\*=UTF-8''[A-Za-z0-9%._-]+\.srt$/);
  assert.equal(t.fillCaptionRows(Array.from({length:20},(_,i)=>({start:i,end:i+1,text:'문장'+i}))).length,8);
  assert.equal(t.fillCaptionRows([{start:0,end:1,text:'하나'}]).length,1);
  assert.equal(t.captionRowsTruncated(Array.from({length:9},(_,i)=>({start:i,end:i+1,text:'x'}))),true,'more than 8 rows -> notice');
  assert.equal(t.captionRowsTruncated([{start:0,end:1,text:'가'.repeat(121)}]),true,'over 120 chars -> notice');
  assert.equal(t.captionRowsTruncated([{start:0,end:1,text:'하나'},{start:1,end:2,text:'둘'}]),false);
  assert.ok(t.fillCaptionRows([{start:0,end:1,text:'가'.repeat(200)}])[0].title.length<=120);
  console.log('PASS: output limits (500 segments, 200 chars, start<end, monotonic, inside length) and SRT format (CRLF, no BOM, tags and --> neutralised, max 2 lines, filename*)');
 }

 // ---- engines, input checks
 {
  let res=await call('engines','GET','/api/transcripts/engines',A);assert.deepEqual(await res.json(),{maxSeconds:300,local:{accurate:true,fast:true},remote:false});
  assert.equal((await (await call('engines','GET','/x',OP)).json()).remote,true,'operator sees the external engine');
  assert.equal((await call('engines','GET','/x',null)).status,401);
  const longAudio=addMedia(A,{type:'audio',role:'audio',mimeType:'audio/mpeg',durationSeconds:301});
  res=await start(A,{mediaId:longAudio.id});assert.equal(res.status,400);assert.match((await res.json()).error,/5분/);
  const exact=addMedia(A,{type:'audio',role:'audio',mimeType:'audio/mpeg',durationSeconds:300});
  fs.writeFileSync(path.join(data,'media',exact.id+'.json'),JSON.stringify({...exact,durationSeconds:undefined}));
  assert.equal((await start(A,{mediaId:exact.id})).status,400,'unknown length is refused');
  const image=addMedia(A,{type:'image',mimeType:'image/png',durationSeconds:undefined});assert.equal((await start(A,{mediaId:image.id})).status,400);
  assert.equal((await start(A,{mediaId:'../x'})).status,400);assert.equal((await start(A,{mediaId:mediaA.id,language:'xx'})).status,400);
  res=await start(A,{mediaId:mediaA.id,ownerId:B.id});assert.equal(res.status,202);const own=await res.json();assert.equal(own.ownerId,A.id,'client ownerId is ignored');
  await finish(A,own.id);
  assert.equal((await start(B,{mediaId:mediaA.id})).status,404,"another account's media");assert.deepEqual(await (await start(B,{mediaId:mediaA.id})).json(),NF);
  assert.equal((await start(OP,{mediaId:mediaA.id})).status,404,'no operator exception');
  assert.equal((await start(null,{mediaId:mediaA.id})).status,401);
  const noModels=await (async()=>{const keep=process.env.STT_MODEL_DIR;process.env.STT_MODEL_DIR=path.join(cwd,'none');const r=await start(A,{mediaId:mediaA.id});process.env.STT_MODEL_DIR=keep;return r;})();
  assert.equal(noModels.status,503,'no verified model -> local engine off');
  fs.writeFileSync(path.join(models,'ggml-small.bin'),'tampered-size-differs');assert.equal((await start(A,{mediaId:mediaA.id,mode:'accurate'})).status,503,'model file that no longer matches the manifest');
  fs.writeFileSync(path.join(models,'ggml-small.bin'),'fake-model-small');
  console.log('PASS: >300s and unknown length -> 400, images refused, foreign media 404 (also for the operator), engine off without a verified model');
 }

 // ---- happy path, ffmpeg arguments, log content, edit, SRT export
 {
  fs.rmSync(log,{force:true});
  const res=await start(A,{mediaId:mediaA.id});assert.equal(res.status,202);const job=await res.json();assert.equal(job.status,'queued');
  const done=await finish(A,job.id);assert.equal(done.status,'done',JSON.stringify(done));
  assert.deepEqual(done.segments,[{start:0,end:2.5,text:'<i>안녕하세요</i> 반갑습니다'},{start:2.5,end:6,text:'두 번째 문장 --> 끝'}]);
  const [extract]=calls('ffmpeg'),args=extract.args,at=name=>args.indexOf(name);
  assert.equal(args[at('-protocol_whitelist')+1],'file');assert.ok(at('-protocol_whitelist')<at('-i'));
  assert.equal(args[at('-f')+1],'mov,mp4,m4a,3gp,3g2,mj2','demuxer forced from the stored mime type');assert.ok(at('-f')<at('-i'));
  assert.ok(args.includes('-nostdin'));assert.equal(args[at('-map')+1],'0:a:0');assert.equal(args[at('-t')+1],'300');assert.equal(args[at('-i')+1],path.join(data,'files',mediaA.id));
  const wh=calls('whisper')[0].args;assert.equal(wh[wh.indexOf('-l')+1],'ko');assert.equal(path.basename(wh[wh.indexOf('-m')+1]),'ggml-small.bin');
  const audio=await (await start(A,{mediaId:audioA.id,mode:'fast',language:'auto'})).json();await finish(A,audio.id);
  const wavArgs=calls('ffmpeg')[1].args;assert.equal(wavArgs[wavArgs.indexOf('-f')+1],'wav');assert.ok(wavArgs.includes('-protocol_whitelist'));
  const w2=calls('whisper')[1].args;assert.equal(path.basename(w2[w2.indexOf('-m')+1]),'ggml-base.bin');assert.equal(w2[w2.indexOf('-l')+1],'auto');
  assert.ok(!fs.existsSync(path.join(data,'transcript-files',job.id,'audio.wav')),'temporary audio is removed');assert.ok(!fs.existsSync(path.join(data,'render.lock')),'lock released');
  const workerLog=fs.readFileSync(path.join(data,'transcript-files',job.id,'worker.log'),'utf8');
  assert.ok(!workerLog.includes('안녕하세요')&&!workerLog.includes(data),'worker log has neither text nor paths');
  // edits
  assert.equal((await call('item','PATCH','/x',A,{segments:[{start:0,end:3,text:'a'},{start:2,end:4,text:'b'}]},job.id)).status,400,'overlap refused');
  assert.equal((await call('item','PATCH','/x',A,{segments:[{start:0,end:30,text:'a'}]},job.id)).status,400,'beyond the media length refused');
  assert.equal((await call('item','PATCH','/x',A,{segments:[{start:0,end:1,text:'가'.repeat(201)}]},job.id)).status,400);
  let patched=await call('item','PATCH','/x',A,{segments:[{start:0,end:2,text:'첫 <b>줄</b>\n둘째 줄\n셋째 줄'},{start:2,end:4,text:'두 번째'}],ownerId:B.id},job.id);assert.equal(patched.status,200);
  const saved=await patched.json();assert.equal(saved.edited,true);assert.equal(saved.ownerId,A.id);
  // export (edited text), headers
  const exp=await call('exp','GET','/x',A,undefined,job.id);assert.equal(exp.status,200);
  assert.equal(exp.headers.get('content-type'),'application/x-subrip; charset=utf-8');
  const disp=exp.headers.get('content-disposition');assert.match(disp,/^attachment; filename="[A-Za-z0-9._-]+\.srt"; filename\*=UTF-8''%C3%9Cn%C3%AF%20talk\.srt$/);
  const text=Buffer.from(await exp.arrayBuffer());assert.notEqual(text[0],0xEF,'no BOM');
  assert.equal(text.toString('utf8'),'1\r\n00:00:00,000 --> 00:00:02,000\r\n첫 줄\r\n둘째 줄 셋째 줄\r\n\r\n2\r\n00:00:02,000 --> 00:00:04,000\r\n두 번째\r\n\r\n');
  assert.equal((await call('exp','GET','/x',B,undefined,job.id)).status,404);assert.deepEqual(await (await call('exp','GET','/x',B,undefined,job.id)).json(),NF);
  console.log('PASS: ffmpeg gets -protocol_whitelist file and a forced -f before -i (mp4, wav), edits are validated and exported as SRT with filename*, worker log has no text or paths');
 }

 // ---- no audio track
 {
  process.env.FAKE_MODE='noaudio';
  const job=await finish(A,(await (await start(A,{mediaId:mediaA.id})).json()).id);
  assert.equal(job.status,'failed');assert.match(job.error,/오디오 트랙/);assert.ok(!fs.existsSync(path.join(data,'render.lock')));
  console.log('PASS: a video without an audio track ends as failed with a clear message');
 }

 // ---- output limits through the worker
 for(const [mode,pattern] of [['many',/구간이 너무 많/],['long',/문장이 너무 깁/],['order',/시간 순서/]]){
  process.env.FAKE_MODE=mode;
  const job=await finish(A,(await (await start(A,{mediaId:mediaA.id})).json()).id);
  assert.equal(job.status,'failed',mode);assert.match(job.error,pattern,mode);assert.equal(job.segments,undefined);
 }
 console.log('PASS: worker output over 500 segments, over 200 chars or out of order fails the job');

 // ---- non-speech markers are dropped, parts beyond the media length are clamped/dropped (not a failure)
 {
  process.env.FAKE_MODE='clamp';
  const job=await finish(A,(await (await start(A,{mediaId:mediaA.id})).json()).id);
  assert.equal(job.status,'done',JSON.stringify(job));assert.deepEqual(job.segments,[{start:5,end:6,text:'말'},{start:18,end:20,text:'끝부분'}]);
  process.env.FAKE_MODE='ok';
  console.log('PASS: [BLANK_AUDIO] / (음악) / ♪ are filtered and segments past the media length are clamped or dropped');
 }

 // ---- parallel requests of one account: only one starts
 {
  const [x,y]=await Promise.all([start(A,{mediaId:mediaA.id}),start(A,{mediaId:mediaA.id})]);
  assert.deepEqual([x.status,y.status].sort(),[202,429]);const winner=await (x.status===202?x:y).json();await finish(A,winner.id);
  console.log('PASS: two parallel requests of one account -> one 202, one 429');
 }

 // ---- cancel kills the whole process tree; second request while busy; lock held while running
 {
  process.env.FAKE_MODE='hang';fs.rmSync(pidfile,{force:true});
  const job=await (await start(A,{mediaId:mediaA.id})).json();
  const [enginePid,childPid]=await until(()=>readPids(),'engine pids');
  assert.ok(alive(enginePid)&&alive(childPid));
  assert.equal(fs.readFileSync(path.join(data,'render.lock'),'utf8'),job.id,'transcription holds render.lock');
  assert.equal((await start(A,{mediaId:audioA.id})).status,429,'one active job per account');
  // the other direction: a render cannot start while the transcription holds the lock
  const image=addMedia(A,{type:'image',role:'photo',mimeType:'image/png',durationSeconds:undefined});
  const {DEFAULT_PROJECT}=load('lib/model.ts'),{startRender}=load('lib/server/render.ts');
  await assert.rejects(startRender({...DEFAULT_PROJECT,photos:[image.id]},BASE,{id:A.id,operator:false}),/다른 영상이 렌더 중/);
  assert.equal(fs.readFileSync(path.join(data,'render.lock'),'utf8'),job.id,'a refused render leaves the lock alone');
  assert.equal((await call('cancel','POST','/x',B,undefined,job.id)).status,404);
  assert.equal((await call('cancel','POST','/x',A,undefined,job.id)).status,200);
  const ended=await finish(A,job.id);assert.equal(ended.status,'canceled');
  await until(()=>!alive(enginePid)&&!alive(childPid),'process tree to die',8000);
  assert.ok(!fs.existsSync(path.join(data,'render.lock')),'lock released after cancel');
  assert.equal((await call('cancel','POST','/x',A,undefined,job.id)).status,400,'finished jobs cannot be canceled');
  console.log('PASS: cancel ends engine and its child process, releases render.lock; a render is refused while a transcription runs; one active job per account');
 }

 // ---- timeout kills the tree
 {
  process.env.FAKE_MODE='hang';process.env.STT_TIMEOUT_MS='1500';fs.rmSync(pidfile,{force:true});
  const job=await (await start(A,{mediaId:mediaA.id})).json();
  const [enginePid,childPid]=await until(()=>readPids(),'engine pids');
  const ended=await finish(A,job.id);assert.equal(ended.status,'failed');assert.match(ended.error,/시간이 초과/);
  await until(()=>!alive(enginePid)&&!alive(childPid),'process tree to die',8000);assert.ok(!fs.existsSync(path.join(data,'render.lock')));
  process.env.STT_TIMEOUT_MS='20000';
  console.log('PASS: timeout ends the engine process tree and fails the job');
 }

 // ---- shares render.lock: waits while a render runs
 {
  process.env.FAKE_MODE='ok';fs.rmSync(log,{force:true});
  const renderId=crypto.randomUUID(),renderFile=path.join(data,'renders',renderId+'.json');fs.mkdirSync(path.dirname(renderFile),{recursive:true});
  const setRender=status=>fs.writeFileSync(renderFile,JSON.stringify({id:renderId,status,updatedAt:new Date().toISOString(),pid:process.pid}));
  setRender('processing');fs.writeFileSync(path.join(data,'render.lock'),renderId);
  const job=await (await start(A,{mediaId:mediaA.id})).json();
  await sleep(1500);
  let now=await (await get(A,job.id)).json();assert.equal(now.status,'queued');assert.match(now.stage,/기다리는/);assert.equal(calls('ffmpeg').length,0,'nothing runs while the render holds the lock');
  assert.equal(fs.readFileSync(path.join(data,'render.lock'),'utf8'),renderId);
  setRender('completed');
  const done=await finish(A,job.id);assert.equal(done.status,'done');assert.equal(calls('ffmpeg').length,1);assert.ok(!fs.existsSync(path.join(data,'render.lock')));
  // a lock left behind by a dead process does not block
  const ghost=crypto.randomUUID();fs.writeFileSync(path.join(data,'renders',ghost+'.json'),JSON.stringify({id:ghost,status:'processing',updatedAt:new Date(Date.now()-120000).toISOString(),pid:2147483646}));fs.writeFileSync(path.join(data,'render.lock'),ghost);
  assert.equal((await finish(A,(await (await start(A,{mediaId:mediaA.id})).json()).id)).status,'done');
  console.log('PASS: transcription waits (queued) while a render holds render.lock, runs after it ends, and ignores a stale lock');
 }

 // ---- queue wait limit, locks without a record
 {
  const renderId=crypto.randomUUID(),renderFile=path.join(data,'renders',renderId+'.json');
  fs.writeFileSync(renderFile,JSON.stringify({id:renderId,status:'processing',updatedAt:new Date().toISOString(),pid:process.pid}));fs.writeFileSync(path.join(data,'render.lock'),renderId);
  process.env.STT_QUEUE_LIMIT_MS='900';
  const job=await finish(A,(await (await start(A,{mediaId:mediaA.id})).json()).id);
  assert.equal(job.status,'failed');assert.match(job.error,/30분/);
  delete process.env.STT_QUEUE_LIMIT_MS;fs.unlinkSync(path.join(data,'render.lock'));
  // a lock with no record: respected while fresh (<60s), stale after that
  const orphan=crypto.randomUUID(),lockFile=path.join(data,'render.lock');fs.writeFileSync(lockFile,orphan);
  const waiting=await (await start(A,{mediaId:mediaA.id})).json();await sleep(1000);
  assert.equal((await (await get(A,waiting.id)).json()).status,'queued','fresh lock without a record is respected');
  const old=new Date(Date.now()-5*60000);fs.utimesSync(lockFile,old,old);
  assert.equal((await finish(A,waiting.id)).status,'done','lock without a record and older than 60s is stale');
  fs.writeFileSync(lockFile,orphan);fs.utimesSync(lockFile,old,old);
  const {DEFAULT_PROJECT}=load('lib/model.ts'),{startRender}=load('lib/server/render.ts');
  const image=addMedia(A,{type:'image',role:'photo',mimeType:'image/png',durationSeconds:undefined});
  fs.unlinkSync(lockFile);fs.writeFileSync(lockFile,orphan);
  await assert.rejects(startRender({...DEFAULT_PROJECT,photos:[image.id]},BASE,{id:A.id,operator:false}),/다른 영상이 렌더 중/,'fresh lock blocks a render too');
  fs.unlinkSync(lockFile);
  console.log('PASS: a transcription waits at most the queue limit (then failed with a notice); lock without a record is stale after 60s');
 }

 // ---- external engine
 {
  assert.equal((await start(B,{mediaId:addMedia(B).id,engine:'remote',consent:true})).status,403,'non-operator refused');
  const mediaOp=addMedia(OP);
  let res=await start(OP,{mediaId:mediaOp.id,engine:'remote'});assert.equal(res.status,400);assert.match((await res.json()).error,/동의/);
  res=await start(OP,{mediaId:mediaOp.id,engine:'remote',consent:'true'});assert.equal(res.status,400,'consent must be literally true');
  res=await start(OP,{mediaId:mediaA.id,engine:'remote',consent:true});assert.equal(res.status,404,"operator cannot send another account's media");
  assert.equal(hits.length,0,'no external call without consent, as non-operator or for foreign media');
  const keep=process.env.OPENAI_STT_MODEL;delete process.env.OPENAI_STT_MODEL;assert.equal((await start(OP,{mediaId:mediaOp.id,engine:'remote',consent:true})).status,400,'not configured');process.env.OPENAI_STT_MODEL=keep;assert.equal(hits.length,0);
  res=await start(OP,{mediaId:mediaOp.id,engine:'remote',consent:true});assert.equal(res.status,202);const job=await res.json();assert.ok(job.consentAt);
  const done=await finish(OP,job.id);assert.equal(done.status,'done',JSON.stringify(done));
  assert.equal(hits.length,1);assert.equal(hits[0].auth,'Bearer sk-test-secret-key');assert.match(hits[0].type,/multipart\/form-data/);assert.ok(hits[0].hasModel);
  assert.deepEqual(done.segments,[{start:0,end:3,text:'외부 결과 문장'}]);
  const stored=fs.readFileSync(path.join(data,'transcripts',job.id+'.json'),'utf8')+fs.readFileSync(path.join(data,'transcript-files',job.id,'worker.log'),'utf8');
  assert.ok(!stored.includes('sk-test-secret-key'),'key is not stored or logged');
  remoteBig=true;const big=await finish(OP,(await (await start(OP,{mediaId:mediaOp.id,engine:'remote',consent:true})).json()).id);remoteBig=false;
  assert.equal(big.status,'failed');assert.match(big.error,/너무 큽니다/,'response over 5MB is refused');
  res=await start(OP,{mediaId:mediaOp.id,engine:'remote',consent:true});const second=await res.json();await finish(OP,second.id);assert.equal(hits.length,3,'every request needs its own consent flag');
  assert.equal((await start(OP,{mediaId:mediaOp.id,engine:'remote'})).status,400,'consent is not remembered');
  console.log('PASS: external engine — non-operator refused, no consent flag / foreign media / missing config -> zero external calls, one call per consented request, key never stored');
 }

 // ---- accounts and deletion
 {
  const job=await (await start(A,{mediaId:mediaA.id})).json();await finish(A,job.id);process.env.FAKE_MODE='ok';
  for(const [route,method,body] of [['item','GET'],['item','PATCH',{segments:[]}],['item','DELETE'],['cancel','POST'],['exp','GET']]){
   const res=await call(route,method,'/x',B,body,job.id);assert.equal(res.status,404,route+method);assert.deepEqual(await res.json(),NF);
  }
  assert.deepEqual(await (await call('list','GET','/api/transcripts',B)).json(),[]);
  assert.ok((await (await call('list','GET','/api/transcripts',A)).json()).some(j=>j.id===job.id));
  assert.equal((await call('item','GET','/x',A,undefined,job.id)).status,200);
  // deleting the media deletes its transcripts (also a running one)
  const other=addMedia(A);const keep=await (await start(A,{mediaId:other.id})).json();await finish(A,keep.id);
  assert.equal((await call('media','DELETE','/x',B,undefined,other.id)).status,404);assert.equal((await call('item','GET','/x',A,undefined,keep.id)).status,200,"B cannot remove A's transcripts through the media route");
  assert.equal((await call('media','DELETE','/x',A,undefined,mediaA.id)).status,200);
  assert.equal((await call('item','GET','/x',A,undefined,job.id)).status,404);assert.ok(!fs.existsSync(path.join(data,'transcripts',job.id+'.json')));
  assert.equal((await call('item','GET','/x',A,undefined,keep.id)).status,200,'transcripts of other media stay');
  process.env.FAKE_MODE='hang';fs.rmSync(pidfile,{force:true});
  const running=await (await start(A,{mediaId:other.id})).json();const pids=await until(()=>readPids(),'engine pids');
  assert.equal((await call('media','DELETE','/x',A,undefined,other.id)).status,200);
  await until(()=>pids.every(pid=>!alive(pid)),'running job to stop after its media was deleted',8000);
  assert.equal((await call('item','GET','/x',A,undefined,running.id)).status,404);await until(()=>!fs.existsSync(path.join(data,'render.lock')),'lock release');
  assert.equal((await call('item','DELETE','/x',A,undefined,keep.id)).status,404,'deleted together with its media');
  console.log("PASS: B gets the fixed 404 on A's transcript (read, edit, delete, cancel, export), lists are own-only, deleting media deletes (and stops) its transcripts");
 }

 // ---- stt:model
 {
  const model=require(path.join(ROOT,'scripts','stt-model.cjs'));
  assert.match(model.BASE_URL,/ggerganov\/whisper\.cpp\/resolve\/5359861c739e955e79d9a303bcbc70fb988958b1$/);
  assert.equal(model.MODELS.small.sha256,'1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b');assert.equal(model.MODELS.base.sha256,'60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe');
  const bytes=Buffer.from('not the real model'),server=http.createServer((req,res)=>{res.writeHead(200);res.end(bytes);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`,dir=tmpDir('ms-stt-dl-');
  // pass: a custom expectation that matches
  const expected={file:'ggml-small.bin',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
  await model.installModel('small',{dir,baseUrl:url,expected});
  assert.deepEqual(fs.readFileSync(path.join(dir,'ggml-small.bin')),bytes);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')).models.small.sha256,expected.sha256);
  // fail: the pinned SHA256 does not match -> exit code 1, model removed, engine off
  const result=await new Promise(resolve=>{const child=spawn(process.execPath,[path.join(ROOT,'scripts','stt-model.cjs'),'small'],{cwd,env:{...process.env,STT_MODEL_DIR:dir,STT_MODEL_BASE_URL:url}});let stderr='';child.stderr.on('data',c=>stderr+=c);child.on('close',status=>resolve({status,stderr}));});
  assert.equal(result.status,1);assert.match(result.stderr,/SHA256/);
  assert.ok(!fs.existsSync(path.join(dir,'ggml-small.bin')),'mismatching model is deleted');assert.ok(!fs.existsSync(path.join(dir,'ggml-small.bin.partial')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')).models.small,undefined,'manifest entry removed -> local engine off');
  await assert.rejects(model.installModel('base',{dir,baseUrl:'http://example.com'}),/https/);
  const huge=http.createServer((req,res)=>{res.writeHead(200);const send=()=>{if(!res.write(Buffer.alloc(65536))||true)setImmediate(()=>{if(!res.destroyed)send();});};send();});await new Promise(resolve=>huge.listen(0,'127.0.0.1',resolve));
  await assert.rejects(model.installModel('base',{dir,baseUrl:'http://127.0.0.1:'+huge.address().port,expected:{file:'ggml-base.bin',sha256:'0'.repeat(64),size:1000}}),/크기/,'download stops once it exceeds the expected size');
  assert.ok(!fs.existsSync(path.join(dir,'ggml-base.bin.partial')));huge.closeAllConnections();await new Promise(resolve=>huge.close(resolve));
  await assert.rejects(model.installModel('nope',{dir}));
  await new Promise(resolve=>server.close(resolve));
  console.log('PASS: stt:model keeps the pinned revision and SHA256, a mismatch exits 1, deletes the file and disables the model, plain-http remote sources are refused');
 }
 remote.close();
 console.log('PASS: transcripts');
 process.exit(0);
})().catch(error=>{console.error(error);process.exit(1);});
