import sharp from 'sharp';
import {addMedia,listMedia,resolveMedia,apiError} from '../../../../lib/server/store';
export const runtime='nodejs';
let preparing:Promise<unknown>|undefined;
export async function POST(){try{if(preparing)return Response.json(await preparing);preparing=(async()=>{const media=await listMedia();if(media.some(m=>m.name.startsWith('starter-')))return {created:0,alreadyPrepared:true};
 // Conservative interior crops: preserve source pixels, exclude tile borders and UI.
 const crops:Record<string,number[][]>={'source-2':[[179,146,190,167],[179,344,190,260],[397,68,194,354],[615,144,194,70],[615,240,194,356],[843,359,180,70],[844,462,179,162],[1056,240,187,165],[1056,440,187,345],[399,552,190,165]],'source-5':[[224,92,210,170],[517,15,207,300],[832,205,208,413],[525,410,214,318],[1119,257,208,309],[1091,114,204,79],[210,452,214,313],[207,312,240,76],[17,20,127,342],[823,18,181,118]]};
 let created=0;for(const [sourceId,areas] of Object.entries(crops)){const source=await resolveMedia(sourceId);for(let i=0;i<areas.length;i++){const name=`starter-${sourceId}-${i+1}.jpg`;const [left,top,width,height]=areas[i];const bytes=await sharp(source.file).extract({left,top,width,height}).jpeg({quality:95}).toBuffer();await addMedia(bytes,name,sourceId,{left,top,width,height});created++;}}return {created};})();return Response.json(await preparing);}catch(e){return apiError(e);}finally{preparing=undefined;}}
