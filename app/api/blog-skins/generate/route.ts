import {blogAiConfigured,generateBlogPlan} from '../../../../lib/server/blog-generation';
import {canReadRequirements} from '../../../../lib/server/website-requirements';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){return Response.json({aiConfigured:blogAiConfigured()},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){try{const raw=await request.text();if(raw.length>6000)throw Error('입력 내용이 너무 깁니다.');return Response.json(await generateBlogPlan(JSON.parse(raw),await canReadRequirements(request,{requireAdminList:true})),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({error:(error as Error).message},{status:400});}}
