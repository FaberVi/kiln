/** Bounded polyline densification for sweep paths and similar workflows. */
import * as THREE from 'three';
import type { Point3 } from './geometry';
import { assertFiniteTriple } from './geometry-budget';

export const SUBDIVIDE_PATH_MAX_STATIONS = 512;
export const SUBDIVIDE_PATH_DEFAULT_MIN_TURN = 20;
export const SUBDIVIDE_PATH_DEFAULT_DEGREES_PER_STATION = 15;

export interface SubdividePathByCurvatureOptions {
  /** Maximum returned points including endpoints. Default 512. */
  maxStations?: number;
  /** Skip splits that would create spans shorter than this distance in meters. */
  minSegmentLength?: number;
  /** Interior turns at least this sharp (degrees) may gain stations. Default 20. */
  minTurnDegrees?: number;
  /** Target maximum turn angle represented by one span. Default 15 degrees. */
  degreesPerStation?: number;
}

function turnDegrees(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  const incoming = b.clone().sub(a);
  const outgoing = c.clone().sub(b);
  if (incoming.lengthSq() === 0 || outgoing.lengthSq() === 0) return 0;
  incoming.normalize();
  outgoing.normalize();
  return THREE.MathUtils.radToDeg(Math.acos(Math.min(1, Math.max(-1, incoming.dot(outgoing)))));
}

function splitsForTurn(turn: number, minTurn: number, degreesPerStation: number): number {
  if (turn < minTurn) return 1;
  return Math.max(1, Math.ceil(turn / degreesPerStation));
}

function dedupePath(points: THREE.Vector3[], minDistance: number): Point3[] {
  if (!points.length) return [];
  const out: Point3[] = [[points[0]!.x, points[0]!.y, points[0]!.z]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(p.x - last[0], p.y - last[1], p.z - last[2]) >= minDistance) {
      out.push([p.x, p.y, p.z]);
    }
  }
  return out;
}

/**
 * Insert stations on a polyline where interior turns are sharp. Straight runs stay sparse;
 * tight bends gain bounded intermediate points for sweepProfile and similar helpers.
 */
export function subdividePathByCurvature(
  path: readonly Point3[],
  options: SubdividePathByCurvatureOptions = {},
): Point3[] {
  if (path.length < 2) {
    throw new Error('subdividePathByCurvature requires at least two finite path points');
  }
  for (let i = 0; i < path.length; i++) {
    assertFiniteTriple(`subdividePathByCurvature point ${i}`, path[i]!);
  }
  const maxStations = options.maxStations ?? SUBDIVIDE_PATH_MAX_STATIONS;
  if (!Number.isSafeInteger(maxStations) || maxStations < 2) {
    throw new RangeError('subdividePathByCurvature maxStations must be an integer >= 2');
  }
  const minTurn = options.minTurnDegrees ?? SUBDIVIDE_PATH_DEFAULT_MIN_TURN;
  const degreesPerStation = options.degreesPerStation ?? SUBDIVIDE_PATH_DEFAULT_DEGREES_PER_STATION;
  if (!Number.isFinite(minTurn) || minTurn < 0 || minTurn > 180) {
    throw new RangeError('subdividePathByCurvature minTurnDegrees must be between 0 and 180');
  }
  if (!Number.isFinite(degreesPerStation) || degreesPerStation <= 0) {
    throw new RangeError('subdividePathByCurvature degreesPerStation must be positive and finite');
  }

  const pts = path.map((p) => new THREE.Vector3(...p));
  const extent = new THREE.Box3().setFromPoints(pts).getSize(new THREE.Vector3()).length();
  const minSegmentLength = options.minSegmentLength ?? Math.max(extent * 1e-4, 1e-9);

  const turns = pts.map((_, i) => {
    if (i === 0 || i === pts.length - 1) return 0;
    return turnDegrees(pts[i - 1]!, pts[i]!, pts[i + 1]!);
  });

  const out: THREE.Vector3[] = [pts[0]!.clone()];
  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i]!,
      end = pts[i + 1]!;
    const span = start.distanceTo(end);
    if (!(span > 0)) continue;
    let splits = Math.max(
      splitsForTurn(turns[i]!, minTurn, degreesPerStation),
      splitsForTurn(turns[i + 1]!, minTurn, degreesPerStation),
    );
    if (span / splits < minSegmentLength) {
      splits = Math.max(1, Math.floor(span / minSegmentLength));
    }
    const remaining = maxStations - out.length - (pts.length - 1 - i);
    splits = Math.min(splits, Math.max(1, remaining));
    for (let k = 1; k < splits; k++) {
      const t = k / splits;
      out.push(start.clone().lerp(end, t));
    }
    out.push(end.clone());
  }

  const deduped = dedupePath(out, minSegmentLength * 0.5);
  if (deduped.length > maxStations) return deduped.slice(0, maxStations);
  return deduped;
}
