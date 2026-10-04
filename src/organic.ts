/** Higher-level organic authoring helpers built on sweeps, SDFs and mesh ops. */
import * as THREE from 'three';
import type { Point3 } from './geometry';
import { creaseNormals } from './geometry';
import { implicitSurface, type ImplicitSurfaceOptions } from './implicit';
import { circleProfile } from './profile';
import { subdivide } from './ops';
import { sweepProfile } from './sweep';
import { smoothUnionSpheres } from './sdf';
import { getManifoldModule, manifoldToGeometry } from './solids';
import type { Manifold } from 'manifold-3d';

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
}

export interface RockBoulderOptions {
  /** Half-extents along X, Y, Z before shaping. Default [0.12, 0.1, 0.11]. */
  halfExtents?: readonly [number, number, number];
  seed?: number;
  /** Crease angle for flat-shaded facets on the exported solid. Default 24°. */
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

function randomUnitVector(rng: () => number): [number, number, number] {
  const u = rng();
  const v = rng();
  const theta = 2 * Math.PI * u;
  const z = 2 * v - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(theta), r * Math.sin(theta), z];
}

/**
 * Manifold-backed boulder: jittered convex hull + random plane trims on an ellipsoid,
 * random surface chips, mild radial warp. Watertight solid mesh.
 */
export async function rockBoulder(options: RockBoulderOptions = {}): Promise<THREE.BufferGeometry> {
  const seed = options.seed ?? 1;
  const [hx, hy, hz] = options.halfExtents ?? [0.12, 0.1, 0.11];
  const facetingAngle = options.facetingAngle ?? 34;
  const rng = mulberry32(seed);
  const mod = await getManifoldModule();
  const owned: Manifold[] = [];
  const track = (m: Manifold) => {
    owned.push(m);
    return m;
  };
  const extent = Math.max(hx, hy, hz);
  const acceptSolid = (prev: Manifold, next: Manifold, minTris = 32): Manifold => {
    if (next.isEmpty() || next.numTri() < minTris) return prev;
    const prevVol = prev.volume();
    const nextVol = next.volume();
    if (prevVol > 0 && nextVol < prevVol * 0.22) return prev;
    return next;
  };
  try {
    const sx = hx * (0.88 + rng() * 0.18);
    const sy = hy * (0.82 + rng() * 0.2);
    const sz = hz * (0.88 + rng() * 0.18);

    const hullCount = 14 + (seed % 8);
    const microR = extent * (0.035 + rng() * 0.015);
    const seeds: Manifold[] = [];
    for (let i = 0; i < hullCount; i++) {
      const [ux, uy, uz] = randomUnitVector(rng);
      const bulge = 0.78 + rng() * 0.28;
      seeds.push(
        track(
          mod.Manifold.sphere(microR, 8).translate([
            sx * ux * bulge,
            sy * uy * bulge,
            sz * uz * bulge,
          ]),
        ),
      );
    }
    let solid = track(mod.Manifold.hull(seeds));

    const trims = 8 + (seed % 5);
    for (let i = 0; i < trims; i++) {
      const n = randomUnitVector(rng);
      const offset = extent * (-0.18 + rng() * 0.36);
      const trimmed = track(solid.trimByPlane(n, offset));
      solid = acceptSolid(solid, trimmed);
    }

    const chips = 4 + (seed % 3);
    for (let i = 0; i < chips; i++) {
      const n = randomUnitVector(rng);
      const chip = track(
        mod.Manifold.cube(
          [
            extent * (0.22 + rng() * 0.28),
            extent * (0.18 + rng() * 0.22),
            extent * (0.24 + rng() * 0.3),
          ],
          true,
        )
          .rotate([rng() * 360, rng() * 360, rng() * 360])
          .translate([
            n[0] * sx * (0.62 + rng() * 0.28),
            n[1] * sy * (0.62 + rng() * 0.28),
            n[2] * sz * (0.62 + rng() * 0.28),
          ]),
      );
      const chipped = track(solid.subtract(chip));
      solid = acceptSolid(solid, chipped, 28);
    }

    const warpAmp = extent * 0.022;
    solid = track(
      solid.warp((v: number[]) => {
        const x = v[0]!;
        const y = v[1]!;
        const z = v[2]!;
        const nx = x / (sx || 1);
        const ny = y / (sy || 1);
        const nz = z / (sz || 1);
        const n =
          chunkyNoise(nx * 1.4, ny * 1.4, nz * 1.4, seed) * warpAmp +
          chunkyNoise(nx * 2.8, ny * 2.8, nz * 2.8, seed + 5) * warpAmp * 0.4;
        const len = Math.hypot(x, y, z);
        if (len < 1e-9) return;
        v[0]! += (x / len) * n;
        v[1]! += (y / len) * n;
        v[2]! += (z / len) * n;
      }),
    );

    if (solid.isEmpty()) throw new Error('rockBoulder: shaping removed the entire solid');
    let geo = manifoldToGeometry(solid, { smooth: false });
    geo = creaseNormals(geo, { angle: facetingAngle });
    geo.userData.kilnSolidRock = true;
    return geo;
  } finally {
    for (const m of owned) m.delete();
  }
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
  if (!Number.isFinite(amplitude) || amplitude < 0)
    throw new Error('rockDisplace amplitude must be nonnegative and finite');
  if (!Number.isSafeInteger(octaves) || octaves < 1 || octaves > 6)
    throw new Error('rockDisplace octaves must be an integer from 1 to 6');
  const out = geometry.clone();
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
