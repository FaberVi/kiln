/**
 * UV texel-density analysis and optional post-unwrap normalization for atlas charts.
 *
 * `autoUnwrap` (xatlas) packs arbitrary CSG topology into charts whose 3D-to-UV
 * area ratios often differ from analytic primitive UVs (~0.32 vs ~1.0 stretch on
 * mixed assets). Prefer `projectUV` / `remapUV` on primitives with good built-in
 * UVs; use `autoUnwrap` only where charts are required, then optionally
 * `normalizeAtlasTexelScale` to even per-chart density.
 */
import * as THREE from 'three';

export interface UvStretchStats {
  /** L² stretch factors sampled per triangle (1 = isotropic in UV space). */
  stretch: { min: number; median: number; p90: number; max: number };
  /** √(3D area / UV area) per chart; higher means coarser texels in UV space. */
  texelScale: { min: number; median: number; max: number };
  triangles: number;
  islands: number;
}

export interface UvWorkflowAdvisory {
  stats: UvStretchStats;
  /** Human-readable guidance; empty when metrics look healthy. */
  messages: string[];
}

export interface NormalizeAtlasTexelScaleOptions {
  /** Target √(3D/UV) scale across charts; default is the median chart scale. */
  targetScale?: number;
  /** Re-fit all charts into [0, 1] after scaling (default true). */
  fitUnitSquare?: boolean;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _e0 = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _u0 = new THREE.Vector2();
const _u1 = new THREE.Vector2();

function triArea3D(ai: number, bi: number, ci: number, pos: THREE.BufferAttribute): number {
  _a.fromBufferAttribute(pos, ai);
  _b.fromBufferAttribute(pos, bi);
  _c.fromBufferAttribute(pos, ci);
  _e0.subVectors(_b, _a);
  _e1.subVectors(_c, _a);
  return _e0.cross(_e1).length() * 0.5;
}

function triAreaUv(ai: number, bi: number, ci: number, uv: THREE.BufferAttribute): number {
  _u0.set(uv.getX(ai), uv.getY(ai));
  _u1.set(uv.getX(bi), uv.getY(bi));
  const u2x = uv.getX(ci);
  const u2y = uv.getY(ci);
  return Math.abs((_u1.x - _u0.x) * (u2y - _u0.y) - (_u1.y - _u0.y) * (u2x - _u0.x)) * 0.5;
}

/** L² stretch of one triangle (Sander et al.); 1 is ideal, larger is more stretched. */
function triangleL2Stretch(
  ai: number,
  bi: number,
  ci: number,
  pos: THREE.BufferAttribute,
  uv: THREE.BufferAttribute,
): number {
  const ax = pos.getX(ai);
  const ay = pos.getY(ai);
  const az = pos.getZ(ai);
  const bx = pos.getX(bi);
  const by = pos.getY(bi);
  const bz = pos.getZ(bi);
  const cx = pos.getX(ci);
  const cy = pos.getY(ci);
  const cz = pos.getZ(ci);
  const uax = uv.getX(ai);
  const uay = uv.getY(ai);
  const ubx = uv.getX(bi);
  const uby = uv.getY(bi);
  const ucx = uv.getX(ci);
  const ucy = uv.getY(ci);

  const s1x = bx - ax;
  const s1y = by - ay;
  const s1z = bz - az;
  const s2x = cx - ax;
  const s2y = cy - ay;
  const s2z = cz - az;
  const t1x = ubx - uax;
  const t1y = uby - uay;
  const t2x = ucx - uax;
  const t2y = ucy - uay;

  const det = t1x * t2y - t1y * t2x;
  if (Math.abs(det) < 1e-20) return Number.POSITIVE_INFINITY;

  const invDet = 1 / det;
  const a11 = (s1x * t2y - s2x * t1y) * invDet;
  const a21 = (s1y * t2y - s2y * t1y) * invDet;
  const a31 = (s1z * t2y - s2z * t1y) * invDet;
  const a12 = (s2x * t1x - s1x * t2x) * invDet;
  const a22 = (s2y * t1x - s1y * t2x) * invDet;
  const a32 = (s2z * t1x - s1z * t2x) * invDet;

  const g11 = a11 * a11 + a21 * a21 + a31 * a31;
  const g22 = a12 * a12 + a22 * a22 + a32 * a32;
  const g12 = a11 * a12 + a21 * a22 + a31 * a32;
  const trace = g11 + g22;
  const detG = g11 * g22 - g12 * g12;
  const root = Math.sqrt(Math.max(0, trace * trace * 0.25 - detG));
  const sigma1 = Math.sqrt(Math.max(0, trace * 0.5 + root));
  const sigma2 = Math.sqrt(Math.max(0, trace * 0.5 - root));
  if (sigma2 < 1e-20) return Number.POSITIVE_INFINITY;
  return Math.sqrt((sigma1 * sigma1 + sigma2 * sigma2) * 0.5);
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const t = idx - lo;
  return sorted[lo]! * (1 - t) + sorted[hi]! * t;
}

function summarize(values: number[]): { min: number; median: number; p90: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v) && v > 0).sort((x, y) => x - y);
  if (!finite.length) return { min: 0, median: 0, p90: 0, max: 0 };
  return {
    min: finite[0]!,
    median: quantile(finite, 0.5),
    p90: quantile(finite, 0.9),
    max: finite[finite.length - 1]!,
  };
}

