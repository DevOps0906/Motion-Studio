import { apiError } from '../../../lib/server/store';
import { authorize, visible } from '../../../lib/server/owner';
import { acquireUploadSlot, listCadModels, saveCadModel, MAX_MODEL_BYTES } from '../../../lib/server/cad-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { const actor=await authorize(request);if(actor instanceof Response)return actor; return Response.json(await visible(actor, request, 'model', await listCadModels())); }
  catch (error) { return apiError(error, 500); }
}

export async function POST(request: Request) {
  let release: (() => void) | null = null;
  try {
    const actor=await authorize(request);if(actor instanceof Response)return actor;
    release = acquireUploadSlot();
    if (!release) return Response.json({ error: '다른 모델을 처리 중입니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: { 'Retry-After': '10' } });
    const declaredSize = Number(request.headers.get('content-length'));
    if (!request.headers.get('content-length') || !Number.isFinite(declaredSize)) return apiError(new Error('요청 길이(Content-Length)가 필요합니다.'), 411);
    if (declaredSize > MAX_MODEL_BYTES + 1024 * 1024) return apiError(new Error('GLB 파일은 100MiB 이하로 등록해 주세요.'), 413);
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File)) throw new Error('GLB 파일을 선택해 주세요.');
    if (file.size > MAX_MODEL_BYTES) return apiError(new Error('GLB 파일은 100MiB 이하로 등록해 주세요.'), 413);
    if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('단일 바이너리 GLB 파일만 지원합니다.');
    const model = await saveCadModel(file.name, Buffer.from(await file.arrayBuffer()), actor);
    return Response.json(model, { status: 201 });
  } catch (error) { return apiError(error); }
  finally { release?.(); }
}
