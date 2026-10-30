import {exportBlogSkin} from '../../../../lib/server/blog-skins';
import {apiError} from '../../../../lib/server/store';
export const runtime='nodejs';
export async function POST(request:Request){try{return new Response(new Uint8Array(await exportBlogSkin(await request.json())),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="homepage-blog-design.zip"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return apiError(error);}}
