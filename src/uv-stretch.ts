/**
 * UV texel-density measurement and optional chart equalization for atlas unwraps.
 */
import * as THREE from 'three';

export interface UvTexelDensityMetrics {
  /** Triangles with positive world area included in the measure. */
  triangleCount: number;
  /** Median of per-triangle UV area / world area. */
  medianDensity: number;
  /** Largest triangle density divided by the median (>= 1). */
  spreadRatio: number;
  /** Smallest triangle density divided by the median (<= 1). */
  minMedianRatio: number;
  /** Connected UV chart count (triangle adjacency via shared mesh vertices). */
  chartCount: number;
}

const UV_EPS = 1e-9;

function triangleAreas(geo: THREE.BufferGeometry): { world: number[]; uv: number[] } {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const idx = geo.getIndex();
  const count = idx ? idx.count : pos.count;
  const at = (i: number) => (idx ? (idx.getX(i) as number) : i);
  const world: number[] = [];
  const uvArea: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < count; t += 3) {
    const i0 = at(t);
    const i1 = at(t + 1);
    const i2 = at(t + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    world.push(b.clone().sub(a).cross(c.clone().sub(a)).length() / 2);
    const u0 = uv.getX(i0);
    const v0 = uv.getY(i0);
    const u1 = uv.getX(i1);
    const v1 = uv.getY(i1);
    const u2 = uv.getX(i2);
    const v2 = uv.getY(i2);
    uvArea.push(Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) / 2);
  }
  return { world, uv: uvArea };
}

function densitiesFromAreas(world: number[], uv: number[]): number[] {
  const density: number[] = [];
  for (let i = 0; i < world.length; i++) {
    const w = world[i]!;
    if (w < UV_EPS) continue;
    density.push(uv[i]! / w);
  }
  return density;
}

