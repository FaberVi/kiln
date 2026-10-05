import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { WebIO } from '@gltf-transform/core';
import { createGltfIO } from '../gltf-io';
import { createRoot, boxGeo, gameMaterial } from '../primitives';
import { compressGlbBytes } from '../glb-compress';
import { renderSceneToGLB } from '../render';

describe('optional GLB compression', () => {
  it('default bake path stays uncompressed', async () => {
    const root = createRoot('Plain');
    const mesh = new THREE.Mesh(boxGeo(2, 2, 2), gameMaterial(0x888888));
    mesh.name = 'Mesh_Block';
    root.add(mesh);
    const baked = await renderSceneToGLB(root, { optimize: 'off' });
    const json = (await new WebIO().readBinary(baked.bytes)).getRoot().listExtensionsUsed();
    expect(json.map((e) => e.extensionName)).not.toContain('EXT_meshopt_compression');
    expect(baked.compression).toBeUndefined();
  });

  it('meshopt shrinks a textured GLB and marks the extension', async () => {
    const plain = new Uint8Array(readFileSync('examples/well.glb'));
    const compressed = await compressGlbBytes(plain, 'meshopt');
    expect(compressed?.mode).toBe('meshopt');
    expect(compressed!.bytesAfter).toBeLessThan(compressed!.bytesBefore);
    const json = (await createGltfIO().binaryToJSON(compressed!.bytes)).json;
    expect(json.extensionsUsed).toContain('EXT_meshopt_compression');
  });

  it('compressGlbBytes returns undefined for off mode and for no-op meshopt', async () => {
    expect(await compressGlbBytes(new Uint8Array(0), 'off')).toBeUndefined();
    const tiny = await renderSceneToGLB(
      (() => {
        const root = createRoot('Tiny');
        root.add(new THREE.Mesh(boxGeo(1, 1, 1), gameMaterial(0x888888)));
        return root;
      })(),
      { optimize: 'off' },
    );
    expect(await compressGlbBytes(tiny.bytes, 'meshopt')).toBeUndefined();
  });
});
