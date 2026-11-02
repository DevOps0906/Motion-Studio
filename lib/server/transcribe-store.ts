import 'server-only';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {DATA,readJson,writeJson,listJson,readOwned,validId} from './store';
import type {Actor,RecordAction} from './owner';
import type {TranscriptJob} from '../transcript';
// task-011: transcript records live in .local-data/transcripts/<id>.json (owner-checked like every other record); work files in transcript-files/<id>/.
export const transcriptFile=(id:string)=>{if(!validId(id))throw new Error('잘못된 ID입니다.');return path.join(DATA,'transcripts',id+'.json');};
export const transcriptDir=(id:string)=>{if(!validId(id))throw new Error('잘못된 ID입니다.');return path.join(DATA,'transcript-files',id);};
const active=(status:string)=>status==='queued'||status==='processing';
// Same liveness rule as renders: an active job whose heartbeat is older than 30s and whose worker is gone has failed.
export async function getTranscript(id:string){
 const job=await readJson<TranscriptJob>(transcriptFile(id));
 if(active(job.status)&&Date.now()-Date.parse(job.updatedAt)>30000){try{if(!job.pid)throw new Error('Missing worker');process.kill(job.pid,0);}catch{job.status='failed';job.error='음성 인식 프로세스가 중단되었습니다. 다시 시도해 주세요.';job.updatedAt=new Date().toISOString();await writeJson(transcriptFile(id),job);}}
 return job;
}
export async function getOwnedTranscript(id:string,actor:Actor,action:RecordAction='view'){await readOwned<TranscriptJob>(()=>transcriptFile(id),actor,'transcript',id,action);return getTranscript(id);}
export async function allTranscripts(){const jobs=await listJson<TranscriptJob>(path.join(DATA,'transcripts'));return (await Promise.all(jobs.map(job=>getTranscript(job.id)))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
// Status of a transcript that may hold render.lock, or undefined when no such transcript exists (used by render.ts).
export async function transcriptStatus(id:string){try{return (await getTranscript(id)).status;}catch{return undefined;}}
export async function removeTranscript(id:string){
 await fs.writeFile(path.join(transcriptDir(id),'cancel'),'requested').catch(()=>{});
 await fs.unlink(transcriptFile(id));
 await fs.rm(transcriptDir(id),{recursive:true,force:true}).catch(()=>{});
}
// Deleting a media file also deletes the transcripts made from it (a running one is stopped: its worker sees the record vanish).
export async function deleteTranscriptsForMedia(mediaId:string){for(const job of await listJson<TranscriptJob>(path.join(DATA,'transcripts')))if(job.mediaId===mediaId)await removeTranscript(job.id).catch(()=>{});}
