// Benchmark (after): organic helpers.
// Authored by: cloud-agent, organic benchmark, after lane.

const meta = { name: 'Jellyfish', category: 'prop', role: 'prop' };

async function build() {
  const root = createRoot('Jellyfish');
  const bellMat = gameMaterial(0xc8b8ff, { roughness: 0.35, metalness: 0.05 });
  const tentMat = gameMaterial(0xe8e0ff, { roughness: 0.5 });

  const bell = await metaballSurface(
    [
      { center: [0, 0.42, 0], radius: 0.12 },
      { center: [0, 0.38, 0], radius: 0.1 },
    ],
    {
      bounds: { min: [-0.16, 0.24, -0.16], max: [0.16, 0.5, 0.16] },
      edgeLength: 0.04,
      blend: 0.06,
    },
  );
  createPart('Bell', smoothOrganic(bell, { iterations: 1 }), bellMat, { parent: root });

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 0.08;
    const z = Math.sin(a) * 0.08;
    const path = catmullRomPath(
      [[x, 0.36, z], [x * 1.15, 0.28, z * 1.15], [x * 1.05, 0.18, z * 1.05], [x * 0.85, 0.1, z * 0.85]],
      5,
    );
    const radii = path.map((_, j, arr) => 0.012 * (1 - j / (arr.length - 1)) + 0.004);
    createPart(`Tentacle_${i}`, taperedTube(path, radii, { radialSegments: 10 }), tentMat, { parent: root });
  }
  return root;
}
