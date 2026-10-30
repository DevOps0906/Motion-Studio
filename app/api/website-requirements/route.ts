import {canReadRequirements,listRequirements,saveRequirements} from '../../../lib/server/website-requirements';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){try{const raw=await request.text();if(raw.length>16000)throw Error('입력 내용이 너무 깁니다.');return Response.json(saveRequirements(JSON.parse(raw)),{status:201,headers});}catch(cause){return Response.json({error:(cause as Error).message},{status:400,headers});}}
export async function GET(request:Request){if(!await canReadRequirements(request))return Response.json({error:'접수 내역을 확인할 운영자 계정으로 로그인해 주세요. 공개 운영 시 관리자 이메일 설정이 필요합니다.'},{status:403,headers});return Response.json(listRequirements(),{headers});}
