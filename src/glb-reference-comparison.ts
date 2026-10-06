/**
 * Offline reference-GLB vs kiln-GLB comparison (not part of the QA gate).
 *
 * Loads both artifacts with the CPU flat GLB adapter, aligns each mesh set to a
 * unit bounding box, renders the same orthographic views, and scores silhouette
 * agreement using the reference-comparison segmentation math.
 */
import { createHash } from 'node:crypto';
import { Matrix4 } from 'three';
import {
  analyzeReferenceComparison,
  type ReferenceComparisonEvidenceV1,
} from './qa/reference-comparison';
import { compositeCellGrid } from './views/grid';
import { loadGlbGeometryFlatScene, type GlbGeometryFlatRoot } from './views/glb';
import { encodePng } from './views/png';
import { measureBounds, rasterizeView, SIX_VIEWS, type ViewSpec } from './views/raster';

export interface ReferenceGlbProvenanceV1 {
  schemaVersion: 1;
  referenceGlbSha256: `sha256:${string}`;
  license: {
    spdx: string;
    url: string;
    attribution: string;
  };
  provider?: string;
  assetUrl?: string;
  notes?: string;
}

export interface GlbViewComparisonV1 {
  view: string;
  evidence: ReferenceComparisonEvidenceV1;
}

export interface GlbReferenceComparisonReportV1 {
  schemaVersion: 1;
  referenceGlbSha256: `sha256:${string}`;
  candidateGlbSha256: `sha256:${string}`;
  provenance?: ReferenceGlbProvenanceV1;
  views: GlbViewComparisonV1[];
  /** Mean silhouette IoU across views with measurable subjects. */
  overallSilhouetteIoU: number;
  cellSize: number;
  viewCount: number;
}

export const DEFAULT_COMPARISON_CELL_SIZE = 128;

export function sha256Glb(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function alignFlatSceneToUnitBBox(root: GlbGeometryFlatRoot): void {
  root.updateMatrixWorld(true);
  const bounds = measureBounds(root);
  const extent = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const maxExtent = Math.max(extent[0]!, extent[1]!, extent[2]!, 1e-8);
  const scale = 1 / maxExtent;
  const center: [number, number, number] = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const align = new Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new Matrix4().makeTranslation(-center[0], -center[1], -center[2]));

  root.traverse((value) => {
    if (!value || typeof value !== 'object') return;
    const candidate = value as { isMesh?: boolean; matrixWorld?: { elements: number[] } };
    if (!candidate.isMesh || !candidate.matrixWorld?.elements) return;
    const current = new Matrix4().fromArray(candidate.matrixWorld.elements);
    current.premultiply(align);
    candidate.matrixWorld.elements = [...current.elements];
  });
}

function diffRgb(reference: Uint8Array, candidate: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 3);
  for (let p = 0; p < size * size; p++) {
    const i = p * 3;
    const dr = Math.abs((reference[i] ?? 0) - (candidate[i] ?? 0));
    const dg = Math.abs((reference[i + 1] ?? 0) - (candidate[i + 1] ?? 0));
    const db = Math.abs((reference[i + 2] ?? 0) - (candidate[i + 2] ?? 0));
    const m = Math.max(dr, dg, db);
    out[i] = m;
    out[i + 1] = m > 24 ? 80 : 0;
    out[i + 2] = m > 24 ? 220 : 0;
  }
  return out;
}

function rasterToRgb(raster: { data: Uint8Array; width: number; height: number }) {
  return { data: raster.data, width: raster.width, height: raster.height };
}

export interface CompareReferenceGlbsOptions {
  cellSize?: number;
  views?: readonly ViewSpec[];
  provenance?: ReferenceGlbProvenanceV1;
  backdrop?: 'neutral' | 'dark' | 'light';
}

export interface CompareReferenceGlbsResult {
  report: GlbReferenceComparisonReportV1;
  /** Side-by-side rows: reference | candidate | diff per view, in a 3-column grid. */
  comparisonGridPng: Buffer;
}

export async function compareReferenceGlbs(
  referenceGlb: Uint8Array,
  candidateGlb: Uint8Array,
  options: CompareReferenceGlbsOptions = {},
): Promise<CompareReferenceGlbsResult> {
  const cellSize = options.cellSize ?? DEFAULT_COMPARISON_CELL_SIZE;
  const views = options.views ?? SIX_VIEWS;
  const backdrop = options.backdrop ?? 'neutral';

  const referenceScene = await loadGlbGeometryFlatScene(Uint8Array.from(referenceGlb));
  const candidateScene = await loadGlbGeometryFlatScene(Uint8Array.from(candidateGlb));
  alignFlatSceneToUnitBBox(referenceScene.root);
  alignFlatSceneToUnitBBox(candidateScene.root);

  const comparisons: GlbViewComparisonV1[] = [];
  const rowCells: Uint8Array[] = [];

  for (const view of views) {
    // Silhouette comparison, not shading QA: keep both faces so winding errors in
    // third-party GLBs do not erase whole orthographic views.
    const refRgb = rasterizeView(referenceScene.root, view.dir, {
      size: cellSize,
      backdrop,
      backfaceCull: false,
    });
    const candRgb = rasterizeView(candidateScene.root, view.dir, {
      size: cellSize,
      backdrop,
      backfaceCull: false,
    });
    const evidence = analyzeReferenceComparison(
      rasterToRgb({ data: refRgb, width: cellSize, height: cellSize }),
      rasterToRgb({ data: candRgb, width: cellSize, height: cellSize }),
    );
    comparisons.push({ view: view.name, evidence });
    rowCells.push(refRgb, candRgb, diffRgb(refRgb, candRgb, cellSize));
  }

  const referenceSha = sha256Glb(referenceGlb);
  const candidateSha = sha256Glb(candidateGlb);
  const measurable = comparisons.filter(
    (row) => row.evidence.reference.coverage > 0 && row.evidence.rendered.coverage > 0,
  );
  const overallSilhouetteIoU =
    measurable.length > 0
      ? Math.round(
          (measurable.reduce((sum, row) => sum + row.evidence.silhouetteIoU, 0) /
            measurable.length) *
            1e4,
        ) / 1e4
      : 0;

  const report: GlbReferenceComparisonReportV1 = {
    schemaVersion: 1,
    referenceGlbSha256: referenceSha,
    candidateGlbSha256: candidateSha,
    ...(options.provenance ? { provenance: options.provenance } : {}),
    views: comparisons,
    overallSilhouetteIoU,
    cellSize,
    viewCount: views.length,
  };

  const grid = compositeCellGrid(rowCells, cellSize, 3);
  const comparisonGridPng = encodePng(grid.rgb, grid.width, grid.height);

  return { report, comparisonGridPng };
}
