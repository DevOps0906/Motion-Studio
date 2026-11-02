import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA, streamFile, writeJson } from './store';
import { NotFoundError, allow, type Actor, type RecordAction } from './owner';
import type { CadModelAsset, CadView } from '../model';
import { validateGlb } from '../glb-validate';

const MODEL_DIR = path.join(DATA, 'models');
const MAX_MODEL_BYTES = 100 * 1024 * 1024;

export const validModelId = (id: string) => /^[a-f0-9-]{36}$/i.test(id);
const modelJson = (id: string) => path.join(MODEL_DIR, `${id}.json`);
const modelBinary = (id: string) => path.join(MODEL_DIR, `${id}.glb`);

export async function listCadModels(): Promise<CadModelAsset[]> {
  await fs.mkdir(MODEL_DIR, { recursive: true });
  const files = await fs.readdir(MODEL_DIR);
  const records = await Promise.all(files.filter((file) => file.endsWith('.json')).map(async (file) => {
    try { return JSON.parse(await fs.readFile(path.join(MODEL_DIR, file), 'utf8')) as CadModelAsset; }
    catch { return null; }
  }));
  return records.filter((record): record is CadModelAsset => record !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCadModel(id: string): Promise<CadModelAsset> {
  if (!validModelId(id)) throw new Error('모델 ID가 올바르지 않습니다.');
  return JSON.parse(await fs.readFile(modelJson(id), 'utf8')) as CadModelAsset;
}

// Owner-checked read; invalid, missing and foreign ids are all the same NotFoundError.
export async function getOwnedModel(id: string, actor: Actor, action: RecordAction = 'view'): Promise<CadModelAsset> {
  if (!validModelId(id)) throw new NotFoundError();
  let model: CadModelAsset;
  try { model = await getCadModel(id); } catch { throw new NotFoundError(); }
  await allow(actor, model, 'model', id, action);
  return model;
}

// Writes to one model are serialized per model id; deleting goes through the same queue.
const queues = new Map<string, Promise<unknown>>();
function enqueue<T>(id: string, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(id) ?? Promise.resolve()).then(task, task);
  const tail = run.catch(() => undefined);
  queues.set(id, tail);
  void tail.then(() => { if (queues.get(id) === tail) queues.delete(id); });
  return run;
}

export function deleteCadModel(id: string, actor: Actor) {
  return enqueue(id, async () => {
    const model = await getOwnedModel(id, actor, 'delete');
    await Promise.all([fs.rm(modelBinary(id), { force: true }), fs.rm(modelJson(id), { force: true })]);
    return model;
  });
}

// At most two uploads are processed at once (each holds up to 100MiB in memory). Returns a release function, or null when full.
const MAX_CONCURRENT_UPLOADS = 2;
let activeUploads = 0;
export function acquireUploadSlot(): (() => void) | null {
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) return null;
  activeUploads++;
  let released = false;
  return () => { if (!released) { released = true; activeUploads--; } };
}

export const MAX_VIEWS = 20;
const VIEW_FIELDS = ['schemaVersion', 'name', 'camera', 'floors', 'exploded', 'background'];
// Same limits as the viewer's OrbitControls (minDistance 12, maxDistance 65, maxPolarAngle 0.48*PI); out of range is refused, never clamped.
const MIN_DISTANCE = 12, MAX_DISTANCE = 65, MAX_POLAR = Math.PI * 0.48, EPS = 1e-3;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function vec3(value: unknown, label: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < -1000 || n > 1000)) {
    throw new Error(`${label} 좌표를 확인해 주세요.`);
  }
  return value as [number, number, number];
}

