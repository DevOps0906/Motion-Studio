import {after} from 'next/server';
import {INQUIRY_LIMITS} from '../../../lib/inquiry';
import {deliverInquiryAlert,listInquiries,submitInquiry} from '../../../lib/server/inquiries';
import {authorize,ownerLabels,visible} from '../../../lib/server/owner';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
// Rejects by Content-Length first, then stops reading the stream once 16KB is exceeded (null = too large).
async function readLimited(request:Request){
 const declared=Number(request.headers.get('content-length')||0);
 if(declared>INQUIRY_LIMITS.body)return null;
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 for(;;){
  const {done,value}=await reader.read();if(done)break;
  size+=value.byteLength;if(size>INQUIRY_LIMITS.body){await reader.cancel().catch(()=>{});return null;}
  chunks.push(value);
 }
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return new TextDecoder().decode(bytes);
}
export async function POST(request:Request){
 try{
  const raw=await readLimited(request);
  if(raw===null)return Response.json({error:'입력 내용이 너무 깁니다.'},{status:413,headers});
  let body:unknown;try{body=JSON.parse(raw);}catch{return Response.json({error:'입력 내용을 확인해 주세요.'},{status:400,headers});}
  const {alert}=await submitInquiry(body);
  if(alert)after(()=>deliverInquiryAlert(alert).catch(()=>{}));
  return Response.json({ok:true},{status:201,headers});
 }catch(cause){
  const status=(cause as {status?:number}).status;
  if(typeof status==='number')return Response.json({error:(cause as Error).message},{status,headers});
  return Response.json({error:'문의를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:500,headers});
 }
}
// Own websites' inquiries; the operator may add ?owner=all (foreign rows are written to the audit log).
export async function GET(request:Request){
 const actor=await authorize(request);if(actor instanceof Response)return actor;
 try{const all=actor.operator&&new URL(request.url).searchParams.get('owner')==='all',rows=await visible(actor,request,'inquiry',listInquiries(Date.now(),all?'all':actor.id));if(!all)return Response.json(rows,{headers});const labels=await ownerLabels();return Response.json(rows.map(row=>({...row,ownerLabel:row.ownerId?labels.get(row.ownerId)??'알 수 없는 계정':'소유 계정 없음'})),{headers});}catch{return Response.json({error:'문의 내역을 불러오지 못했습니다.'},{status:500,headers});}
}
