import type * as THREE from 'three';
import { geometryDiagnostics } from '../geometry';
import type { QaFinding } from './types';

/** Single-mesh conflict counts below this are treated as grid noise at default tolerance. */
export const ORIENTATION_CONFLICT_OBSERVE_THRESHOLD = 1;

export interface OrientationConflictSummary {
  meshName: string;
  orientationConflicts: number;
}

/** Collect per-mesh orientation conflict counts for static triangle meshes. */
export function summarizeOrientationConflicts(root: THREE.Object3D): OrientationConflictSummary[] {
  const out: OrientationConflictSummary[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || mesh.visible === false) return;
    const geometry = mesh.geometry;
    if (!geometry?.getAttribute('position')) return;
    const { orientationConflicts } = geometryDiagnostics(geometry);
    if (orientationConflicts >= ORIENTATION_CONFLICT_OBSERVE_THRESHOLD)
      out.push({ meshName: mesh.name || '(unnamed mesh)', orientationConflicts });
  });
  out.sort(
    (a, b) =>
      b.orientationConflicts - a.orientationConflicts || a.meshName.localeCompare(b.meshName),
  );
  return out;
}

const MESHES_NAMED = 5;

function formatMeshList(summaries: readonly OrientationConflictSummary[]): string {
  const shown = summaries
    .slice(0, MESHES_NAMED)
    .map((s) => `${JSON.stringify(s.meshName)} (${s.orientationConflicts})`);
  const rest = summaries.length - shown.length;
  return rest > 0 ? `${shown.join(', ')}, +${rest} more` : shown.join(', ');
}

/** Export-time warnings and compact QA observations for inconsistent winding inside one mesh. */
export function inspectMeshOrientationConflicts(root: THREE.Object3D): {
  warnings: string[];
  findings: QaFinding[];
} {
  const summaries = summarizeOrientationConflicts(root);
  if (!summaries.length) return { warnings: [], findings: [] };
  const total = summaries.reduce((sum, s) => sum + s.orientationConflicts, 0);
  const message =
    `${total} orientation conflict${total === 1 ? '' : 's'} across ${summaries.length} mesh${summaries.length === 1 ? '' : 'es'} (${formatMeshList(summaries)}). ` +
    'Inconsistent triangle winding inside one mesh usually means merged solids with opposite normals — split into separate parts or rebuild with consistent counterclockwise winding.';
  const repairText =
    'Split the mesh into separate createPart calls, or rebuild the surface with consistent CCW winding. geometryDiagnostics counts conflicts; it does not repair topology.';
  return {
    warnings: [`GEO_MESH_ORIENTATION_CONFLICTS: ${message}`],
    findings: [
      {
        code: 'GEO_MESH_ORIENTATION_CONFLICTS',
        disposition: 'observe',
        dimension: 'visualQuality',
        profile: 'geometry.topology',
        message,
        repairText,
        measurement: {
          name: 'orientationConflicts',
          actual: total,
          breakdown: { meshes: summaries.length },
        },
      },
    ],
  };
}
