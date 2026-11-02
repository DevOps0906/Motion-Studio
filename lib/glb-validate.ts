// Shared GLB upload validation (task-010 section 8). No imports and no enums, so scripts can load it directly with Node type stripping.
// Rules: single-file GLB 2.0, no external/data URIs, only allow-listed required extensions (no draco/meshopt/KTX2),
// PNG/JPEG textures inside the BIN chunk up to 2048px, and hard caps on JSON size and object counts.
export const MAX_GLB_JSON_BYTES = 4 * 1024 * 1024;
export const MAX_GLB_NODES = 10000;
export const MAX_GLB_ACCESSORS = 20000;
export const MAX_GLB_TEXTURES = 64;
export const MAX_GLB_TEXTURE_PX = 2048;
const ALLOWED_EXTENSION = /^(KHR_materials_[A-Za-z0-9_]+|KHR_texture_transform|KHR_mesh_quantization)$/;

export type GlbSummary = {
  sceneCount: number; nodeCount: number; meshCount: number; materialCount: number; storeyCount: number;
};

type Gltf = {
  asset?: { version?: unknown }; scenes?: unknown; nodes?: unknown; meshes?: unknown; materials?: unknown;
  accessors?: unknown; buffers?: unknown; bufferViews?: unknown; images?: unknown; extensionsRequired?: unknown;
};
type Rec = Record<string, unknown>;
const isRecord = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);

function imageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.readUInt32BE(4) === 0x0d0a1a0a && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
      if (marker === 0xd9 || marker === 0xda) return null;
      const length = bytes.readUInt16BE(i + 2);
      if (length < 2) return null;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        if (i + 9 > bytes.length) return null;
        return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + length;
    }
  }
  return null;
}

// Throws Error with a user-facing Korean message; callers map it to 400.
export function validateGlb(bytes: Buffer): GlbSummary {
  if (bytes.byteLength < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('유효한 GLB 바이너리 파일이 아닙니다.');
  if (bytes.readUInt32LE(4) !== 2) throw new Error('glTF 2.0 GLB만 지원합니다.');
  if (bytes.readUInt32LE(8) !== bytes.byteLength) throw new Error('GLB 파일 길이 정보가 실제 파일과 일치하지 않습니다.');
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || jsonLength < 2 || 20 + jsonLength > bytes.byteLength) {
    throw new Error('GLB의 glTF 장면 정보(JSON)를 읽을 수 없습니다.');
  }
  if (jsonLength > MAX_GLB_JSON_BYTES) throw new Error('GLB 장면 정보(JSON)가 4MiB를 넘습니다.');

  let bin: Buffer = Buffer.alloc(0);
  const binStart = 20 + jsonLength;
  if (binStart + 8 <= bytes.byteLength) {
    const binLength = bytes.readUInt32LE(binStart);
    if (bytes.readUInt32LE(binStart + 4) === 0x004e4942) {
      if (binStart + 8 + binLength > bytes.byteLength) throw new Error('GLB 바이너리 청크 길이가 올바르지 않습니다.');
      bin = bytes.subarray(binStart + 8, binStart + 8 + binLength);
    }
  }

  let gltf: Gltf;
  try { gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).replace(/[\0\s]+$/, '')); }
  catch { throw new Error('GLB 장면 정보가 올바른 JSON이 아닙니다.'); }
  if (!isRecord(gltf)) throw new Error('GLB 장면 정보가 올바른 JSON이 아닙니다.');
  if (gltf.asset?.version !== '2.0') throw new Error('glTF 2.0 모델인지 확인해 주세요.');
  if (!Array.isArray(gltf.scenes) || !Array.isArray(gltf.nodes) || !Array.isArray(gltf.meshes)) {
    throw new Error('GLB에 표시할 scene, node, mesh 정보가 없습니다.');
  }
  if (gltf.nodes.length > MAX_GLB_NODES) throw new Error(`노드는 ${MAX_GLB_NODES.toLocaleString('en-US')}개 이하여야 합니다.`);
  if (Array.isArray(gltf.accessors) && gltf.accessors.length > MAX_GLB_ACCESSORS) throw new Error(`accessor는 ${MAX_GLB_ACCESSORS.toLocaleString('en-US')}개 이하여야 합니다.`);

  if (gltf.extensionsRequired !== undefined) {
    if (!Array.isArray(gltf.extensionsRequired)) throw new Error('GLB의 extensionsRequired 형식이 올바르지 않습니다.');
    for (const name of gltf.extensionsRequired) {
      if (typeof name !== 'string' || !ALLOWED_EXTENSION.test(name)) throw new Error(`지원하지 않는 glTF 확장입니다: ${String(name).slice(0, 60)}`);
    }
  }

  // Only the BIN chunk may hold data: any uri (http, file, relative or data:) is refused.
  if (gltf.buffers !== undefined) {
    if (!Array.isArray(gltf.buffers) || gltf.buffers.length > 1) throw new Error('GLB는 내장 바이너리 버퍼 1개만 허용합니다.');
    for (const buffer of gltf.buffers) if (!isRecord(buffer) || buffer.uri !== undefined) throw new Error('외부 파일이나 data URI를 가리키는 버퍼는 허용하지 않습니다.');
  }
  const images = gltf.images === undefined ? [] : gltf.images;
  if (!Array.isArray(images)) throw new Error('GLB의 images 형식이 올바르지 않습니다.');
  if (images.length > MAX_GLB_TEXTURES) throw new Error(`텍스처는 ${MAX_GLB_TEXTURES}장 이하여야 합니다.`);
  const views = Array.isArray(gltf.bufferViews) ? gltf.bufferViews : [];
  for (const image of images) {
    if (!isRecord(image)) throw new Error('GLB의 images 형식이 올바르지 않습니다.');
    if (image.uri !== undefined) throw new Error('외부 파일이나 data URI를 가리키는 이미지는 허용하지 않습니다.');
    const view = typeof image.bufferView === 'number' ? views[image.bufferView] : undefined;
    if (!isRecord(view) || (view.buffer ?? 0) !== 0 || typeof view.byteLength !== 'number' || view.byteLength <= 0) throw new Error('GLB 이미지가 바이너리 청크 안에 없습니다.');
    const offset = typeof view.byteOffset === 'number' ? view.byteOffset : 0;
    if (!Number.isInteger(offset) || !Number.isInteger(view.byteLength) || offset < 0 || offset + view.byteLength > bin.length) throw new Error('GLB 이미지 범위가 바이너리 청크를 벗어납니다.');
    const size = imageSize(bin.subarray(offset, offset + view.byteLength));
    if (!size) throw new Error('텍스처는 PNG 또는 JPEG만 허용합니다.');
    if (size.width < 1 || size.height < 1 || size.width > MAX_GLB_TEXTURE_PX || size.height > MAX_GLB_TEXTURE_PX) throw new Error(`텍스처는 ${MAX_GLB_TEXTURE_PX}px 이하여야 합니다.`);
  }

  const storeys = new Set((gltf.nodes as Array<{ extras?: { storeyId?: unknown } } | null>)
    .map((node) => node?.extras?.storeyId).filter((id): id is string => typeof id === 'string'));
  return {
    sceneCount: gltf.scenes.length, nodeCount: gltf.nodes.length, meshCount: gltf.meshes.length,
    materialCount: Array.isArray(gltf.materials) ? gltf.materials.length : 0, storeyCount: storeys.size,
  };
}
