// Benchmark (after): organic helpers — same brief as before/stylised-newt.kiln.js
// Authored by: cloud-agent, organic benchmark, after lane.

const meta = { name: 'StylisedNewt', category: 'prop', role: 'prop' };

async function build() {
  const root = createRoot('StylisedNewt');
  const skin = gameMaterial(0x3d6b4f, { roughness: 0.72 });
  const belly = gameMaterial(0x8a9a6b, { roughness: 0.8 });

  const bodyGeo = await metaballSurface(
    [
      { center: [0.05, 0.06, 0], radius: 0.1 },
      { center: [0.22, 0.065, 0], radius: 0.11 },
      { center: [0.38, 0.07, 0], radius: 0.095 },
      { center: [0.46, 0.06, 0], radius: 0.055 },
    ],
    {
      bounds: { min: [-0.08, -0.02, -0.14], max: [0.52, 0.16, 0.14] },
      edgeLength: 0.045,
      blend: 0.08,
    },
  );
  createPart('Body', smoothOrganic(bodyGeo, { iterations: 1, creaseAngle: 48 }), skin, { parent: root });

  const tailPath = catmullRomPath(
    [[0.02, 0.06, 0], [-0.08, 0.07, 0], [-0.18, 0.095, 0.01], [-0.3, 0.11, 0.02], [-0.36, 0.1, 0.03]],
    6,
  );
  const tailRadii = tailPath.map((_, i, a) => 0.04 * (1 - i / (a.length - 1)) + 0.012);
  createPart(
    'Tail',
    smoothOrganic(taperedTube(tailPath, tailRadii, { radialSegments: 16 }), { iterations: 1 }),
    skin,
    { parent: root },
  );

  const legPath = (x, z) => catmullRomPath([[x, 0.05, z], [x - 0.02, 0.02, z], [x - 0.03, 0.01, z]], 4);
  for (const [name, x, z] of [
    ['Leg_FL', 0.28, 0.05],
    ['Leg_FR', 0.28, -0.05],
    ['Leg_BL', 0.12, 0.055],
    ['Leg_BR', 0.12, -0.055],
  ]) {
    const p = legPath(x, z);
    const r = p.map((_, i, arr) => 0.022 * (1 - i / (arr.length - 1)) + 0.012);
    createPart(name, taperedTube(p, r, { radialSegments: 12 }), skin, { parent: root });
  }

  createPart('Belly', sphereGeo(0.07, 16, 12), belly, {
    position: [0.24, 0.035, 0],
    scale: [1.3, 0.3, 1],
    parent: root,
  });

  return root;
}
