import {unreadInquiryCount} from '../../../../lib/server/inquiries';
import {canReadRequirements} from '../../../../lib/server/website-requirements';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){
 if(!await canReadRequirements(request))return Response.json({error:'운영자 전용입니다.'},{status:403,headers});
 try{return Response.json({count:unreadInquiryCount()},{headers});}catch{return Response.json({error:'문의 수를 불러오지 못했습니다.'},{status:500,headers});}
}
