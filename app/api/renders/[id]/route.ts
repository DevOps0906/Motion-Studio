import {getOwnedJob,publicJob} from '../../../../lib/server/render';import {apiError} from '../../../../lib/server/store';
import {authorize} from '../../../../lib/server/owner';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return Response.json(publicJob(await getOwnedJob((await params).id,actor)));}catch(e){return apiError(e,404);}}
