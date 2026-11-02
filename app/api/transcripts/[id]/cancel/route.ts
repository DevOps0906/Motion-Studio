import {apiError} from '../../../../../lib/server/store';
import {authorize} from '../../../../../lib/server/owner';
import {cancelTranscribe,errorResponse} from '../../../../../lib/server/transcribe';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await authorize(request);if(actor instanceof Response)return actor;await cancelTranscribe((await params).id,actor);return Response.json({requested:true});}catch(e){return errorResponse(e)??apiError(e);}}
