import {buildCapCutPackage} from '../../../../../lib/server/capcut-export';
import {apiError} from '../../../../../lib/server/store';
import {authorize} from '../../../../../lib/server/owner';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const actor=await authorize(request);if(actor instanceof Response)return actor;const id=(await params).id;const zip=await buildCapCutPackage(id,actor);return new Response(new Uint8Array(zip),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="motion-studio-capcut-${id}.zip"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
 catch(error){return apiError(error,400);}
}
