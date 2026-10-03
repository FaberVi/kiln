// Benchmark (after): organic helpers.
// Authored by: cloud-agent, organic benchmark, after lane.

const meta = { name: 'Seahorse', category: 'prop', role: 'prop' };

async function build() {
  const root = createRoot('Seahorse');
  const bodyMat = gameMaterial(0xd4a04a, { roughness: 0.55 });
  const finMat = gameMaterial(0xe8c878, { roughness: 0.6 });

  const spinePath = catmullRomPath(
    [[0, 0.05, 0], [0.02, 0.18, 0], [0.05, 0.3, 0], [0.03, 0.4, 0], [-0.02, 0.48, 0]],
    8,
  );
  const spineR = spinePath.map((_, i, a) => 0.045 * (1 - i / (a.length - 1) * 0.35) + 0.018);
  createPart(
    'Body',
    smoothOrganic(taperedTube(spinePath, spineR, { radialSegments: 18 }), { iterations: 1 }),
    bodyMat,
    { parent: root },
  );

  const head = await metaballSurface(
    [
      { center: [0.04, 0.46, 0], radius: 0.055 },
      { center: [0.09, 0.47, 0], radius: 0.028 },
    ],
    {
      bounds: { min: [-0.02, 0.38, -0.08], max: [0.14, 0.52, 0.08] },
      edgeLength: 0.025,
      blend: 0.035,
    },
  );
  createPart('Head', smoothOrganic(head, { iterations: 1 }), bodyMat, { parent: root });

  createPart('DorsalFin', boxGeo(0.02, 0.1, 0.05), finMat, {
    position: [-0.05, 0.32, 0],
    rotation: [0, 0, 22],
    parent: root,
  });
  return root;
}
