import {markInquiryRead} from '../../../../lib/server/inquiries';
import {authorize,notFoundResponse} from '../../../../lib/server/owner';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context){
 const actor=await authorize(request);if(actor instanceof Response)return actor;
 try{
  if(!markInquiryRead((await params).id,actor.id,actor.operator))return notFoundResponse();
  return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'읽음 처리하지 못했습니다.'},{status:500,headers});}
}
