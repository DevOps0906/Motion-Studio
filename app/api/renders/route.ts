import {allJobs,startRender} from '../../../lib/server/render';
import {apiError} from '../../../lib/server/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await allJobs());}catch(e){return apiError(e,500);}}
export async function POST(request:Request){try{const data=await request.json();const port=new URL(request.url).port||'80';const job=await startRender(data.project,`http://127.0.0.1:${port}`);return Response.json(job,{status:202});}catch(e){return apiError(e);}}
