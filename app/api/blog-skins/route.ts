import {listBlogSkins,saveBlogSkin} from '../../../lib/server/blog-skins';
import {apiError} from '../../../lib/server/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await listBlogSkins());}catch(error){return apiError(error,500);}}
export async function POST(request:Request){try{const input=await request.json();return Response.json(await saveBlogSkin(input.draft,input.id),{status:input.id?200:201});}catch(error){return apiError(error);}}
