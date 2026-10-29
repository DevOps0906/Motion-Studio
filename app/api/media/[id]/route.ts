import {resolveMedia,streamFile,apiError,deleteMedia} from '../../../../lib/server/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const m=await resolveMedia(id);return await streamFile(m.file,m.mimeType,request);}catch(e){return apiError(e,404);}}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){try{await deleteMedia((await params).id);return Response.json({ok:true});}catch(e){return apiError(e);}}
