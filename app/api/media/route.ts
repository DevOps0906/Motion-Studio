import {listMedia,addMedia,apiError} from '../../../lib/server/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await listMedia());}catch(e){return apiError(e,500);}}
export async function POST(request:Request){try{const size=Number(request.headers.get('content-length'));if(size>251*1024**2)return apiError(new Error('한 번에 250MiB 이하로 등록해 주세요.'),413);const data=await request.formData();const file=data.get('file');if(!(file instanceof File))throw new Error('파일을 선택해 주세요.');if(file.size>250*1024**2)throw new Error('파일은 250MiB 이하로 등록해 주세요.');const source=data.get('sourceAssetId');if(source&&!(await listMedia()).some(m=>m.id===source&&m.type==='video'))throw new Error('원본 영상을 찾을 수 없습니다.');return Response.json(await addMedia(Buffer.from(await file.arrayBuffer()),file.name,typeof source==='string'?source:undefined),{status:201});}catch(e){return apiError(e);}}

