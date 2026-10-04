/** Higher-level organic authoring helpers built on sweeps, SDFs and mesh ops. */
import * as THREE from 'three';
import type { Point3 } from './geometry';
import { creaseNormals } from './geometry';
import { implicitSurface, type ImplicitSurfaceOptions } from './implicit';
import { circleProfile } from './profile';
import { subdivide } from './ops';
import { sweepProfile } from './sweep';
import { smoothUnionSpheres } from './sdf';

export interface MetaballSphere {
  center: Point3;
  radius: number;
}

export type MetaballSurfaceOptions = Omit<ImplicitSurfaceOptions, 'bounds'> & {
  bounds: ImplicitSurfaceOptions['bounds'];
  /** Shared smooth-union width between spheres. Default 0.15 × smallest radius. */
  blend?: number;
};

/**
 * Smooth union of spheres meshed through the experimental implicit pipeline.
 * Spheres use the same positive-inside convention as `implicitSurface`.
 */
export async function metaballSurface(
  spheres: readonly MetaballSphere[],
  options: MetaballSurfaceOptions,
): Promise<THREE.BufferGeometry> {
  if (!spheres.length) throw new Error('metaballSurface needs at least one sphere');
  for (const s of spheres) {
    if (s.center.length !== 3 || !s.center.every(Number.isFinite))
      throw new Error('metaballSurface sphere center must be three finite numbers');
    if (!Number.isFinite(s.radius) || s.radius <= 0)
      throw new Error('metaballSurface sphere radius must be positive and finite');
  }
  const minRadius = Math.min(...spheres.map((s) => s.radius));
  const blend = options.blend ?? Math.max(minRadius * 0.35, 0.02);
  const { bounds, ...rest } = options;
  const field = (p: Point3) => smoothUnionSpheres(p, spheres, blend);
  return implicitSurface(field, { bounds, ...rest });
}

/**
 * Sample a Catmull-Rom spline through arbitrary control points. Use the samples
 * as a `sweepProfile` or `taperedTube` path for smooth curvature.
 */
export function catmullRomPath(
  controlPoints: readonly Point3[],
  samplesPerSpan = 8,
  closed = false,
): Point3[] {
  if (controlPoints.length < 2) throw new Error('catmullRomPath needs at least two control points');
  if (!Number.isSafeInteger(samplesPerSpan) || samplesPerSpan < 1)
    throw new Error('catmullRomPath samplesPerSpan must be a positive integer');
  if (controlPoints.some((p) => p.length !== 3 || !p.every(Number.isFinite)))
    throw new Error('catmullRomPath control points must be finite [x,y,z] triples');
  const vectors = controlPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(vectors, closed);
  const spans = closed ? controlPoints.length : controlPoints.length - 1;
  const totalSamples = spans * samplesPerSpan + (closed ? 0 : 1);
  return curve.getPoints(totalSamples).map((v) => [v.x, v.y, v.z] as Point3);
}

export interface TaperedTubeOptions {
  radialSegments?: number;
  /** Degree crease for profile sides; 180 shades a round profile smoothly. Default 180. */
  creaseAngle?: number;
  cap?: boolean | 'start' | 'end';
  closed?: boolean;
  up?: Point3;
  twist?: number;
}

/**
 * Circular tube with per-station radius along a polyline path. For smooth paths,
 * sample a spline first with `catmullRomPath`.
 */
export function taperedTube(
  path: readonly Point3[],
  radii: readonly number[],
  options: TaperedTubeOptions = {},
): THREE.BufferGeometry {
  const closed = options.closed ?? false;
  const stations = closed ? path : path;
  if (stations.length < (closed ? 3 : 2))
    throw new Error('taperedTube needs at least two open or three closed path points');
  if (radii.length !== stations.length)
    throw new Error('taperedTube radii must have one entry per path point');
  for (const r of radii) {
    if (!Number.isFinite(r) || r <= 0)
      throw new Error('taperedTube radii must be positive and finite');
  }
  const radialSegments = options.radialSegments ?? 20;
  const profile = circleProfile(1, radialSegments).map(([x, y]) => [x, y] as [number, number]);
  const scale = radii.map((r) => [r, r] as [number, number]);
  const geo = sweepProfile(profile, [...stations], {
    cap: options.cap ?? true,
    closed,
    up: options.up,
    twist: options.twist ?? 0,
    scale,
    creaseAngle: options.creaseAngle ?? 180,
  });
  return geo;
}

