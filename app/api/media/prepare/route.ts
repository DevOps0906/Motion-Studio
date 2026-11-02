import {promises as fs} from 'node:fs';
import path from 'node:path';
import {addMedia,ownMedia,apiError} from '../../../../lib/server/store';
import {authorize} from '../../../../lib/server/owner';
import manifest from '../../../../public/photos/manifest.json';
export const runtime='nodejs';
// One preparation at a time per account; each account gets its own copy of the starter photos.
const preparing=new Map<string,Promise<unknown>>();
export async function POST(request:Request){
 const actor=await authorize(request);if(actor instanceof Response)return actor;
 try{
  const running=preparing.get(actor.id);if(running)return Response.json(await running);
  const job=(async()=>{
   const media=await ownMedia(actor.id);let created=0;
   for(const photo of manifest.photos){
    const name=`starter-${photo.file}`;
    if(media.some(asset=>asset.name===name&&asset.sourceAssetId===photo.sourceAssetId))continue;
    const bytes=await fs.readFile(path.join(process.cwd(),'public','photos',photo.file));
    await addMedia(bytes,name,actor.id,photo.sourceAssetId,photo.crop);created++;
   }
   return {created,alreadyPrepared:created===0};
  })();
  preparing.set(actor.id,job);
  return Response.json(await job);
 }catch(error){return apiError(error);}finally{preparing.delete(actor.id);}
}
