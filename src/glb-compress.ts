/**
 * Optional post-export GLB compression (off by default).
 *
 * Meshopt (`EXT_meshopt_compression`) is the default when enabled: broad three.js
 * support with the meshoptimizer decoder. Draco (`KHR_draco_mesh_compression`) shrinks
 * further; the kiln viewer, site R3F preview, and render-service GPU path decode both
 * extensions when `compress` is enabled. Gallery-shipped GLBs remain plain by policy.
 */
import type { Document } from '@gltf-transform/core';
import { draco, meshopt, quantize } from '@gltf-transform/functions';
import { createGltfIO } from './gltf-io';
import { assertFinalGlbValid } from './qa/gltf';

export type GlbCompressMode = 'off' | 'meshopt' | 'draco';

export interface CompressGlbResult {
  bytes: Uint8Array;
  mode: Exclude<GlbCompressMode, 'off'>;
  bytesBefore: number;
  bytesAfter: number;
}

async function ioWithDracoEncoder() {
  const draco3d = await import('draco3dgltf');
  const encoder = await draco3d.createEncoderModule();
  return createGltfIO().registerDependencies({ 'draco3d.encoder': encoder });
}

/**
 * Compress finished GLB bytes. Returns undefined when mode is `off` or compression
 * does not shrink the payload (caller keeps the original bytes).
 */
export async function compressGlbBytes(
  bytes: Uint8Array,
  mode: GlbCompressMode = 'off',
): Promise<CompressGlbResult | undefined> {
  if (mode === 'off') return undefined;
  const bytesBefore = bytes.byteLength;
  let doc: Document;
  if (mode === 'meshopt') {
    const { MeshoptEncoder } = await import('meshoptimizer');
    await MeshoptEncoder.ready;
    const io = createGltfIO().registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
    doc = await io.readBinary(bytes);
    await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const out = await io.writeBinary(doc);
    await assertFinalGlbValid(out);
    const marked = doc
      .getRoot()
      .listExtensionsUsed()
      .some((ext) => ext.extensionName === 'EXT_meshopt_compression');
    if (!marked || out.byteLength >= bytesBefore) return undefined;
    return { bytes: out, mode: 'meshopt', bytesBefore, bytesAfter: out.byteLength };
  }

  const io = await ioWithDracoEncoder();
  doc = await io.readBinary(bytes);
  await doc.transform(draco({ method: 'edgebreaker' }));
  const out = await io.writeBinary(doc);
  await assertFinalGlbValid(out);
  const marked = doc
    .getRoot()
    .listExtensionsUsed()
    .some((ext) => ext.extensionName === 'KHR_draco_mesh_compression');
  if (!marked || out.byteLength >= bytesBefore) return undefined;
  return { bytes: out, mode: 'draco', bytesBefore, bytesAfter: out.byteLength };
}
