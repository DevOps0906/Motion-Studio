import {timingSafeEqual} from 'node:crypto';
import {getJob,snapshotAsset} from '../../../../../../lib/server/render';import {apiError,streamFile} from '../../../../../../lib/server/store';
import {allow,authorize,notFoundResponse} from '../../../../../../lib/server/owner';
export const runtime='nodejs';export const dynamic='force-dynamic';
// The token dies with the render: only queued/processing renders accept it.
const sameToken=(given:string,saved:unknown)=>typeof saved==='string'&&saved.length>0&&given.length===saved.length&&timingSafeEqual(Buffer.from(given),Buffer.from(saved));
// The render worker has no cookie: it sends the per-render assetToken. Otherwise the render's owner session (operator view is audited). Anything else is the fixed 404.
export async function GET(request:Request,{params}:{params:Promise<{id:string;assetId:string}>}){
 try{
  const p=await params;let job;try{job=await getJob(p.id);}catch{return notFoundResponse();}
  if(!(['queued','processing'].includes(job.status)&&sameToken(new URL(request.url).searchParams.get('token')||'',job.assetToken))){
   const actor=await authorize(request);if(actor instanceof Response)return notFoundResponse();
   await allow(actor,job,'render',job.id,'view');
  }
  const asset=await snapshotAsset(p.id,p.assetId);const response=await streamFile(asset.file,asset.mimeType,request);response.headers.set('Access-Control-Allow-Origin','*');return response;
 }catch(e){return apiError(e,404);}
}
