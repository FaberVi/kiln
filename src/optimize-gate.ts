/**
 * Size-aware gate for `optimize: 'full'` rigid-group merging.
 *
 * Small hard-surface props can lose more bytes to duplicated merge geometry than
 * they save in draw calls (for example a ~9 KB crate growing past ~20 KB). Palette
 * consolidation remains available; only the rigid merge step is skipped.
 */
import type { InstanceabilityMetrics } from './metrics';

/** Minimum placed triangles before rigid merge runs (post-dedup document). */
export const RIGID_MERGE_MIN_TRIANGLES = 400;

/** Minimum estimated draws before merge; below this, draw savings do not repay bytes. */
export const RIGID_MERGE_MIN_DRAW_CALLS = 4;

export type RigidMergeGateDecision =
  | { run: true }
  | {
      run: false;
      reason: 'below-triangle-threshold' | 'below-draw-threshold';
      triangles: number;
      uniqueMaterials: number;
      drawCalls: number;
    };

export function shouldRunRigidMerge(
  metrics: Pick<InstanceabilityMetrics, 'triangles' | 'uniqueMaterials' | 'drawCalls'>,
): RigidMergeGateDecision {
  if (metrics.triangles < RIGID_MERGE_MIN_TRIANGLES) {
    return {
      run: false,
      reason: 'below-triangle-threshold',
      triangles: metrics.triangles,
      uniqueMaterials: metrics.uniqueMaterials,
      drawCalls: metrics.drawCalls,
    };
  }
  if (metrics.drawCalls < RIGID_MERGE_MIN_DRAW_CALLS) {
    return {
      run: false,
      reason: 'below-draw-threshold',
      triangles: metrics.triangles,
      uniqueMaterials: metrics.uniqueMaterials,
      drawCalls: metrics.drawCalls,
    };
  }
  return { run: true };
}
