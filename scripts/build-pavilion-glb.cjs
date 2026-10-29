const fs = require('node:fs');
const path = require('node:path');

const output = path.join(__dirname, '..', 'public', 'models', 'pavilion-demo.glb');
const binaryParts = [];
const views = [];
const accessors = [];
const meshes = [];
const nodes = [{ name: 'Motion Studio Pavilion', children: [], extras: { units: 'm', axis: 'X east, Y up, Z south', site: 'Demo only; not a construction model' } }];
let byteLength = 0;

const materials = [
  { name: 'Limestone', pbrMetallicRoughness: { baseColorFactor: [0.72, 0.7, 0.65, 1], metallicFactor: 0, roughnessFactor: 0.82 } },
  { name: 'Curtain wall glass', alphaMode: 'BLEND', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.34, 0.55, 0.69, 0.38], metallicFactor: 0.12, roughnessFactor: 0.2 } },
  { name: 'Anodized aluminum', pbrMetallicRoughness: { baseColorFactor: [0.3, 0.36, 0.4, 1], metallicFactor: 0.65, roughnessFactor: 0.38 } },
];

const faces = [
  { n: [1, 0, 0], p: [[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]] },
  { n: [-1, 0, 0], p: [[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]] },
  { n: [0, 1, 0], p: [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]] },
  { n: [0, -1, 0], p: [[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]] },
  { n: [0, 0, 1], p: [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]] },
  { n: [0, 0, -1], p: [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]] },
];

function appendChunk(bytes, target) {
  const padding = (4 - (byteLength % 4)) % 4;
  if (padding) { binaryParts.push(Buffer.alloc(padding)); byteLength += padding; }
  const offset = byteLength;
  binaryParts.push(bytes);
  byteLength += bytes.length;
  const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length };
  if (target) view.target = target;
  const index = views.push(view) - 1;
  return index;
}

function addBox(parent, name, center, size, material, extras = {}) {
  const positions = [], normals = [], indices = [];
  let vertex = 0;
  for (const face of faces) {
    for (const point of face.p) {
      positions.push(center[0] + point[0] * size[0] / 2, center[1] + point[1] * size[1] / 2, center[2] + point[2] * size[2] / 2);
      normals.push(...face.n);
    }
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
    vertex += 4;
  }
  const pos = Buffer.alloc(positions.length * 4);
  positions.forEach((value, i) => pos.writeFloatLE(value, i * 4));
  const nor = Buffer.alloc(normals.length * 4);
  normals.forEach((value, i) => nor.writeFloatLE(value, i * 4));
  const ind = Buffer.alloc(indices.length * 2);
  indices.forEach((value, i) => ind.writeUInt16LE(value, i * 2));
  const posView = appendChunk(pos, 34962);
  const normalView = appendChunk(nor, 34962);
  const indexView = appendChunk(ind, 34963);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], positions[i + axis]);
    max[axis] = Math.max(max[axis], positions[i + axis]);
  }
  const positionAccessor = accessors.push({ bufferView: posView, componentType: 5126, count: 24, type: 'VEC3', min, max }) - 1;
  const normalAccessor = accessors.push({ bufferView: normalView, componentType: 5126, count: 24, type: 'VEC3' }) - 1;
  const indexAccessor = accessors.push({ bufferView: indexView, componentType: 5123, count: 36, type: 'SCALAR', min: [0], max: [23] }) - 1;
  const meshIndex = meshes.push({ name, primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor }, indices: indexAccessor, material, mode: 4 }] }) - 1;
  const nodeIndex = nodes.push({ name, mesh: meshIndex, extras }) - 1;
  nodes[parent].children.push(nodeIndex);
}