export interface SmoothOrganicOptions {
  iterations?: number;
  creaseAngle?: number;
  preserveUV?: boolean;
}

/** Subdivide then angle-limit normals — common finish for organic sweeps and lofts. */
export function smoothOrganic(
  geometry: THREE.BufferGeometry,
  options: SmoothOrganicOptions = {},
): THREE.BufferGeometry {
  const iterations = options.iterations ?? 1;
  const preserveUV = options.preserveUV ?? false;
  const subdivided = subdivide(geometry, iterations, preserveUV ? { preserveUV: true } : undefined);
  return creaseNormals(subdivided, { angle: options.creaseAngle ?? 55 });
}

export interface RockDisplaceOptions {
  /** Peak normal displacement in asset units. Default 0.018. */
  amplitude?: number;
  /** Base spatial frequency before octave doubling. Default 1.05 (chunky, not spiky). */
  frequency?: number;
  /** Fractal layers; default 2. Values above 3 add high-frequency shard detail. */
  octaves?: number;
  seed?: number;
  /**
   * Broad planar facets via angle-limited normals after displacement.
   * Default 26°. Pass `null` to keep smooth vertex normals.
   */
  facetingAngle?: number | null;
  /**
   * When set, applies piecewise-constant Voronoi cell offsets before fractal
   * displacement — sharp fractured facets instead of smooth blobbing.
   */
  voronoiCells?: number;
}

export interface RockBoulderOptions {
  /** Half-extents along X, Y, Z before jitter. Default [0.12, 0.1, 0.11]. */
  halfExtents?: readonly [number, number, number];
  seed?: number;
  /** Icosahedron subdivision level 0–2. Default 1. */
  detail?: number;
  /** Voronoi facet cell count. Default 11. */
  voronoiCells?: number;
  /** Extra crease angle after displacement. Default 24°. */
  facetingAngle?: number;
}

function hashNoise(x: number, y: number, z: number, seed: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 43.21) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** Low-frequency biased noise — reduces hedgehog spikes from raw fractal hash. */
function chunkyNoise(x: number, y: number, z: number, seed: number): number {
  const n = hashNoise(x, y, z, seed);
  const t = Math.abs(n);
  return Math.sign(n) * (t * t * (3 - 2 * t));
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function voronoiFacetDisplace(
  geometry: THREE.BufferGeometry,
  options: { cells: number; amplitude: number; seed: number },
): THREE.BufferGeometry {
  const { cells, amplitude, seed } = options;
  const out = geometry.clone();
  const pos = out.getAttribute('position') as THREE.BufferAttribute;
  if (!pos) throw new Error('voronoiFacetDisplace needs positions');
  out.computeBoundingBox();
  const box = out.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const rng = mulberry32(seed);
  const cellCenters: THREE.Vector3[] = [];
  for (let c = 0; c < cells; c++) {
    cellCenters.push(
      new THREE.Vector3(
        center.x + (rng() - 0.5) * size.x * 0.9,
        center.y + (rng() - 0.5) * size.y * 0.9,
        center.z + (rng() - 0.5) * size.z * 0.9,
      ),
    );
  }
  const cellOffset = cellCenters.map(() => {
    const dir = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5);
    if (dir.lengthSq() < 1e-12) dir.set(0, 1, 0);
    dir.normalize();
    const mag = amplitude * (0.55 + rng() * 0.9);
    return dir.multiplyScalar(mag);
  });
  const vertexCell = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    let best = 0;
    let bestD = cellCenters[0]!.distanceToSquared(p);
    for (let c = 1; c < cells; c++) {
      const d = cellCenters[c]!.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    vertexCell[i] = best;
  }
  for (let i = 0; i < pos.count; i++) {
    const off = cellOffset[vertexCell[i]!]!;
    pos.setXYZ(i, pos.getX(i) + off.x, pos.getY(i) + off.y, pos.getZ(i) + off.z);
  }
  pos.needsUpdate = true;
  out.computeVertexNormals();
  return out;
}

