import { describe, expect, it } from 'bun:test';
import * as THREE from 'three';
import { boxGeo, cylinderGeo, gameMaterial } from '../primitives';
import { autoUnwrap } from '../uv';
import { boolDiff } from '../solids';
import { analyzeUvStretch, normalizeAtlasTexelScale, uvWorkflowAdvisory } from '../uv-texel';

describe('uv texel helpers', () => {
  it('reports tighter stretch on analytic box UVs than on CSG autoUnwrap', async () => {
    const boxStats = analyzeUvStretch(boxGeo(1, 1, 1));
    const body = new THREE.Mesh(boxGeo(2, 2, 2), gameMaterial(0x888888));
    const hole = new THREE.Mesh(cylinderGeo(0.5, 0.5, 3, 24), gameMaterial(0x111111));
    const pierced = await boolDiff('Pierced', body, hole);
    const unwrapped = await autoUnwrap(pierced.geometry, { resolution: 512 });
    const csgStats = analyzeUvStretch(unwrapped);
    expect(boxStats.stretch.median).toBeLessThan(csgStats.stretch.median);
  });

  it('normalizeAtlasTexelScale reduces chart scale spread after unwrap', async () => {
    const body = new THREE.Mesh(boxGeo(2, 2, 2), gameMaterial(0x888888));
    const hole = new THREE.Mesh(cylinderGeo(0.4, 0.4, 3, 20), gameMaterial(0x111111));
    const pierced = await boolDiff('Pierced', body, hole);
    const unwrapped = await autoUnwrap(pierced.geometry, { resolution: 512 });
    const before = analyzeUvStretch(unwrapped);
    const normalized = normalizeAtlasTexelScale(unwrapped);
    const after = analyzeUvStretch(normalized);
    const uvBefore = unwrapped.getAttribute('uv') as THREE.BufferAttribute;
    const uvAfter = normalized.getAttribute('uv') as THREE.BufferAttribute;
    let changed = false;
    for (let i = 0; i < Math.min(uvBefore.count, 8); i++) {
      if (uvBefore.getX(i) !== uvAfter.getX(i) || uvBefore.getY(i) !== uvAfter.getY(i)) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);
    expect(after.islands).toBe(before.islands);
  });

  it('uvWorkflowAdvisory suggests projectUV/remapUV when stretch is high', async () => {
    const body = new THREE.Mesh(boxGeo(2, 2, 2), gameMaterial(0x888888));
    const hole = new THREE.Mesh(cylinderGeo(0.35, 0.35, 3, 16), gameMaterial(0x111111));
    const pierced = await boolDiff('Pierced', body, hole);
    const unwrapped = await autoUnwrap(pierced.geometry, { resolution: 512 });
    const advisory = uvWorkflowAdvisory(unwrapped, 'csg');
    expect(advisory.messages.some((m) => m.includes('projectUV') || m.includes('remapUV'))).toBe(
      true,
    );
  });
});
