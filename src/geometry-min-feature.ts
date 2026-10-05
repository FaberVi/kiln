/** Profile-outline min-feature advisories before bevel erosion (2D, profile units). */
import type * as THREE from 'three';

export const DEFAULT_MIN_FEATURE_TOLERANCE_RATIO = 8;

type GeometryNote = { code: string; message: string };

export function profileMinFeatureWarnings(
  profile: readonly (readonly [number, number])[],
  options: { bevel?: number; toleranceRatio?: number } = {},
): string[] {
  if (profile.length < 3) return [];
  let minX = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY,
    minY = Number.POSITIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY;
  let minEdge = Number.POSITIVE_INFINITY;
  for (let i = 0; i < profile.length; i++) {
    const [x, y] = profile[i]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    const [nx, ny] = profile[(i + 1) % profile.length]!;
    const len = Math.hypot(nx - x, ny - y);
    if (len > 0 && len < minEdge) minEdge = len;
  }
  const extent = Math.hypot(maxX - minX, maxY - minY);
  if (!(extent > 0) || !Number.isFinite(extent)) return [];
  const tolerance = extent * 1e-6;
  const ratio = options.toleranceRatio ?? DEFAULT_MIN_FEATURE_TOLERANCE_RATIO;
  const threshold = tolerance * ratio;
  const thinExtent = Math.min(maxX - minX, maxY - minY, minEdge);
  const warnings: string[] = [];
  if (thinExtent > 0 && thinExtent < threshold) {
    warnings.push(
      `Profile min feature ${thinExtent} is below ${ratio}× profile tolerance (${threshold}). Bevel erosion or export diagnostics may erase it — widen the section or reduce detail before extrude/revolve/bevel.`,
    );
  }
  const bevel = options.bevel ?? 0;
  if (bevel > 0 && thinExtent > 0 && bevel >= thinExtent * 0.5) {
    warnings.push(
      `Profile bevel ${bevel} is at least half the narrowest measured width (${thinExtent}). Erosion may empty the section before the solid completes — reduce bevel or widen the outline.`,
    );
  }
  return warnings;
}

export function attachProfileMinFeatureWarnings(
  geometry: THREE.BufferGeometry,
  profile: readonly (readonly [number, number])[],
  bevel: number,
): void {
  const messages = profileMinFeatureWarnings(profile, { bevel });
  if (!messages.length) return;
  const prior = geometry.userData.kilnGeometryWarnings;
  const notes: GeometryNote[] = Array.isArray(prior)
    ? prior.filter(
        (n): n is GeometryNote =>
          !!n && typeof n === 'object' && 'code' in n && typeof n.code === 'string',
      )
    : [];
  for (const message of messages) {
    notes.push({ code: 'GEO_MIN_FEATURE', message });
  }
  geometry.userData.kilnGeometryWarnings = notes;
}
