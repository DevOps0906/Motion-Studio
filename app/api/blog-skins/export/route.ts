import {exportBlogSkin} from '../../../../lib/server/blog-skins';
import {apiError} from '../../../../lib/server/store';
import {authorize} from '../../../../lib/server/owner';
export const runtime='nodejs';
export async function POST(request:Request){try{const actor=await authorize(request);if(actor instanceof Response)return actor;return new Response(new Uint8Array(await exportBlogSkin(await request.json(),actor)),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="homepage-blog-design.zip"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return apiError(error);}}
