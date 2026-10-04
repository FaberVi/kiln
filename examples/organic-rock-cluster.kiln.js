// Authored by: cloud-agent (FaberVi/kiln organic showcase).

const meta = { name: 'RockCluster', category: 'prop', role: 'prop' };

function build() {
  const root = createRoot('RockCluster');
  const stone = gameMaterial(0x6a6660, { roughness: 0.95 });

  const rocks = [
    { pos: [0, 0.06, 0], half: [0.16, 0.11, 0.14], seed: 3, bury: 0.42 },
    { pos: [0.1, 0.045, 0.05], half: [0.1, 0.075, 0.09], seed: 7, bury: 0.38 },
    { pos: [-0.1, 0.04, -0.045], half: [0.11, 0.07, 0.1], seed: 11, bury: 0.4 },
    { pos: [-0.035, 0.032, 0.075], half: [0.07, 0.055, 0.065], seed: 19, bury: 0.35 },
    { pos: [0.075, 0.028, -0.085], half: [0.065, 0.05, 0.07], seed: 23, bury: 0.36 },
  ];
  const parts = [];
  for (let i = 0; i < rocks.length; i++) {
    const r = rocks[i];
    const geo = rockBoulder({
      halfExtents: r.half,
      seed: r.seed,
      detail: i === 0 ? 2 : 1,
      voronoiCells: 12 + i,
      facetingAngle: 20,
    });
    const hy = r.half[1];
    parts.push(
      createPart(`Rock_${i}`, geo, stone, {
        position: [r.pos[0], r.pos[1] + hy * (1 - r.bury * 2), r.pos[2]],
        rotation: [0, (r.seed % 7) * 11, (r.seed % 5) * 9],
        parent: root,
      }),
    );
  }
  for (let i = 1; i < parts.length; i++) snapTo(parts[i], parts[0]);
  return root;
}
