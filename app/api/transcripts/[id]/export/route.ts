import {apiError} from '../../../../../lib/server/store';
import {authorize} from '../../../../../lib/server/owner';
import {errorResponse,exportSrt} from '../../../../../lib/server/transcribe';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return await exportSrt((await params).id,actor);}catch(e){return errorResponse(e)??apiError(e,404);}}
