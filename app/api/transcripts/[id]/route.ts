import {apiError} from '../../../../lib/server/store';
import {authorize} from '../../../../lib/server/owner';
import {errorResponse,saveEditedSegments} from '../../../../lib/server/transcribe';
import {getOwnedTranscript,removeTranscript} from '../../../../lib/server/transcribe-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return Response.json(await getOwnedTranscript((await params).id,actor));}catch(e){return apiError(e,404);}}
// Ownership is decided before the body is read, so another account's id is the fixed 404 whatever the body is.
export async function PATCH(request:Request,{params}:Context){try{const actor=await authorize(request);if(actor instanceof Response)return actor;const {id}=await params;await getOwnedTranscript(id,actor,'change');const raw=await request.text();if(raw.length>400000)throw new Error('요청이 너무 큽니다.');let body:unknown;try{body=JSON.parse(raw);}catch{throw new Error('요청 형식이 올바르지 않습니다.');}return Response.json(await saveEditedSegments(id,body,actor));}catch(e){return errorResponse(e)??apiError(e);}}
export async function DELETE(request:Request,{params}:Context){try{const actor=await authorize(request);if(actor instanceof Response)return actor;const {id}=await params;await getOwnedTranscript(id,actor,'delete');await removeTranscript(id);return Response.json({ok:true});}catch(e){return apiError(e,404);}}
