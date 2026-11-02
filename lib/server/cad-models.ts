import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA, streamFile, writeJson } from './store';
import { NotFoundError, allow, type Actor, type RecordAction } from './owner';
import type { CadModelAsset } from '../model';

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

export async function deleteCadModel(id: string, actor: Actor) {
  const model = await getOwnedModel(id, actor, 'delete');
  await Promise.all([fs.rm(modelBinary(id), { force: true }), fs.rm(modelJson(id), { force: true })]);
  return model;
}

export async function saveCadModel(name: string, bytes: Buffer, actor: Actor): Promise<CadModelAsset> {
  if (bytes.byteLength > MAX_MODEL_BYTES) throw new Error('GLB 파일은 100MiB 이하로 등록해 주세요.');
  if (bytes.byteLength < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('유효한 GLB 바이너리 파일이 아닙니다.');
  if (bytes.readUInt32LE(4) !== 2) throw new Error('glTF 2.0 GLB만 지원합니다.');
  if (bytes.readUInt32LE(8) !== bytes.byteLength) throw new Error('GLB 파일 길이 정보가 실제 파일과 일치하지 않습니다.');
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || jsonLength < 2 || 20 + jsonLength > bytes.byteLength) {
    throw new Error('GLB의 glTF 장면 정보(JSON)를 읽을 수 없습니다.');
  }

  let gltf: { asset?: { version?: string }; scenes?: unknown[]; nodes?: Array<{ extras?: { storeyId?: unknown } }>; meshes?: unknown[]; materials?: unknown[] };
  try { gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).replace(/\0+\s*$/, '')); }
  catch { throw new Error('GLB 장면 정보가 올바른 JSON이 아닙니다.'); }
  if (gltf.asset?.version !== '2.0') throw new Error('glTF 2.0 모델인지 확인해 주세요.');
  if (!Array.isArray(gltf.scenes) || !Array.isArray(gltf.nodes) || !Array.isArray(gltf.meshes)) {
    throw new Error('GLB에 표시할 scene, node, mesh 정보가 없습니다.');
  }

  const id = randomUUID();
  const safeName = path.basename(name.replace(/[\\/\0-\x1f]/g, '_')).slice(0, 180) || 'model.glb';
  const storeys = new Set(gltf.nodes.map((node) => node.extras?.storeyId).filter((id): id is string => typeof id === 'string'));
  const record: CadModelAsset = {
    ownerId: actor.id, id, name: safeName.toLowerCase().endsWith('.glb') ? safeName : `${safeName}.glb`,
    sizeBytes: bytes.byteLength, createdAt: new Date().toISOString(), gltfVersion: '2.0',
    sceneCount: gltf.scenes.length, nodeCount: gltf.nodes.length, meshCount: gltf.meshes.length,
    materialCount: Array.isArray(gltf.materials) ? gltf.materials.length : 0,
    storeyCount: storeys.size,
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
