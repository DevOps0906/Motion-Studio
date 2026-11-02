import {getProject,deleteProject,saveProject,apiError} from '../../../../lib/server/store';
import {authorize} from '../../../../lib/server/owner';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return Response.json(await getProject((await params).id,actor));}catch(e){return apiError(e,404);}}
export async function PATCH(request:Request,{params}:Context){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return Response.json(await saveProject(await request.json(),(await params).id,actor));}catch(e){return apiError(e);}}
export async function DELETE(request:Request,{params}:Context){try{const actor=await authorize(request);if(actor instanceof Response)return actor;await deleteProject((await params).id,actor);return Response.json({ok:true});}catch(e){return apiError(e,404);}}
