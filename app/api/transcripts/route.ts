import {apiError} from '../../../lib/server/store';
import {authorize,visible} from '../../../lib/server/owner';
import {errorResponse,startTranscribe} from '../../../lib/server/transcribe';
import {allTranscripts} from '../../../lib/server/transcribe-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return Response.json(await visible(actor,request,'transcript',await allTranscripts()));}catch(e){return apiError(e,500);}}
export async function POST(request:Request){try{const actor=await authorize(request);if(actor instanceof Response)return actor;const raw=await request.text();if(raw.length>2000)throw new Error('요청이 너무 큽니다.');let body:unknown;try{body=JSON.parse(raw);}catch{throw new Error('요청 형식이 올바르지 않습니다.');}return Response.json(await startTranscribe(body,actor),{status:202});}catch(e){return errorResponse(e)??apiError(e);}}
