import {authorize} from '../../../../lib/server/owner';
import {engineStatus} from '../../../../lib/server/transcribe';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){const actor=await authorize(request);if(actor instanceof Response)return actor;return Response.json(await engineStatus(actor),{headers:{'Cache-Control':'no-store'}});}
