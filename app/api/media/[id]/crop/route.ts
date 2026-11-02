import sharp from 'sharp';
import {ownedRef,addMedia,apiError} from '../../../../../lib/server/store';
import {authorize} from '../../../../../lib/server/owner';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await authorize(request);if(actor instanceof Response)return actor;const {id}=await params;const source=await ownedRef(actor.id,id);if(!source.mimeType.startsWith('image/'))throw new Error('이미지만 분할할 수 있습니다.');const body=await request.json();const {left,top,width,height}=body;if([left,top,width,height].some(n=>!Number.isInteger(n))||left<0||top<0||width<40||height<40)throw new Error('40px 이상의 사진 영역을 선택해 주세요.');const bytes=await sharp(source.file).extract({left,top,width,height}).jpeg({quality:95}).toBuffer();return Response.json(await addMedia(bytes,`분할-${id}-${Date.now()}.jpg`,actor.id,id,{left,top,width,height}),{status:201});}catch(e){return apiError(e);}}
