// Limits and small pure helpers of the 3D shape edit document. No three, no server code: routes, the server module and the viewer UI share it.
import type { CadEdits, CadNodeEdit } from './model';

export const EDIT_LIMITS = {
  maxOverrides: 500, maxBodyBytes: 64 * 1024, position: 1000, rotation: 360, scaleMin: 0.01, scaleMax: 100, undoSteps: 50,
} as const;

export const emptyEdits = (): CadEdits => ({ schemaVersion: 1, revision: 0, overrides: {} });

export type VectorField = 'position' | 'rotation' | 'scale';
export const VECTOR_NEUTRAL: Record<VectorField, number> = { position: 0, rotation: 0, scale: 1 };

// Out-of-range typed values are cut to the limit (the input shows the cut value again).
export function clampEditValue(field: VectorField, value: number): number {
  const [min, max] = field === 'position' ? [-EDIT_LIMITS.position, EDIT_LIMITS.position]
    : field === 'rotation' ? [-EDIT_LIMITS.rotation, EDIT_LIMITS.rotation] : [EDIT_LIMITS.scaleMin, EDIT_LIMITS.scaleMax];
  return Math.min(max, Math.max(min, value));
}

// One entry per undoable step, newest last, at most EDIT_LIMITS.undoSteps.
export const pushUndo = <T>(stack: T[], previous: T): T[] => [...stack.slice(-(EDIT_LIMITS.undoSteps - 1)), previous];

// Edited nodes for the "edited parts" list, by node index.
export const editedNodes = (overrides: Record<string, CadNodeEdit>) =>
  Object.keys(overrides).map(Number).sort((a, b) => a - b).map((index) => ({ index, hidden: Boolean(overrides[String(index)].hidden) }));

export const hasUnsavedEdits = (draft: Record<string, CadNodeEdit>, saved: Record<string, CadNodeEdit>) => JSON.stringify(draft) !== JSON.stringify(saved);
