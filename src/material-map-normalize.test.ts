import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';
import {
  MATERIAL_LIBRARY_LIMITS,
  materialPngDimensions,
  materialLibraryPortableSpec,
} from './material-library';
import { createMaterialLibraryPayload, createMaterialRecordV1 } from './material-library-node';
import {
  isNormalizedPngWithinEdgeLimit,
  normalizeMaterialMapBytes,
} from './material-map-normalize';
import { renderGLBInProcess } from './render';

describe('material map normalization', () => {
  test('JPEG and oversized inputs become PNG within the edge budget', async () => {
    const jpeg = new Uint8Array(
      await sharp({
        create: { width: 5000, height: 3000, channels: 3, background: '#336699' },
      })
        .jpeg()
        .toBuffer(),
    );
    expect(isNormalizedPngWithinEdgeLimit(jpeg)).toBe(false);
    const normalized = await normalizeMaterialMapBytes(jpeg, 'baseColor');
    const { width, height } = materialPngDimensions(normalized);
    expect(width).toBeLessThanOrEqual(MATERIAL_LIBRARY_LIMITS.maxMapEdge);
    expect(height).toBeLessThanOrEqual(MATERIAL_LIBRARY_LIMITS.maxMapEdge);
    expect(normalized[0]).toBe(137);
  });

  test('imported textured GLB passes render-service self-contained PNG admission', async () => {
    const jpeg = new Uint8Array(
      await sharp({
        create: { width: 64, height: 64, channels: 3, background: '#aabbcc' },
      })
        .jpeg()
        .toBuffer(),
    );
    const digest = `sha256:${createHash('sha256').update(jpeg).digest('hex')}`;
    const record = await createMaterialRecordV1({
      materialId: 'imported-jpeg',
      name: 'Imported JPEG',
      tileable: true,
      sources: [
        {
          id: 'ambient',
          kind: 'external',
          provider: 'Test',
          creator: 'Test',
          assetUrl: 'https://example.com/material',
          license: {
            spdx: 'CC0-1.0',
            url: 'https://creativecommons.org/publicdomain/zero/1.0/',
            attribution: '',
          },
          originalFiles: [{ name: 'color.jpg', sha256: digest, bytes: jpeg.length }],
        },
      ],
      maps: [
        {
          slot: 'baseColor',
          sourceId: 'ambient',
          originalFile: 'color.jpg',
          bytes: jpeg,
          transforms: [],
        },
      ],
    });
    expect(materialPngDimensions(record.files['baseColor.png']!).width).toBe(64);
    const materialResources = await createMaterialLibraryPayload([record]);
    const code = `const meta = { name: 'Textured box', category: 'prop' };
      async function build() { const root = createRoot('Root');
        const material = await compilePortableMaterialSpecV2(${JSON.stringify(
          materialLibraryPortableSpec(record.manifest),
        )});
        createPart('Box', boxGeo(1, 1, 1), material, { parent: root }); return root; }`;
    const glb = await renderGLBInProcess(code, { materialResources, optimize: 'off' });
    const { validateSelfContainedGlb } = await import('../render-service/src/glb-input.mjs');
    expect(validateSelfContainedGlb(Buffer.from(glb.glb)).imagePixels).toBeGreaterThan(0);
  });
});
