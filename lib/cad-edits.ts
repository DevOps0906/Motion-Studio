// Applies a saved edit document (CadEdits, task-010 plan C) to a loaded glTF scene. Browser and Node, depends on three only.
// Used by the viewer today and meant for the video render (B) and the public web viewer (H2) so all three show the same result.
//
// Contract
// - Keys of edits.overrides are ORIGINAL glTF node indices. tagNodeIndices() writes them to userData.nodeIndex on the loaded scene
//   (GLTFLoader parser.associations), and Object3D.clone() copies userData, so clones keep the index. A mesh with several primitives
//   is one node (a Group): the index sits on that Group, its primitive meshes carry none.
// - Order: (1) edits on top of the original local TRS, (2) storey layout (floor visibility, explode offset) added afterwards.
// - Nodes defined by `matrix` cannot be edited: they are tagged userData.cadMatrix and skipped here (the server refuses them too).
// - Same input, same result: every call starts again from the TRS captured at tag time, so repeated calls never accumulate.
import * as THREE from 'three';
import type { CadEdits, CadNodeEdit } from './model';

export const EDIT_LIMITS = {
  maxOverrides: 500, maxBodyBytes: 64 * 1024, position: 1000, rotation: 360, scaleMin: 0.01, scaleMax: 100,
} as const;

export const emptyEdits = (): CadEdits => ({ schemaVersion: 1, revision: 0, overrides: {} });

export type CadLayout = { visibleFloors: boolean[]; exploded: boolean };
type Base = { p: [number, number, number]; q: [number, number, number, number]; s: [number, number, number] };
type GltfLike = {
  scene: THREE.Object3D;
  parser: { associations: { get(key: THREE.Object3D): unknown }; json: unknown };
};

// Call once on the object returned by GLTFLoader/useGLTF, BEFORE cloning. Safe to call again.
export function tagNodeIndices(gltf: GltfLike): void {
  const nodes = (gltf.parser.json as { nodes?: Array<{ matrix?: unknown } | null> }).nodes ?? [];
  gltf.scene.traverse((object) => {
    const mapping = gltf.parser.associations.get(object) as { nodes?: unknown } | undefined;
    if (typeof mapping?.nodes !== 'number') return;
    object.userData.nodeIndex = mapping.nodes;
    if (nodes[mapping.nodes]?.matrix !== undefined) object.userData.cadMatrix = true;
    if (!object.userData.cadBase) {
      const base: Base = { p: object.position.toArray(), q: object.quaternion.toArray() as Base['q'], s: object.scale.toArray() };
      object.userData.cadBase = base;
    }
  });
}

// Materials are never edited in place: the first-seen material is the original, an edited node gets a clone.
const originals = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
const clones = new WeakMap<THREE.Mesh, THREE.Material[]>();
const DEG = Math.PI / 180;

function nodeMeshes(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  if (object instanceof THREE.Mesh) found.push(object);
  for (const child of object.children) if (child instanceof THREE.Mesh && typeof child.userData.nodeIndex !== 'number') found.push(child);
  return found;
}

function applyMaterial(object: THREE.Object3D, edit: CadNodeEdit | undefined) {
  for (const mesh of nodeMeshes(object)) {
    if (!originals.has(mesh)) originals.set(mesh, mesh.material);
    clones.get(mesh)?.forEach((material) => material.dispose());
    clones.delete(mesh);
    const original = originals.get(mesh) as THREE.Material | THREE.Material[];
    if (edit?.color === undefined && edit?.roughness === undefined) { mesh.material = original; continue; }
    const cloned = (Array.isArray(original) ? original : [original]).map((material) => {
      const copy = material.clone() as THREE.MeshStandardMaterial;
      // With a texture the color multiplies it (three's base color factor), so setting it keeps the texture.
      if (edit.color !== undefined && copy.color) copy.color.set(edit.color);
      if (edit.roughness !== undefined && 'roughness' in copy) copy.roughness = edit.roughness;
      return copy;
    });
    clones.set(mesh, cloned);
    mesh.material = Array.isArray(original) ? cloned : cloned[0];
  }
}

const editOf = (object: THREE.Object3D, edits: CadEdits): CadNodeEdit | undefined =>
  typeof object.userData.nodeIndex === 'number' && !object.userData.cadMatrix ? edits.overrides[String(object.userData.nodeIndex)] : undefined;

// Mutates `root` (a clone of a tagged scene). With `layout`, floor visibility and explode offsets are added after the edits.
export function applyEdits(root: THREE.Object3D, edits: CadEdits, layout?: CadLayout): void {
  const delta = new THREE.Vector3(), turn = new THREE.Quaternion(), euler = new THREE.Euler();
  root.traverse((object) => {
    const base = object.userData.cadBase as Base | undefined;
    if (typeof object.userData.nodeIndex !== 'number' || !base) return;
    const edit = editOf(object, edits);
    object.position.fromArray(base.p); object.quaternion.fromArray(base.q); object.scale.fromArray(base.s);
    if (edit?.position) object.position.add(delta.fromArray(edit.position));
    if (edit?.rotation) object.quaternion.multiply(turn.setFromEuler(euler.set(edit.rotation[0] * DEG, edit.rotation[1] * DEG, edit.rotation[2] * DEG, 'XYZ')));
    if (edit?.scale) object.scale.multiply(delta.fromArray(edit.scale));
    object.visible = !edit?.hidden;
    applyMaterial(object, edit);
  });
  if (!layout) return;
  root.traverse((object) => {
    const storeyId = object.userData.storeyId;
    const editY = editOf(object, edits)?.position?.[1] ?? 0;
    if (typeof storeyId === 'string' && /^\d+$/.test(storeyId)) {
      const floorIndex = Number(storeyId) - 1;
      const elevation = Number(object.userData.elevationM ?? floorIndex * 3.6);
      const floorVisible = layout.visibleFloors[floorIndex] ?? true;
      object.visible = typeof object.userData.nodeIndex === 'number' ? object.visible && floorVisible : floorVisible;
      object.position.y = elevation + editY + (layout.exploded ? floorIndex * 0.85 : 0);
    } else if (object.userData.system === 'roof' && typeof object.userData.elevationM === 'number') {
      object.position.y = object.userData.elevationM + editY + (layout.exploded ? 1.7 : 0);
    }
  });
}

// Clone of a tagged scene with edits and layout applied, re-centered like the viewer's saved views expect
// (x/z centered, y=0 at the lowest point). Centering uses the layout WITHOUT edits, so editing a node never shifts saved cameras.
export function buildEditedScene(source: THREE.Object3D, edits: CadEdits, layout: CadLayout) {
  const clone = source.clone(true);
  applyEdits(clone, emptyEdits(), layout);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  clone.position.set(-center.x, -box.min.y, -center.z);
  applyEdits(clone, edits, layout);
  return { scene: clone, dimensions: { width: size.x, depth: size.z, height: size.y } };
}