function addFloor(level) {
  const storeyId = String(level + 1).padStart(2, '0');
  const parent = nodes.push({ name: `FLOOR-${storeyId}`, translation: [0, level * 3.6, 0], children: [], extras: { storeyId, elevationM: level * 3.6, floorToFloorM: 3.6 } }) - 1;
  nodes[0].children.push(parent);
  addBox(parent, `F${storeyId}-SLAB`, [0, 0.04, 0], [16.25, 0.28, 10.25], 0, { system: 'structure', storeyId });
  addBox(parent, `F${storeyId}-WALL-NORTH`, [0, 1.88, -4.91], [16, 3.4, 0.2], 0, { system: 'envelope', storeyId });
  addBox(parent, `F${storeyId}-WALL-EAST`, [7.91, 1.88, 0], [0.2, 3.4, 10], 0, { system: 'envelope', storeyId });
  addBox(parent, `F${storeyId}-WALL-WEST`, [-7.91, 1.88, 0], [0.2, 3.4, 10], 0, { system: 'envelope', storeyId });
  const bays = 13, bayWidth = 16 / bays;
  for (let i = 0; i < bays; i++) {
    const x = -8 + bayWidth * (i + 0.5);
    addBox(parent, `F${storeyId}-GLASS-${String(i + 1).padStart(2, '0')}`, [x, 1.88, 4.9], [bayWidth - 0.075, 3.23, 0.075], 1, { system: 'south-curtain-wall', storeyId, bay: i + 1, nominalSpacingM: 1.2 });
  }
  for (let i = 0; i <= bays; i++) {
    const x = -8 + bayWidth * i;
    addBox(parent, `F${storeyId}-MULLION-${String(i + 1).padStart(2, '0')}`, [x, 1.88, 4.86], [0.075, 3.38, 0.12], 2, { system: 'south-curtain-wall', storeyId, nominalSpacingM: 1.2 });
  }
  addBox(parent, `F${storeyId}-CURTAIN-SILL`, [0, 0.22, 4.86], [16.05, 0.11, 0.12], 2, { system: 'south-curtain-wall', storeyId });
  addBox(parent, `F${storeyId}-CURTAIN-HEAD`, [0, 3.54, 4.86], [16.05, 0.11, 0.12], 2, { system: 'south-curtain-wall', storeyId });
}

for (let floor = 0; floor < 3; floor++) addFloor(floor);
const roof = nodes.push({ name: 'ROOF', translation: [0, 11.02, 0], children: [], extras: { elevationM: 11.02, system: 'roof' } }) - 1;
nodes[0].children.push(roof);
addBox(roof, 'ROOF-SLAB', [0, 0, 0], [16.45, 0.3, 10.45], 0, { system: 'roof' });

const binary = Buffer.concat(binaryParts);
const gltf = {
  asset: { version: '2.0', generator: 'Motion Studio parametric pavilion study' },
  scene: 0,
  scenes: [{ name: 'Exhibition Pavilion · Metric Study', nodes: [0] }],
  nodes, meshes, materials,
  buffers: [{ byteLength: binary.length }],
  bufferViews: views,
  accessors,
  extras: { modelType: 'schematic-architecture', units: 'meters', coordinateSystem: 'X east; Y up; Z south', siteWidthM: 20, siteDepthM: 15, buildingWidthM: 16, buildingDepthM: 10, storeys: 3, floorToFloorM: 3.6, southCurtainWall: true, nominalFacadeSpacingM: 1.2, designReviewRequired: true },
};
const json = Buffer.from(JSON.stringify(gltf));
const jsonPadding = (4 - (json.length % 4)) % 4;
const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
const binPadding = (4 - (binary.length % 4)) % 4;
const binChunk = Buffer.concat([binary, Buffer.alloc(binPadding)]);
const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const header = Buffer.alloc(12);
header.write('glTF', 0, 4, 'ascii'); header.writeUInt32LE(2, 4); header.writeUInt32LE(totalLength, 8);
const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(jsonChunk.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binChunk.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]));
console.log(JSON.stringify({ output, bytes: totalLength, nodes: nodes.length, meshes: meshes.length, storeys: 3, units: 'meters' }));