type Island = { triangles: number[]; area3d: number; areaUv: number };

function analyzeIndexed(geometry: THREE.BufferGeometry): {
  islands: Island[];
  stretches: number[];
} {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const index = geometry.getIndex();
  if (!pos || !uv || !index || index.count % 3 !== 0) {
    throw new Error('analyzeUvStretch: indexed geometry with position and uv is required.');
  }

  const triCount = index.count / 3;
  const parent = Array.from({ length: triCount }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const edgeKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeToTris = new Map<string, { tri: number; corners: [number, number] }[]>();

  for (let t = 0; t < triCount; t++) {
    const i0 = index.getX(t * 3)!;
    const i1 = index.getX(t * 3 + 1)!;
    const i2 = index.getX(t * 3 + 2)!;
    for (const [a, b] of [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ] as [number, number][]) {
      const key = edgeKey(a, b);
      const list = edgeToTris.get(key) ?? [];
      list.push({ tri: t, corners: [a, b] });
      edgeToTris.set(key, list);
    }
  }

  const uvEqual = (i: number, j: number) =>
    Math.abs(uv.getX(i) - uv.getX(j)) < 1e-6 && Math.abs(uv.getY(i) - uv.getY(j)) < 1e-6;

  for (const list of edgeToTris.values()) {
    if (list.length !== 2) continue;
    const left = list[0];
    const right = list[1];
    if (!left || !right) continue;
    if (!uvEqual(left.corners[0], right.corners[0]) || !uvEqual(left.corners[1], right.corners[1]))
      continue;
    unite(left.tri, right.tri);
  }

  const buckets = new Map<number, Island>();
  const stretches: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const i0 = index.getX(t * 3)!;
    const i1 = index.getX(t * 3 + 1)!;
    const i2 = index.getX(t * 3 + 2)!;
    const a3 = triArea3D(i0, i1, i2, pos);
    const aUv = triAreaUv(i0, i1, i2, uv);
    if (a3 > 0 && aUv > 0) stretches.push(triangleL2Stretch(i0, i1, i2, pos, uv));
    const root = find(t);
    const bucket = buckets.get(root) ?? { triangles: [], area3d: 0, areaUv: 0 };
    bucket.triangles.push(t);
    bucket.area3d += a3;
    bucket.areaUv += aUv;
    buckets.set(root, bucket);
  }
  return { islands: [...buckets.values()], stretches };
}

/** Measure per-triangle stretch and per-chart texel scale on an unwrapped mesh. */
export function analyzeUvStretch(geometry: THREE.BufferGeometry): UvStretchStats {
  const { islands, stretches } = analyzeIndexed(geometry);
  const chartScales = islands
    .map((island) => (island.areaUv > 0 ? Math.sqrt(island.area3d / island.areaUv) : 0))
    .filter((v) => v > 0);
  return {
    stretch: summarize(stretches),
    texelScale: {
      min: chartScales.length ? Math.min(...chartScales) : 0,
      median: chartScales.length
        ? quantile(
            [...chartScales].sort((a, b) => a - b),
            0.5,
          )
        : 0,
      max: chartScales.length ? Math.max(...chartScales) : 0,
    },
    triangles: stretches.length,
    islands: islands.length,
  };
}

const STRETCH_HIGH = 1.35;
const SCALE_SPREAD_RATIO = 2.5;

/**
 * Advisory for choosing `projectUV` / `remapUV` vs `autoUnwrap`, and whether to
 * run {@link normalizeAtlasTexelScale} after xatlas on CSG-heavy meshes.
 */
