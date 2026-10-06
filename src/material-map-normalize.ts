/** Normalize host-supplied map bytes for the material library and GPU GLB admission. */
import sharp from 'sharp';
import {
  MATERIAL_LIBRARY_LIMITS,
  materialPngDimensions,
  type MaterialLibrarySlot,
} from './material-library';

const SRGB_SLOTS = new Set<MaterialLibrarySlot>(['baseColor', 'emissive']);

export function isNormalizedPngWithinEdgeLimit(bytes: Uint8Array): boolean {
  try {
    const { width, height } = materialPngDimensions(bytes);
    return (
      width >= 1 &&
      height >= 1 &&
      width <= MATERIAL_LIBRARY_LIMITS.maxMapEdge &&
      height <= MATERIAL_LIBRARY_LIMITS.maxMapEdge
    );
  } catch {
    return false;
  }
}

/**
 * Decode JPEG/WebP/PNG, downscale to the library edge budget, and emit PNG bytes.
 * sRGB slots keep display encoding; data maps stay linear through the sharp pipeline.
 */
export async function normalizeMaterialMapBytes(
  bytes: Uint8Array,
  slot: MaterialLibrarySlot,
): Promise<Uint8Array> {
  if (isNormalizedPngWithinEdgeLimit(bytes)) return Uint8Array.from(bytes);

  const maxEdge = MATERIAL_LIBRARY_LIMITS.maxMapEdge;
  let pipeline = sharp(Buffer.from(bytes), {
    // Host files may exceed the stored record budget until downscaled.
    limitInputPixels: false,
    failOn: 'warning',
  })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });

  pipeline = pipeline.ensureAlpha();
  if (!SRGB_SLOTS.has(slot)) pipeline = pipeline.linear();

  let out = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  let normalized = Uint8Array.from(out);
  let dimensions = materialPngDimensions(normalized);
  const pixelBudget = MATERIAL_LIBRARY_LIMITS.maxRecordPixels;
  if (dimensions.width * dimensions.height > pixelBudget) {
    const scale = Math.sqrt(pixelBudget / (dimensions.width * dimensions.height));
    out = await sharp(out)
      .resize({
        width: Math.max(1, Math.floor(dimensions.width * scale)),
        height: Math.max(1, Math.floor(dimensions.height * scale)),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toBuffer();
    normalized = Uint8Array.from(out);
    dimensions = materialPngDimensions(normalized);
  }
  if (
    dimensions.width > maxEdge ||
    dimensions.height > maxEdge ||
    dimensions.width * dimensions.height > pixelBudget
  ) {
    throw new Error('Material map exceeds pixel budget after normalization');
  }
  return normalized;
}
