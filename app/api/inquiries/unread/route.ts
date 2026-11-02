import {unreadInquiryCount} from '../../../../lib/server/inquiries';
import {authorize} from '../../../../lib/server/owner';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){
 const actor=await authorize(request);if(actor instanceof Response)return actor;
 try{return Response.json({count:unreadInquiryCount(actor.id)},{headers});}catch{return Response.json({error:'문의 수를 불러오지 못했습니다.'},{status:500,headers});}
}
