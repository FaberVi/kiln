import { describe, expect, it } from 'bun:test';

if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class ProgressEvent extends Event {
    lengthComputable = false;
    loaded = 0;
    total = 0;
    constructor(type: string, init: ProgressEventInit = {}) {
      super(type);
      this.lengthComputable = init.lengthComputable ?? false;
      this.loaded = init.loaded ?? 0;
      this.total = init.total ?? 0;
    }
  } as typeof ProgressEvent;
}
import { readFileSync } from 'node:fs';
import { compressGlbBytes } from '../glb-compress';
import { renderSceneToGLB } from '../render';
import { createRoot, boxGeo, gameMaterial } from '../primitives';
import { createGLTFLoader } from './gltf-loader';
import { countTriangles } from './lod';
import * as THREE from 'three';

describe('viewer GLTFLoader decoders', () => {
  it('loads uncompressed GLBs unchanged', async () => {
    const root = createRoot('Block');
    root.add(new THREE.Mesh(boxGeo(1, 1, 1), gameMaterial(0x888888)));
    const plain = await renderSceneToGLB(root, { optimize: 'off' });
    const loader = await createGLTFLoader();
    const gltf = await loader.parseAsync(Uint8Array.from(plain.bytes).buffer, '');
    expect(countTriangles(gltf.scene)).toBe(12);
  });

  it('loads meshopt-compressed GLBs from the export path', async () => {
    const well = new Uint8Array(readFileSync('examples/well.glb'));
    const meshopt = await compressGlbBytes(well, 'meshopt');
    expect(meshopt?.mode).toBe('meshopt');
    const loader = await createGLTFLoader();
    const baseline = await loader.parseAsync(Uint8Array.from(well).buffer, '');
    const compressed = await loader.parseAsync(Uint8Array.from(meshopt!.bytes).buffer, '');
    expect(countTriangles(compressed.scene)).toBe(countTriangles(baseline.scene));
  });

  it('loads Draco-compressed GLBs from the export path', async () => {
    const well = new Uint8Array(readFileSync('examples/well.glb'));
    const draco = await compressGlbBytes(well, 'draco');
    expect(draco?.mode).toBe('draco');
    const loader = await createGLTFLoader();
    const gltf = await loader.parseAsync(Uint8Array.from(draco!.bytes).buffer, '');
    expect(countTriangles(gltf.scene)).toBeGreaterThan(100);
  });
});
