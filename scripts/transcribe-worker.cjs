// task-011 transcription worker: node scripts/transcribe-worker.cjs <transcript id>
// Same pattern as render-worker.cjs: heartbeat in the job file, cancel file, shared render.lock (one heavy job at a time).
// Logs status words only. Never the transcript text, the audio or file paths.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn,spawnSync}=require('node:child_process');
const id=process.argv[2];if(!/^[a-zA-Z0-9-]{1,80}$/.test(id||''))throw new Error('Invalid job id');
const root=path.join(process.cwd(),'.local-data'),file=path.join(root,'transcripts',id+'.json'),dir=path.join(root,'transcript-files',id),lock=path.join(root,'render.lock'),wav=path.join(dir,'audio.wav');
const env=process.env,TIMEOUT=Number(env.STT_TIMEOUT_MS)>0?Number(env.STT_TIMEOUT_MS):600000;
const MAX_SEGMENTS=500,MAX_CHARS=200,QUEUE_LIMIT=Number(env.STT_QUEUE_LIMIT_MS)>0?Number(env.STT_QUEUE_LIMIT_MS):30*60000;
class Fail extends Error{}
const MAX_REMOTE_BYTES=5*1024*1024;
let job=JSON.parse(fs.readFileSync(file,'utf8')),gone=false,current=null,holding=false;
function update(patch){
 if(!fs.existsSync(file)){gone=true;return;}
 job={...job,...patch,updatedAt:new Date().toISOString(),pid:process.pid};
 const temp=file+'.worker.tmp';fs.writeFileSync(temp,JSON.stringify(job,null,2));
 for(let attempt=0;;attempt++){
  // A record deleted meanwhile (account deleted its media) must not come back.
  if(!fs.existsSync(file)){gone=true;fs.rmSync(temp,{force:true});return;}
  try{fs.renameSync(temp,file);break;}catch(error){if(attempt>=15)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,40);}}
}
const canceled=()=>gone||!fs.existsSync(file)||fs.existsSync(path.join(dir,'cancel'));
function killTree(child){
 if(!child||!child.pid)return;
 if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 else{try{process.kill(-child.pid,'SIGKILL');}catch{try{child.kill('SIGKILL');}catch{}}}
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const watcher=setInterval(()=>{if(canceled()&&current)killTree(current);},300);
const heartbeat=setInterval(()=>{try{update({});}catch{}},3000);
// Runs one tool with an argument array (no shell). A .js/.cjs path runs through node (test doubles). Whole process tree dies on timeout or cancel.
function run(bin,args,{timeoutMs,onStderr}){
 return new Promise((resolve,reject)=>{
  const script=/\.c?js$/i.test(bin),child=spawn(script?process.execPath:bin,script?[bin,...args]:args,{stdio:['ignore','ignore','pipe'],detached:process.platform!=='win32',windowsHide:true});
  current=child;let tail='',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;killTree(child);},timeoutMs);
  child.stderr.on('data',chunk=>{tail=(tail+chunk).slice(-2000);if(onStderr)onStderr(String(chunk));});
  child.once('error',()=>{clearTimeout(timer);current=null;reject(new Fail('음성 인식 도구를 시작하지 못했습니다.'));});
  child.once('exit',code=>{clearTimeout(timer);current=null;child.stderr.destroy();resolve({code,tail,timedOut});});
 });
}
function holderBusy(holder){
 if(!/^[a-zA-Z0-9-]+$/.test(holder))return false;
 for(const record of [path.join(root,'renders',holder+'.json'),path.join(root,'transcripts',holder+'.json')]){
  let other;try{other=JSON.parse(fs.readFileSync(record,'utf8'));}catch{continue;}
  if(!['queued','processing'].includes(other.status))return false;
  if(Date.now()-Date.parse(other.updatedAt)<=30000)return true;
  try{process.kill(other.pid,0);return true;}catch{return false;}
 }
 try{return Date.now()-fs.statSync(lock).mtimeMs<60000;}catch{return false;}
}
const readHolder=()=>{try{return fs.readFileSync(lock,'utf8').trim();}catch{return '';}};
function takeLock(){
 fs.mkdirSync(root,{recursive:true});
 try{fs.writeFileSync(lock,id,{flag:'wx'});return true;}catch{}
 const holder=readHolder();
 if(holder&&holderBusy(holder))return false;
 // Only remove the lock we judged dead: if someone replaced it meanwhile, leave it.
 if(readHolder()!==holder)return false;
 try{fs.unlinkSync(lock);}catch{}
 try{fs.writeFileSync(lock,id,{flag:'wx'});return true;}catch{return false;}
}
const FORMATS={'video/mp4':'mov,mp4,m4a,3gp,3g2,mj2','video/webm':'matroska,webm','audio/mpeg':'mp3','audio/wav':'wav'};
const ffmpegBin=()=>env.STT_FFMPEG_BIN||(process.platform==='win32'?path.join(process.cwd(),'node_modules','@remotion','compositor-win32-x64-msvc','ffmpeg.exe'):'ffmpeg');
async function extract(){
 const media=JSON.parse(fs.readFileSync(path.join(root,'media',job.mediaId+'.json'),'utf8'));
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(media.id||'')||media.id!==job.mediaId||media.ownerId!==job.ownerId)throw new Fail('파일을 찾을 수 없습니다.');
 const format=FORMATS[media.mimeType];if(!format)throw new Fail('지원하지 않는 파일 형식입니다.');
 // -f forces the demuxer from the stored mime type (no probing of attacker-chosen containers); only plain files may be opened (no network, no concat/playlist hops).
 const args=['-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','file','-f',format,'-i',path.join(root,'files',media.id),'-map','0:a:0','-t','300','-vn','-ac','1','-ar','16000','-c:a','pcm_s16le','-f','wav','-y',wav];
 const result=await run(ffmpegBin(),args,{timeoutMs:Math.min(TIMEOUT,120000)});
 if(canceled())throw new Fail('canceled');
 if(result.timedOut)throw new Fail('오디오 추출 시간이 초과되었습니다.');
 if(result.code!==0){if(/matches no streams/i.test(result.tail))throw new Fail('오디오 트랙이 없는 파일입니다.');throw new Fail('오디오를 추출하지 못했습니다.');}
 if(!fs.existsSync(wav)||fs.statSync(wav).size<44)throw new Fail('오디오를 추출하지 못했습니다.');
}
async function local(){
 const models=env.STT_MODEL_DIR||path.join(process.cwd(),'.stt-models'),name=job.mode==='fast'?'base':'small',bin=env.STT_WHISPER_BIN||'/usr/local/bin/whisper-cli';
 const model=path.join(models,`ggml-${name}.bin`);if(!fs.existsSync(model))throw new Fail('음성 인식 모델이 없습니다.');
 const threads=Math.max(1,Math.min(Number(env.STT_THREADS)||Math.min(4,os.cpus().length),32)),out=path.join(dir,'result');
 const result=await run(bin,['-m',model,'-f',wav,'-l',job.language,'-t',String(threads),'-oj','-of',out,'-pp'],{timeoutMs:TIMEOUT,onStderr:text=>{const match=/progress\s*=\s*(\d{1,3})%/.exec(text);if(match)update({progress:.1+Math.min(100,Number(match[1]))/100*.85,stage:'음성 인식 중'});}});
 if(canceled())throw new Fail('canceled');
 if(result.timedOut)throw new Fail('음성 인식 시간이 초과되었습니다.');
 if(result.code!==0)throw new Fail('음성 인식에 실패했습니다.');
 let parsed;try{parsed=JSON.parse(fs.readFileSync(out+'.json','utf8'));}catch{throw new Fail('음성 인식 결과를 읽지 못했습니다.');}
 return (Array.isArray(parsed.transcription)?parsed.transcription:[]).map(item=>({start:Number(item?.offsets?.from)/1000,end:Number(item?.offsets?.to)/1000,text:item?.text}));
}
async function remote(){
 const key=env.OPENAI_API_KEY,model=env.OPENAI_STT_MODEL;
 if(!key||!model||!job.consentAt)throw new Fail('외부 음성 인식을 사용할 수 없습니다.');
 const url=new URL(env.STT_REMOTE_ENDPOINT||'https://api.openai.com/v1/audio/transcriptions');
 if(!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw new Fail('외부 음성 인식 주소가 올바르지 않습니다.');
 const form=new FormData();form.append('file',new Blob([fs.readFileSync(wav)],{type:'audio/wav'}),'audio.wav');form.append('model',model);form.append('response_format','verbose_json');if(job.language!=='auto')form.append('language',job.language);
 update({progress:.3,stage:'외부 서비스로 전송 중'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(TIMEOUT,300000)),poll=setInterval(()=>{if(canceled())controller.abort();},300);
 try{
  const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:controller.signal,redirect:'error'});
  if(!response.ok)throw new Fail('외부 음성 인식 요청이 실패했습니다.');
  const length=Number(response.headers.get('content-length'));
  if(Number.isFinite(length)&&length>MAX_REMOTE_BYTES)throw new Fail('외부 음성 인식 응답이 너무 큽니다.');
  const bodyText=await response.text();if(bodyText.length>MAX_REMOTE_BYTES)throw new Fail('외부 음성 인식 응답이 너무 큽니다.');
  let parsed;try{parsed=JSON.parse(bodyText);}catch{throw new Fail('외부 음성 인식 응답을 읽지 못했습니다.');}
  return (Array.isArray(parsed.segments)?parsed.segments:[]).map(item=>({start:Number(item?.start),end:Number(item?.end),text:item?.text}));
 }catch(error){
  if(canceled())throw new Fail('canceled');
  if(error instanceof Fail)throw error;
  throw new Fail(controller.signal.aborted?'외부 음성 인식 시간이 초과되었습니다.':'외부 음성 인식 요청이 실패했습니다.');
 }finally{clearTimeout(timer);clearInterval(poll);}
}
// Output limits (same numbers as validateSegments in lib/model.ts): 500 segments, 200 chars, start<end, monotonic, inside the media length.
// Small overlaps (<=0.25s) and an end up to 1s past the length are clamped; anything bigger is a bad result.
// Markers such as [BLANK_AUDIO], (음악), [Music], ♪ ♪ are not speech.
const NON_SPEECH=/^(?:[\[(（【＜<][^\])）】＞>]*[\])）】＞>]|[♪♫\s]+)$/;
function finalize(raw){
 const out=[];let previousEnd=0;
 for(const item of raw){
  const text=String(item.text??'').replace(/\s+/g,' ').trim();if(!text||NON_SPEECH.test(text))continue;
  let start=Math.round(item.start*1000)/1000,end=Math.round(item.end*1000)/1000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0)throw new Fail('음성 인식 결과의 시간이 올바르지 않습니다.');
  if(start<previousEnd-.25)throw new Fail('음성 인식 결과의 시간 순서가 올바르지 않습니다.');
  // Parts past the media length are clamped or dropped, not an error.
  start=Math.max(start,previousEnd);end=Math.min(end,job.durationSeconds);if(end<=start)continue;
  if([...text].length>MAX_CHARS)throw new Fail('음성 인식 결과의 문장이 너무 깁니다.');
  out.push({start,end,text});previousEnd=end;
  if(out.length>MAX_SEGMENTS)throw new Fail('음성 인식 결과의 구간이 너무 많습니다.');
 }
 if(!out.length)throw new Fail('인식된 말이 없습니다.');
 return out;
}
(async()=>{
 try{
  fs.mkdirSync(dir,{recursive:true});update({});
  const waitStart=Date.now();
  while(!takeLock()){if(canceled())throw new Fail('canceled');if(Date.now()-waitStart>QUEUE_LIMIT)throw new Fail('대기 시간이 30분을 넘어 중단되었습니다. 잠시 후 다시 시도해 주세요.');update({stage:'다른 작업이 끝나기를 기다리는 중'});await sleep(Number(env.STT_LOCK_POLL_MS)||1000);}
  holding=true;
  if(canceled())throw new Fail('canceled');
  update({status:'processing',stage:'오디오 추출',progress:.02});
  await extract();
  update({stage:'음성 인식 중',progress:.1});
  const segments=finalize(job.engine==='remote'?await remote():await local());
  if(canceled())throw new Fail('canceled');
  update({status:'done',progress:1,stage:'완료',segments,error:undefined});
 }catch(error){
  const stopped=canceled();
  try{update({status:stopped?'canceled':'failed',stage:stopped?'취소됨':'실패',error:stopped?undefined:(error instanceof Fail?error.message:'음성 인식 중 오류가 발생했습니다.')});}catch{}
 }finally{
  clearInterval(watcher);clearInterval(heartbeat);killTree(current);
  fs.rmSync(wav,{force:true});fs.rmSync(path.join(dir,'result.json'),{force:true});
  if(gone||!fs.existsSync(file))fs.rmSync(dir,{recursive:true,force:true});
  if(holding){try{if(fs.readFileSync(lock,'utf8').trim()===id)fs.unlinkSync(lock);}catch{}}
 }
})();
