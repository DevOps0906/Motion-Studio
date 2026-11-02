import {allJobs,publicJob,startRender} from '../../../lib/server/render';
import {apiError} from '../../../lib/server/store';
import {authorize,visible} from '../../../lib/server/owner';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return Response.json((await visible(actor,request,'render',await allJobs())).map(publicJob));}catch(e){return apiError(e,500);}}
export async function POST(request:Request){try{const actor=await authorize(request);if(actor instanceof Response)return actor;const data=await request.json();const port=new URL(request.url).port||'80';const job=await startRender(data.project,`http://127.0.0.1:${port}`,actor);return Response.json(publicJob(job),{status:202});}catch(e){return apiError(e);}}
