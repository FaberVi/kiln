import { describe, expect, test } from 'bun:test';
import { geometryDiagnostics } from '../geometry';
import { catmullRomPath, rockBoulder, rockDisplace, smoothOrganic, taperedTube } from '../organic';
import { countTriangles, createPart, createRoot, gameMaterial, sphereGeo } from '../primitives';

describe('organic helpers', () => {
  test('catmullRomPath returns more points than controls', () => {
    const path = catmullRomPath(
      [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
      ],
      4,
    );
    expect(path.length).toBeGreaterThan(4);
    expect(path[0]).toEqual([0, 0, 0]);
  });

  test('taperedTube produces closed tube geometry with smooth shading default', () => {
    const path = catmullRomPath(
      [
        [0, 0, 0],
        [0, 0.5, 0],
        [0.2, 1, 0],
      ],
      6,
    );
    const radii = path.map((_, i, arr) => 0.06 * (1 - i / (arr.length - 1)) + 0.02);
    const geo = taperedTube(path, radii);
    const diag = geometryDiagnostics(geo);
    expect(diag.triangles).toBeGreaterThan(100);
    expect(diag.degenerateTriangles).toBe(0);
  });

  test('smoothOrganic increases triangle count', () => {
    const base = taperedTube(
      [
        [0, 0, 0],
        [0, 0.4, 0],
      ],
      [0.05, 0.03],
      { radialSegments: 12 },
    );
    const smooth = smoothOrganic(base, { iterations: 1 });
    expect(smooth.getAttribute('position')!.count).toBeGreaterThan(
      base.getAttribute('position')!.count,
    );
  });

  test('rockBoulder produces faceted angular mesh', () => {
    const geo = rockBoulder({ halfExtents: [0.1, 0.08, 0.09], seed: 9, detail: 1 });
    const diag = geometryDiagnostics(geo);
    expect(diag.triangles).toBeGreaterThan(40);
    expect(diag.degenerateTriangles).toBe(0);
  });

  test('rockDisplace changes positions on a sphere', () => {
    const geo = sphereGeo(0.3, 24, 16);
    const pos = geo.getAttribute('position')!.array.slice();
    const rough = rockDisplace(geo, { amplitude: 0.02, seed: 2 });
    const next = rough.getAttribute('position')!.array;
    let changed = false;
    for (let i = 0; i < pos.length; i++) {
      if (Math.abs(pos[i]! - next[i]!) > 1e-6) changed = true;
    }
    expect(changed).toBe(true);
  });

  test('organic creature root builds with QA-friendly triangle budget', async () => {
    const root = createRoot('OrganicProbe');
    const mat = gameMaterial(0x6a8f5a);
    const bodyPath = catmullRomPath(
      [
        [0, 0.15, 0],
        [0.25, 0.22, 0],
        [0.45, 0.18, 0],
        [0.55, 0.1, 0],
      ],
      5,
    );
    const radii = bodyPath.map((_, i, a) => 0.12 - (i / (a.length - 1)) * 0.05);
    createPart('Body', smoothOrganic(taperedTube(bodyPath, radii)), mat, { parent: root });
    expect(countTriangles(root)).toBeGreaterThan(200);
  });
});
