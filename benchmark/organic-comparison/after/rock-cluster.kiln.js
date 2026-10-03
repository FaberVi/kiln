// Benchmark (after): organic helpers.
// Authored by: cloud-agent, organic benchmark, after lane.

const meta = { name: 'RockCluster', category: 'prop', role: 'prop' };

function build() {
  const root = createRoot('RockCluster');
  const stone = gameMaterial(0x6a6660, { roughness: 0.95 });

  const rocks = [
    { pos: [0, 0.14, 0], scale: [0.32, 0.28, 0.3], seed: 3 },
    { pos: [0.12, 0.11, 0.06], scale: [0.22, 0.18, 0.2], seed: 7 },
    { pos: [-0.12, 0.1, -0.06], scale: [0.2, 0.16, 0.22], seed: 11 },
  ];
  for (let i = 0; i < rocks.length; i++) {
    const r = rocks[i];
    const base = sphereGeo(0.2, 28, 20);
    const rough = rockDisplace(base, { amplitude: 0.035, frequency: 4.2, octaves: 4, seed: r.seed });
    createPart(`Rock_${i}`, rough, stone, {
      position: r.pos,
      scale: r.scale,
      parent: root,
    });
  }
  return root;
}
