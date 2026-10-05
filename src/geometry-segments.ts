import { assertDimension, GEOMETRY_ALLOCATION_LIMITS } from './geometry-budget';

export interface SegmentsFromRadiusOptions {
  /**
   * Maximum physical chord length (meters) between adjacent rim vertices.
   * Defaults to `0.01` (1 cm), i.e. `ceil(pi * radius / maxChordLength)` segments
   * before min/max clamps. Override for tighter or coarser visible pipes.
   */
  maxChordLength?: number;
  /** Lower clamp; default 8 (still rounder than the primitive default of 8 only at large radius). */
  min?: number;
  /** Upper clamp; default 128. */
  max?: number;
}

const DEFAULT_MIN_SEGMENTS = 8;
const DEFAULT_MAX_SEGMENTS = 128;

/** Recommended radial segments for a visible circular cross-section (pipes, hubs, nozzles). */
export function segmentsFromRadius(
  radius: number,
  options: SegmentsFromRadiusOptions = {},
): number {
  assertDimension('segmentsFromRadius radius', radius);
  const min = options.min ?? DEFAULT_MIN_SEGMENTS;
  const max = options.max ?? DEFAULT_MAX_SEGMENTS;
  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min < 3 ||
    max < min ||
    max > GEOMETRY_ALLOCATION_LIMITS.primitiveSegments
  )
    throw new RangeError(
      `segmentsFromRadius min/max must be integers with 3 <= min <= max <= ${GEOMETRY_ALLOCATION_LIMITS.primitiveSegments}.`,
    );
  const maxChord = options.maxChordLength ?? 0.01;
  assertDimension('segmentsFromRadius maxChordLength', maxChord);
  const segments = Math.ceil((Math.PI * radius) / maxChord);
  return Math.min(max, Math.max(min, segments));
}
