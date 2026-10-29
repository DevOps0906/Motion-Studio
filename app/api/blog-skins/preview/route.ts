import {renderBlogSkin} from '../../../../lib/server/blog-skins';
import {rasterizeSvg} from '../../../../lib/server/rasterize';
import {apiError} from '../../../../lib/server/store';
export const runtime='nodejs';
export async function POST(request:Request){try{const {svg}=await renderBlogSkin(await request.json());return new Response(new Uint8Array(rasterizeSvg(svg)),{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return apiError(error);}}
