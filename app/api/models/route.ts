import { apiError } from '../../../lib/server/store';
import { authorize, visible } from '../../../lib/server/owner';
import { listCadModels, saveCadModel, MAX_MODEL_BYTES } from '../../../lib/server/cad-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { const actor=await authorize(request);if(actor instanceof Response)return actor; return Response.json(await visible(actor, request, 'model', await listCadModels())); }
  catch (error) { return apiError(error, 500); }
}

export async function POST(request: Request) {
  try {
    const actor=await authorize(request);if(actor instanceof Response)return actor;
    const declaredSize = Number(request.headers.get('content-length'));
    if (declaredSize > MAX_MODEL_BYTES + 1024 * 1024) return apiError(new Error('GLB 파일은 100MiB 이하로 등록해 주세요.'), 413);
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File)) throw new Error('GLB 파일을 선택해 주세요.');
    if (file.size > MAX_MODEL_BYTES) return apiError(new Error('GLB 파일은 100MiB 이하로 등록해 주세요.'), 413);
    if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('단일 바이너리 GLB 파일만 지원합니다.');
    const model = await saveCadModel(file.name, Buffer.from(await file.arrayBuffer()), actor);
    return Response.json(model, { status: 201 });
  } catch (error) { return apiError(error); }
}
