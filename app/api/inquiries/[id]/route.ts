import {markInquiryRead} from '../../../../lib/server/inquiries';
import {canReadRequirements} from '../../../../lib/server/website-requirements';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context){
 if(!await canReadRequirements(request))return Response.json({error:'운영자 계정으로 로그인해 주세요.'},{status:403,headers});
 try{
  if(!markInquiryRead((await params).id))return Response.json({error:'문의를 찾을 수 없습니다.'},{status:404,headers});
  return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'읽음 처리하지 못했습니다.'},{status:500,headers});}
}