/**
 * Angular boulder mesh: jittered low-poly hull, Voronoi facets, mild erosion noise.
 * Prefer this over `sphereGeo` + `rockDisplace` for convincing rocks by default.
 */
export function rockBoulder(options: RockBoulderOptions = {}): THREE.BufferGeometry {
  const seed = options.seed ?? 1;
  const [hx, hy, hz] = options.halfExtents ?? [0.12, 0.1, 0.11];
  const detail = options.detail ?? 1;
  const voronoiCells = options.voronoiCells ?? 11;
  const facetingAngle = options.facetingAngle ?? 24;
  if (!Number.isSafeInteger(detail) || detail < 0 || detail > 2)
    throw new Error('rockBoulder detail must be an integer from 0 to 2');
  const rng = mulberry32(seed);
  const base = new THREE.IcosahedronGeometry(1, detail);
  const pos = base.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const jx = 0.78 + rng() * 0.38;
    const jy = y < 0 ? 0.65 + rng() * 0.25 : 0.75 + rng() * 0.35;
    const jz = 0.78 + rng() * 0.38;
    const len = Math.hypot(x, y, z) || 1;
    pos.setXYZ(i, (x / len) * hx * jx, (y / len) * hy * jy, (z / len) * hz * jz);
  }
  pos.needsUpdate = true;
  base.computeVertexNormals();
  const extent = Math.max(hx, hy, hz);
  let geo = voronoiFacetDisplace(base, {
    cells: voronoiCells,
    amplitude: extent * 0.16,
    seed: seed + 41,
  });
  geo = rockDisplace(geo, {
    amplitude: extent * 0.022,
    frequency: 1.25,
    octaves: 2,
    seed: seed + 3,
    voronoiCells: undefined,
    facetingAngle: null,
  });
  return creaseNormals(geo, { angle: facetingAngle });
}

/** Deterministic fractal displacement along vertex normals for rock-like surfaces. */
export function rockDisplace(
  geometry: THREE.BufferGeometry,
  options: RockDisplaceOptions = {},
): THREE.BufferGeometry {
  const amplitude = options.amplitude ?? 0.018;
  const frequency = options.frequency ?? 1.05;
  const octaves = options.octaves ?? 2;
  const seed = options.seed ?? 1;
  const facetingAngle = options.facetingAngle === undefined ? 26 : options.facetingAngle;
  const voronoiCells = options.voronoiCells;
  if (!Number.isFinite(amplitude) || amplitude < 0)
    throw new Error('rockDisplace amplitude must be nonnegative and finite');
  if (!Number.isSafeInteger(octaves) || octaves < 1 || octaves > 6)
    throw new Error('rockDisplace octaves must be an integer from 1 to 6');
  let out = geometry.clone();
  if (voronoiCells !== undefined && voronoiCells > 0) {
    out = voronoiFacetDisplace(out, {
      cells: voronoiCells,
      amplitude: amplitude * 1.8,
      seed: seed + 91,
    });
  }
  const pos = out.getAttribute('position') as THREE.BufferAttribute;
  if (!pos) throw new Error('rockDisplace needs positions');
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  const norm = out.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let n = 0;
    let amp = amplitude;
    let freq = frequency;
    for (let o = 0; o < octaves; o++) {
      n += chunkyNoise(x * freq, y * freq, z * freq, seed + o * 17) * amp;
      amp *= 0.38;
      freq *= 1.85;
    }
    pos.setXYZ(i, x + norm.getX(i) * n, y + norm.getY(i) * n, z + norm.getZ(i) * n);
  }
  pos.needsUpdate = true;
  out.computeVertexNormals();
  const normals = out.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < normals.count; i++) {
    const x = normals.getX(i);
    const y = normals.getY(i);
    const z = normals.getZ(i);
    const len = Math.hypot(x, y, z);
    if (!Number.isFinite(len) || len < 1e-12) {
      normals.setXYZ(i, 0, 1, 0);
      continue;
    }
    if (Math.abs(len - 1) > 1e-6) normals.setXYZ(i, x / len, y / len, z / len);
  }
  normals.needsUpdate = true;
  out.computeBoundingBox();
  out.computeBoundingSphere();
  if (facetingAngle !== null) return creaseNormals(out, { angle: facetingAngle });
  return out;
}
