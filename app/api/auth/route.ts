import {authenticate,currentAccount,endSession,sessionHeader} from '../../../lib/server/accounts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){return Response.json({account:await currentAccount(request)},{headers});}
export async function POST(request:Request){
 try{
  const raw=await request.text();if(raw.length>4096)throw new Error('입력 내용이 너무 깁니다.');
  const {token,identity}=await authenticate(JSON.parse(raw));
  await endSession(request);
  return Response.json({account:identity,redirect:'/studio?view=dashboard'},{headers:{...headers,'Set-Cookie':sessionHeader(token,request)}});
 }catch(cause){return Response.json({error:(cause as Error).message},{status:400,headers});}
}
export async function DELETE(request:Request){await endSession(request);return Response.json({account:null},{headers:{...headers,'Set-Cookie':sessionHeader('',request)}});}