function chartIdsForGeometry(geo: THREE.BufferGeometry): number[] {
  const index = geo.getIndex();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const cornerCount = index ? index.count : pos.count;
  if (cornerCount % 3 !== 0) {
    throw new Error('measureUvTexelDensity: geometry indices must form complete triangles.');
  }
  const triCount = cornerCount / 3;
  const edgeToTris = new Map<string, number[]>();
  const at = (corner: number) => (index ? (index.getX(corner) as number) : corner);
  for (let t = 0; t < triCount; t++) {
    const corners = [t * 3, t * 3 + 1, t * 3 + 2];
    for (let e = 0; e < 3; e++) {
      const a = at(corners[e]!);
      const b = at(corners[(e + 1) % 3]!);
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const list = edgeToTris.get(key);
      if (list) list.push(t);
      else edgeToTris.set(key, [t]);
    }
  }
  const parent = Array.from({ length: triCount }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    let cur = i;
    while (parent[cur] !== cur) {
      const next = parent[cur]!;
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (const tris of edgeToTris.values()) {
    if (tris.length < 2) continue;
    for (let i = 1; i < tris.length; i++) unite(tris[0]!, tris[i]!);
  }
  const roots = Array.from({ length: triCount }, (_, t) => find(t));
  const remap = new Map<number, number>();
  const chartIds = Array.from({ length: triCount }, () => 0);
  let next = 0;
  for (let t = 0; t < triCount; t++) {
    const root = roots[t]!;
    let id = remap.get(root);
    if (id === undefined) {
      id = next++;
      remap.set(root, id);
    }
    chartIds[t] = id;
  }
  return chartIds;
}

/** Summarize per-triangle texel density for finite UV0 on a triangle mesh. */
export function measureUvTexelDensity(
  geometry: THREE.BufferGeometry,
): UvTexelDensityMetrics | null {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!pos || !uv || uv.itemSize !== 2 || uv.count !== pos.count) return null;
  const { world, uv: uvAreas } = triangleAreas(geometry);
  const density = densitiesFromAreas(world, uvAreas);
  if (density.length === 0) return null;
  density.sort((x, y) => x - y);
  const median = density[Math.floor(density.length / 2)]!;
  if (median <= 0 || !Number.isFinite(median)) return null;
  const min = density[0]!;
  const max = density[density.length - 1]!;
  const chartIds = chartIdsForGeometry(geometry);
  const chartCount = new Set(chartIds).size;
  return {
    triangleCount: density.length,
    medianDensity: median,
    spreadRatio: max / median,
    minMedianRatio: min / median,
    chartCount,
  };
}

export interface EqualizeUvChartTexelScaleOptions {
  /**
   * Apply only when spreadRatio exceeds this value. Default 1.05.
   * Returns the input unchanged when density is already uniform.
   */
  minSpreadToApply?: number;
}

export interface EqualizeUvChartTexelScaleResult {
  geometry: THREE.BufferGeometry;
  metricsBefore: UvTexelDensityMetrics;
  metricsAfter: UvTexelDensityMetrics;
  applied: boolean;
}

/**
 * Uniformly scale each UV chart so its median texel density matches the mesh-wide median.
 * Does not repack the atlas; charts may move or overlap when scales diverged sharply.
 */
export function equalizeUvChartTexelScale(
  geometry: THREE.BufferGeometry,
  options: EqualizeUvChartTexelScaleOptions = {},
): EqualizeUvChartTexelScaleResult {
  const before = measureUvTexelDensity(geometry);
  if (!before) {
    throw new Error(
      'equalizeUvChartTexelScale: finite UV0 matching positions is required on a triangle mesh.',
    );
  }
  const minSpread = options.minSpreadToApply ?? 1.05;
  if (before.spreadRatio <= minSpread && before.minMedianRatio >= 1 / minSpread) {
    return { geometry, metricsBefore: before, metricsAfter: before, applied: false };
  }

  const { world, uv: uvAreas } = triangleAreas(geometry);
  const triCount = world.length;
  const chartIds = chartIdsForGeometry(geometry);
  const chartCount = new Set(chartIds).size;
  const triDensity: number[] = [];
  for (let i = 0; i < triCount; i++) {
    const w = world[i]!;
    triDensity.push(w < UV_EPS ? 0 : uvAreas[i]! / w);
  }
  const globalMedian = before.medianDensity;

  const chartTriIndices: number[][] = Array.from({ length: chartCount }, () => []);
  for (let t = 0; t < triCount; t++) chartTriIndices[chartIds[t]!]!.push(t);

  const chartMedian: number[] = chartTriIndices.map((tris) => {
    const vals = tris.map((t) => triDensity[t]!).filter((d) => d > 0);
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)] ?? globalMedian;
  });

  const index = geometry.getIndex();
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const at = (corner: number) => (index ? (index.getX(corner) as number) : corner);

  const vertexChart = new Int32Array(pos.count);
  vertexChart.fill(-1);
  for (let t = 0; t < triCount; t++) {
    for (let c = 0; c < 3; c++) {
      const vi = at(t * 3 + c);
      vertexChart[vi] = chartIds[t]!;
    }
  }

  const out = geometry.clone();
  const chartCentroid = chartTriIndices.map((tris) => {
    let uSum = 0;
    let vSum = 0;
    let n = 0;
    for (const t of tris) {
      for (let c = 0; c < 3; c++) {
        const vi = at(t * 3 + c);
        uSum += uvAttr.getX(vi);
        vSum += uvAttr.getY(vi);
        n++;
      }
    }
    return { u: n > 0 ? uSum / n : 0, v: n > 0 ? vSum / n : 0 };
  });

  const nextUv = new Float32Array(uvAttr.count * 2);
  for (let i = 0; i < uvAttr.count; i++) {
    const chart = vertexChart[i] ?? -1;
    if (chart < 0) {
      nextUv[i * 2] = uvAttr.getX(i);
      nextUv[i * 2 + 1] = uvAttr.getY(i);
      continue;
    }
    const median = chartMedian[chart]!;
    const scale = median > 0 ? Math.sqrt(globalMedian / median) : 1;
    const { u: cu, v: cv } = chartCentroid[chart]!;
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    nextUv[i * 2] = Math.fround(cu + (u - cu) * scale);
    nextUv[i * 2 + 1] = Math.fround(cv + (v - cv) * scale);
  }
  out.setAttribute('uv', new THREE.BufferAttribute(nextUv, 2));
  if (out.hasAttribute('tangent')) {
    out.deleteAttribute('tangent');
    const previous = out.userData.kilnAttributeWarnings;
    out.userData.kilnAttributeWarnings = [
      ...(Array.isArray(previous) ? previous : []),
      {
        code: 'UV_REMAP_TANGENTS_DROPPED',
        message:
          'Chart texel-scale equalization changed UVs; regenerate tangents when normal mapping needs them.',
      },
    ];
  }

  const metricsAfter = measureUvTexelDensity(out)!;
  const previous = out.userData.kilnAttributeWarnings;
  out.userData.kilnAttributeWarnings = [
    ...(Array.isArray(previous) ? previous : []),
    {
      code: 'UV_TEXEL_SCALE_EQUALIZED',
      message: `Per-chart UV scale adjusted for uniform texel density (spread ${before.spreadRatio.toFixed(3)}→${metricsAfter.spreadRatio.toFixed(3)}, min/median ${before.minMedianRatio.toFixed(3)}→${metricsAfter.minMedianRatio.toFixed(3)}). Repack or rebake if charts now overlap.`,
    },
  ];

  return { geometry: out, metricsBefore: before, metricsAfter, applied: true };
}

/** Default spread threshold for authoring advisories (max/median density). */
export const UV_TEXEL_SPREAD_ADVISORY_RATIO = 2;

/** Default min/median threshold for authoring advisories. */
export const UV_TEXEL_MIN_MEDIAN_ADVISORY_RATIO = 0.5;

export function uvTexelDensityAdvisory(metrics: UvTexelDensityMetrics): string | null {
  if (
    metrics.spreadRatio <= UV_TEXEL_SPREAD_ADVISORY_RATIO &&
    metrics.minMedianRatio >= UV_TEXEL_MIN_MEDIAN_ADVISORY_RATIO
  ) {
    return null;
  }
  return (
    `uvTexelDensity spread=${metrics.spreadRatio.toFixed(2)} min/median=${metrics.minMedianRatio.toFixed(2)} across ${metrics.chartCount} chart(s): ` +
    'tileable machined parts often read better with projectUV or preserveAttributes + remapUV per face; baked CSG atlases can call equalizeUvChartTexelScale after autoUnwrap when charts pack at mismatched scales.'
  );
}