export function uvWorkflowAdvisory(
  geometry: THREE.BufferGeometry,
  context: 'generic' | 'csg' = 'generic',
): UvWorkflowAdvisory {
  const stats = analyzeUvStretch(geometry);
  const messages: string[] = [];
  if (stats.stretch.median > STRETCH_HIGH || stats.stretch.p90 > STRETCH_HIGH * 1.25) {
    messages.push(
      `Median UV stretch is ${stats.stretch.median.toFixed(2)} (p90 ${stats.stretch.p90.toFixed(2)}). ` +
        'For box/cylinder/plane primitives with tileable materials, prefer built-in UVs with remapUV scale/offset or projectUV instead of autoUnwrap.',
    );
  }
  if (
    stats.islands > 1 &&
    stats.texelScale.min > 0 &&
    stats.texelScale.max / stats.texelScale.min > SCALE_SPREAD_RATIO
  ) {
    messages.push(
      `Chart texel scales span ${stats.texelScale.min.toFixed(3)}–${stats.texelScale.max.toFixed(3)} ` +
        `(median ${stats.texelScale.median.toFixed(3)}). After autoUnwrap on CSG, call normalizeAtlasTexelScale to even per-chart density.`,
    );
  }
  if (context === 'csg' && stats.stretch.median < 0.75) {
    messages.push(
      'Low median stretch on CSG unwrap often means charts are over-compressed in UV space; normalizeAtlasTexelScale or a higher autoUnwrap resolution may help.',
    );
  }
  return { stats, messages };
}

/**
 * Scale each xatlas chart so √(3D/UV area) matches the median chart (or a target).
 * Returns an owned geometry; tangents are dropped when UVs change non-trivially.
 */
export function normalizeAtlasTexelScale(
  geometry: THREE.BufferGeometry,
  options: NormalizeAtlasTexelScaleOptions = {},
): THREE.BufferGeometry {
  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const index = geometry.getIndex();
  if (!uvAttr || !pos || !index) {
    throw new Error(
      'normalizeAtlasTexelScale: indexed geometry with position and uv is required after autoUnwrap.',
    );
  }

  const { islands } = analyzeIndexed(geometry);
  if (!islands.length) throw new Error('normalizeAtlasTexelScale: no triangles to normalize.');

  const scales = islands
    .map((island) => (island.areaUv > 0 ? Math.sqrt(island.area3d / island.areaUv) : 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const target = options.targetScale ?? (scales.length ? quantile(scales, 0.5) : 1);
  const fitUnit = options.fitUnitSquare !== false;

  const values = new Float32Array(uvAttr.count * 2);
  for (let i = 0; i < uvAttr.count; i++) {
    values[i * 2] = uvAttr.getX(i);
    values[i * 2 + 1] = uvAttr.getY(i);
  }

  for (const island of islands) {
    if (island.areaUv <= 0) continue;
    const chartScale = Math.sqrt(island.area3d / island.areaUv);
    if (chartScale <= 0) continue;
    const factor = target / chartScale;
    if (Math.abs(factor - 1) < 1e-4) continue;

    let cx = 0;
    let cy = 0;
    let count = 0;
    const verts = new Set<number>();
    for (const t of island.triangles) {
      for (let k = 0; k < 3; k++) {
        const vi = index.getX(t * 3 + k)!;
        if (verts.has(vi)) continue;
        verts.add(vi);
        cx += values[vi * 2]!;
        cy += values[vi * 2 + 1]!;
        count += 1;
      }
    }
    if (!count) continue;
    cx /= count;
    cy /= count;
    for (const vi of verts) {
      values[vi * 2] = Math.fround(cx + (values[vi * 2]! - cx) * factor);
      values[vi * 2 + 1] = Math.fround(cy + (values[vi * 2 + 1]! - cy) * factor);
    }
  }

  if (fitUnit) {
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    for (let i = 0; i < values.length; i += 2) {
      minU = Math.min(minU, values[i]!);
      minV = Math.min(minV, values[i + 1]!);
      maxU = Math.max(maxU, values[i]!);
      maxV = Math.max(maxV, values[i + 1]!);
    }
    const spanU = maxU - minU;
    const spanV = maxV - minV;
    const span = Math.max(spanU, spanV, 1e-8);
    for (let i = 0; i < values.length; i += 2) {
      values[i] = Math.fround((values[i]! - minU) / span);
      values[i + 1] = Math.fround((values[i + 1]! - minV) / span);
    }
  }

  const out = geometry.clone();
  out.setAttribute('uv', new THREE.Float32BufferAttribute(values, 2));
  if (out.getAttribute('tangent')) {
    out.deleteAttribute('tangent');
    out.userData['UV_REMAP_TANGENTS_DROPPED'] = true;
  }
  if (geometry.userData['atlas']) out.userData['atlas'] = { ...geometry.userData['atlas'] };
  return out;
}