export function validateCadView(input: unknown, storeyCount: number): Omit<CadView, 'id' | 'createdAt' | 'updatedAt'> {
  if (!isObject(input)) throw new Error('뷰 데이터가 올바르지 않습니다.');
  if (input.schemaVersion !== 1) throw new Error('지원하지 않는 뷰 버전입니다.');
  if (Object.keys(input).some((key) => !VIEW_FIELDS.includes(key))) throw new Error('알 수 없는 뷰 항목이 있습니다.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60 || /[\0-\x1f]/.test(input.name)) throw new Error('뷰 이름은 1~60자입니다.');
  const camera = input.camera;
  if (!isObject(camera) || Object.keys(camera).some((key) => key !== 'position' && key !== 'target')) throw new Error('카메라 설정이 올바르지 않습니다.');
  const position = vec3(camera.position, '카메라 위치');
  const target = vec3(camera.target, '카메라 대상');
  const dy = position[1] - target[1];
  const distance = Math.hypot(position[0] - target[0], dy, position[2] - target[2]);
  if (distance < MIN_DISTANCE - EPS || distance > MAX_DISTANCE + EPS) throw new Error(`카메라 거리는 ${MIN_DISTANCE}~${MAX_DISTANCE} m 범위여야 합니다.`);
  if (Math.acos(Math.min(1, Math.max(-1, dy / distance))) > MAX_POLAR + EPS) throw new Error('카메라 각도가 허용 범위를 벗어났습니다.');
  if (!Array.isArray(input.floors) || input.floors.length !== storeyCount || input.floors.some((v) => typeof v !== 'boolean')) throw new Error(`층 표시는 ${storeyCount}개여야 합니다.`);
  if (typeof input.exploded !== 'boolean') throw new Error('분해 설정이 올바르지 않습니다.');
  if (typeof input.background !== 'string' || !/^#[\da-f]{6}$/i.test(input.background)) throw new Error('배경색을 확인해 주세요.');
  return { schemaVersion: 1, name: input.name.trim(), camera: { position, target }, floors: input.floors as boolean[], exploded: input.exploded, background: input.background.toLowerCase() };
}

// Ownership (change) is checked first, then the .glb must still exist (a deleted model is never revived by writing its JSON back).
function mutateModel<T>(id: string, actor: Actor, change: (model: CadModelAsset) => T, allowInvalid = false): Promise<T> {
  return enqueue(id, async () => {
    const model = await getOwnedModel(id, actor, 'change');
    try { await fs.access(modelBinary(id)); } catch { throw new NotFoundError(); }
    if (model.invalid && !allowInvalid) throw new Error('검증에 실패한 모델이라 뷰를 저장할 수 없습니다. 모델을 다시 등록해 주세요.');
    const result = change(model);
    await writeJson(modelJson(id), model);
    return result;
  });
}

export async function listCadViews(id: string, actor: Actor): Promise<CadView[]> {
  return (await getOwnedModel(id, actor, 'view')).views ?? [];
}

export async function getCadView(id: string, viewId: string, actor: Actor): Promise<CadView> {
  const view = (await listCadViews(id, actor)).find((item) => item.id === viewId);
  if (!view) throw new NotFoundError();
  return view;
}

export function createCadView(id: string, input: unknown, actor: Actor): Promise<CadView> {
  return mutateModel(id, actor, (model) => {
    const fields = validateCadView(input, model.storeyCount);
    const views = model.views ?? [];
    if (views.length >= MAX_VIEWS) throw new Error(`뷰는 모델당 ${MAX_VIEWS}개까지 저장할 수 있습니다.`);
    const now = new Date().toISOString();
    const view: CadView = { id: randomUUID(), ...fields, createdAt: now, updatedAt: now };
    model.views = [...views, view];
    return view;
  });
}

export function updateCadView(id: string, viewId: string, input: unknown, actor: Actor): Promise<CadView> {
  return mutateModel(id, actor, (model) => {
    const views = [...(model.views ?? [])];
    const index = views.findIndex((item) => item.id === viewId);
    if (index < 0) throw new NotFoundError();
    views[index] = { ...views[index], ...validateCadView(input, model.storeyCount), updatedAt: new Date().toISOString() };
    model.views = views;
    return views[index];
  });
}

export function deleteCadView(id: string, viewId: string, actor: Actor): Promise<CadView> {
  return mutateModel(id, actor, (model) => {
    const view = (model.views ?? []).find((item) => item.id === viewId);
    if (!view) throw new NotFoundError();
    model.views = (model.views ?? []).filter((item) => item.id !== viewId);
    return view;
  }, true);
}

export async function saveCadModel(name: string, bytes: Buffer, actor: Actor): Promise<CadModelAsset> {
  if (bytes.byteLength > MAX_MODEL_BYTES) throw new Error('GLB 파일은 100MiB 이하로 등록해 주세요.');
  const summary = validateGlb(bytes);

  const id = randomUUID();
  const safeName = path.basename(name.replace(/[\\/\0-\x1f]/g, '_')).slice(0, 180) || 'model.glb';
  const record: CadModelAsset = {
    ownerId: actor.id, id, name: safeName.toLowerCase().endsWith('.glb') ? safeName : `${safeName}.glb`,
    sizeBytes: bytes.byteLength, createdAt: new Date().toISOString(), gltfVersion: '2.0', ...summary,
  };

  await fs.mkdir(MODEL_DIR, { recursive: true });
  const temp = `${modelBinary(id)}.tmp`;
  try {
    await fs.writeFile(temp, bytes, { flag: 'wx' });
    await fs.rename(temp, modelBinary(id));
    await writeJson(modelJson(id), record);
    return record;
  } catch (error) {
    await fs.rm(temp, { force: true });
    await fs.rm(modelBinary(id), { force: true });
    throw error;
  }
}

export async function streamCadModel(id: string, request: Request, actor: Actor) {
  await getOwnedModel(id, actor, 'view');
  const response = await streamFile(modelBinary(id), 'model/gltf-binary', request);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, { status: response.status, headers });
}

export { MAX_MODEL_BYTES };

// View bodies are tiny: refuse before reading when Content-Length is missing (411) or above 8KB (413).
export const MAX_VIEW_BODY_BYTES = 8 * 1024;
export function limitBody(request: Request): Response | null {
  const header = request.headers.get('content-length');
  const length = Number(header);
  if (!header || !Number.isFinite(length)) return Response.json({ error: '요청 길이(Content-Length)가 필요합니다.' }, { status: 411 });
  if (length > MAX_VIEW_BODY_BYTES) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  return null;
}
