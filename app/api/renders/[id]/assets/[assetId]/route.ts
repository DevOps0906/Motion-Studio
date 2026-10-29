import {snapshotAsset} from '../../../../../../lib/server/render';import {apiError,streamFile} from '../../../../../../lib/server/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string;assetId:string}>}){try{const p=await params;const asset=await snapshotAsset(p.id,p.assetId);const response=await streamFile(asset.file,asset.mimeType,request);response.headers.set('Access-Control-Allow-Origin','*');return response;}catch(e){return apiError(e,404);}}

