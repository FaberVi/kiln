import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRoot, createPart, createPivot, boxGeo, gameMaterial } from '../primitives';
import { renderGLBInProcess, renderSceneToGLB } from '../render';
import { shouldRunRigidMerge, RIGID_MERGE_MIN_TRIANGLES } from '../optimize-gate';
import { hue } from './optimize.test';

describe('shouldRunRigidMerge', () => {
  it('skips below the triangle threshold', () => {
    expect(shouldRunRigidMerge({ triangles: 100, uniqueMaterials: 4, drawCalls: 10 }).run).toBe(
      false,
    );
    expect(
      shouldRunRigidMerge({
        triangles: RIGID_MERGE_MIN_TRIANGLES,
        uniqueMaterials: 2,
        drawCalls: 8,
      }).run,
    ).toBe(true);
  });
});

describe('optimize=full size gate', () => {
  it('skips rigid merge on the small crate example (palette may still run)', async () => {
    const code = readFileSync('examples/crate.kiln.js', 'utf8');
    const off = await renderGLBInProcess(code, { optimize: 'off', instance: 'off' });
    const full = await renderGLBInProcess(code, { optimize: 'full', instance: 'off' });
    expect(full.meta.optimize?.rigidMergeGate?.run).toBe(false);
    expect(full.glb.byteLength).toBeLessThan(off.glb.byteLength * 2.2);
  });

  it('still rigid-merges a large multi-part asset', async () => {
    const root = createRoot('Yard');
    const material = gameMaterial(0x888888);
    const count = Math.ceil(RIGID_MERGE_MIN_TRIANGLES / 12) + 4;
    for (let i = 0; i < count; i++) {
      createPart(`Slab${i}`, boxGeo(1, 0.2, 1), material, {
        position: [(i % 10) * 1.1, 0, Math.floor(i / 10) * 1.1],
        parent: root,
      });
    }
    const after = await renderSceneToGLB(root, { optimize: 'full' });
    expect(after.optimize?.rigidMergeGate).toBeUndefined();
    expect(after.optimize?.rigidMerge).toBeDefined();
    expect(after.optimize!.drawsAfter).toBeLessThan(after.optimize!.drawsBefore);
  });

  it('preserves joint boundaries when merge runs', async () => {
    const root = createRoot('Spinner');
    const hub = createPivot('Spin', [0, 1, 0], root);
    const n = Math.ceil(RIGID_MERGE_MIN_TRIANGLES / 12) + 2;
    for (let i = 0; i < n; i++) {
      createPart(`Blade${i}`, boxGeo(0.2, 0.05, 1.2), gameMaterial(hue(i, n)), {
        position: [0, 0, 0],
        parent: hub,
      });
    }
    const after = await renderSceneToGLB(root, { optimize: 'full' });
    expect(after.optimize?.rigidMerge).toBeDefined();
    expect(after.optimize!.drawsAfter).toBeLessThan(after.optimize!.drawsBefore);
  });
});
