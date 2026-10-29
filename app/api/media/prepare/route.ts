import {promises as fs} from 'node:fs';
import path from 'node:path';
import {addMedia,listMedia,apiError} from '../../../../lib/server/store';
import manifest from '../../../../public/photos/manifest.json';
export const runtime='nodejs';
let preparing:Promise<unknown>|undefined;
export async function POST(){
 try{
  if(preparing)return Response.json(await preparing);
  preparing=(async()=>{
   const media=await listMedia();let created=0;
   for(const photo of manifest.photos){
    const name=`starter-${photo.file}`;
    if(media.some(asset=>asset.name===name&&asset.sourceAssetId===photo.sourceAssetId))continue;
    const bytes=await fs.readFile(path.join(process.cwd(),'public','photos',photo.file));
    await addMedia(bytes,name,photo.sourceAssetId,photo.crop);created++;
   }
   return {created,alreadyPrepared:created===0};
  })();
  return Response.json(await preparing);
 }catch(error){return apiError(error);}finally{preparing=undefined;}
}
