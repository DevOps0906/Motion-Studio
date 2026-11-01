import {generateWebsiteDraft,websiteAiConfigured} from '../../../../lib/server/website-draft';
import {canReadRequirements} from '../../../../lib/server/website-requirements';
import {currentAccount} from '../../../../lib/server/accounts';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
async function operatorEmail(request:Request){return await canReadRequirements(request,{requireAdminList:true})?(await currentAccount(request))?.email||null:null;}
function sameOrigin(request:Request){
 const origin=request.headers.get('origin'),host=request.headers.get('host');
 if(request.headers.get('sec-fetch-site')==='cross-site'||!origin||!host)return false;
 try{return new URL(origin).host===host;}catch{return false;}
}
export async function GET(request:Request){return Response.json({aiAvailable:websiteAiConfigured()&&Boolean(await operatorEmail(request))},{headers});}
export async function POST(request:Request){
 try{
  if(!sameOrigin(request)||!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'요청을 처리할 수 없습니다.'},{status:403,headers});
  const raw=await request.text();if(raw.length>200000)throw Error('입력 내용이 너무 깁니다.');
  return Response.json(await generateWebsiteDraft(JSON.parse(raw),await operatorEmail(request)),{headers});
 }catch(error){const message=(error as Error).message;return Response.json({error:['입력 내용이 너무 깁니다.','웹 프로젝트 정보를 입력해 주세요.'].includes(message)?message:'초안을 만들지 못했습니다. 입력 내용을 확인해 주세요.'},{status:400,headers});}
}
