import 'server-only';
import {promises as fs,openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileFor,readJson,writeJson,validId} from './store';
import {NotFoundError,type Actor} from './owner';
import {allTranscripts,getOwnedTranscript,transcriptDir,transcriptFile} from './transcribe-store';
import {validateSegments,type MediaAsset} from '../model';
import {TRANSCRIBE_MAX_SECONDS,srtDisposition,toSrt,type TranscriptEngine,type TranscriptJob,type TranscriptLanguage,type TranscriptMode} from '../transcript';
// task-011: local whisper.cpp (default) or an operator-only external engine. The worker (scripts/transcribe-worker.cjs) waits for render.lock, so it never runs together with a render.
export class TranscribeError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export const errorResponse=(error:unknown)=>error instanceof TranscribeError?Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}}):null;
const MODEL_NAME:Record<TranscriptMode,string>={accurate:'small',fast:'base'};
export const sttPaths=()=>({models:process.env.STT_MODEL_DIR||path.join(process.cwd(),'.stt-models'),bin:process.env.STT_WHISPER_BIN||'/usr/local/bin/whisper-cli'});
export const remoteConfigured=()=>Boolean(process.env.OPENAI_API_KEY&&process.env.OPENAI_STT_MODEL);
// A model counts only when `npm run stt:model` verified it (manifest entry written after the SHA256 matched) and the file size still equals the manifest.
export async function localAvailable(mode:TranscriptMode){
 const {models,bin}=sttPaths();
 try{
  await fs.access(bin,process.platform==='win32'?0:1);
  const manifest=JSON.parse(await fs.readFile(path.join(models,'manifest.json'),'utf8')) as {models?:Record<string,{file:string;size:number}>};
  const entry=manifest.models?.[MODEL_NAME[mode]];
  return Boolean(entry&&entry.file===`ggml-${MODEL_NAME[mode]}.bin`&&(await fs.stat(path.join(models,entry.file))).size===entry.size);
 }catch{return false;}
}
export async function engineStatus(actor:Actor){return {maxSeconds:TRANSCRIBE_MAX_SECONDS,local:{accurate:await localAvailable('accurate'),fast:await localAvailable('fast')},remote:actor.operator&&remoteConfigured()};}
const ACTIVE=['queued','processing'];
// Requests of one account are serialized inside the process so two parallel POSTs cannot both pass the "one active job" check.
const starting=new Set<string>();
export async function startTranscribe(input:unknown,actor:Actor){
 if(starting.has(actor.id))throw new TranscribeError('진행 중인 음성 인식이 있습니다. 끝난 뒤 다시 요청해 주세요.',429);
 starting.add(actor.id);
 try{return await startTranscribeLocked(input,actor);}finally{starting.delete(actor.id);}
}
async function startTranscribeLocked(input:unknown,actor:Actor){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TranscribeError('요청 형식이 올바르지 않습니다.');
 const data=input as Record<string,unknown>,engine=data.engine??'local',mode=data.mode??'accurate',language=data.language??'ko';
 if(typeof data.mediaId!=='string'||!validId(data.mediaId))throw new TranscribeError('영상 또는 오디오 파일을 선택해 주세요.');
 if(!['local','remote'].includes(engine as string)||!['accurate','fast'].includes(mode as string)||!['ko','en','auto'].includes(language as string))throw new TranscribeError('음성 인식 설정을 확인해 주세요.');
 // Owner comes from the session; only the account's own media (no operator exception, no source-* samples) can be read.
 let media:MediaAsset;try{media=await readJson<MediaAsset>(fileFor('media',data.mediaId));}catch{throw new NotFoundError();}
 if(media.ownerId!==actor.id)throw new NotFoundError();
 if(media.type!=='video'&&media.type!=='audio')throw new TranscribeError('영상 또는 오디오 파일만 음성 인식할 수 있습니다.');
 if(!(typeof media.durationSeconds==='number')||!(media.durationSeconds>0)||media.durationSeconds>TRANSCRIBE_MAX_SECONDS)throw new TranscribeError(`음성 인식은 ${TRANSCRIBE_MAX_SECONDS/60}분 이하 파일만 지원합니다.`);
 let consentAt:string|undefined;
 if(engine==='remote'){
  if(!actor.operator)throw new TranscribeError('외부 음성 인식은 운영자만 사용할 수 있습니다.',403);
  if(data.consent!==true)throw new TranscribeError('오디오가 외부 사업자로 전송됩니다. 동의 후 다시 요청해 주세요.',400);
  if(!remoteConfigured())throw new TranscribeError('외부 음성 인식이 설정되어 있지 않습니다.',400);
  consentAt=new Date().toISOString();
 }else if(!await localAvailable(mode as TranscriptMode))throw new TranscribeError('로컬 음성 인식을 사용할 수 없습니다. 운영자에게 모델 설치(npm run stt:model)를 요청해 주세요.',503);
 const running=(await allTranscripts()).filter(job=>ACTIVE.includes(job.status));
 if(running.some(job=>job.ownerId===actor.id)||running.length>=5)throw new TranscribeError('진행 중인 음성 인식이 있습니다. 끝난 뒤 다시 요청해 주세요.',429);
 const id=randomUUID(),now=new Date().toISOString(),dir=transcriptDir(id);
 const job:TranscriptJob={ownerId:actor.id,id,mediaId:media.id,mediaName:media.name,durationSeconds:media.durationSeconds,engine:engine as TranscriptEngine,mode:mode as TranscriptMode,language:language as TranscriptLanguage,status:'queued',progress:0,stage:'대기 중',createdAt:now,updatedAt:now,...(consentAt?{consentAt}:{})};
 await fs.mkdir(dir,{recursive:true});await writeJson(transcriptFile(id),job);
 try{
  // The worker log gets status lines only: never transcript text, audio or file paths.
  const log=openSync(path.join(dir,'worker.log'),'a');
  const child=spawn(process.execPath,[path.join(process.cwd(),'scripts','transcribe-worker.cjs'),id],{cwd:process.cwd(),detached:true,windowsHide:true,stdio:['ignore',log,log]});
  closeSync(log);
  await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  child.unref();
  // The worker writes its own pid with its first update (the 30s liveness rule starts from createdAt).
 }catch(error){await fs.unlink(transcriptFile(id)).catch(()=>{});await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});throw error;}
 return job;
}
export async function cancelTranscribe(id:string,actor:Actor){
 const job=await getOwnedTranscript(id,actor,'change');
 if(!ACTIVE.includes(job.status))throw new TranscribeError('진행 중인 음성 인식만 취소할 수 있습니다.');
 await fs.mkdir(transcriptDir(id),{recursive:true});await fs.writeFile(path.join(transcriptDir(id),'cancel'),'requested');
}
// Edited text and times replace the recognised ones (same limits as the recognised output).
export async function saveEditedSegments(id:string,body:unknown,actor:Actor){
 const job=await getOwnedTranscript(id,actor,'change');
 if(job.status!=='done')throw new TranscribeError('완료된 음성 인식만 편집할 수 있습니다.');
 const segments=validateSegments((body as {segments?:unknown}|null)?.segments,job.durationSeconds);
 const saved={...job,segments,edited:true,updatedAt:new Date().toISOString()};await writeJson(transcriptFile(id),saved);return saved;
}
export async function exportSrt(id:string,actor:Actor){
 const job=await getOwnedTranscript(id,actor,'view');
 if(job.status!=='done'||!job.segments)throw new TranscribeError('완료된 음성 인식만 내보낼 수 있습니다.');
 return new Response(toSrt(job.segments),{headers:{'Content-Type':'application/x-subrip; charset=utf-8','Content-Disposition':srtDisposition(job.mediaName),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
