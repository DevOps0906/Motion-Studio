import {listBlogSkins,saveBlogSkin} from '../../../lib/server/blog-skins';
import {apiError} from '../../../lib/server/store';
import {authorize,visible} from '../../../lib/server/owner';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return Response.json(await visible(actor,request,'blog-skin',await listBlogSkins()));}catch(error){return apiError(error,500);}}
export async function POST(request:Request){try{const actor=await authorize(request);if(actor instanceof Response)return actor;const input=await request.json();return Response.json(await saveBlogSkin(input.draft,input.id,actor),{status:input.id?200:201});}catch(error){return apiError(error);}}
