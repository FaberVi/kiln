// Authored by: cloud-agent (FaberVi/kiln organic showcase).

const meta = { name: 'RockCluster', category: 'prop', role: 'prop' };

function build() {
  const root = createRoot('RockCluster');
  const stone = gameMaterial(0x6a6660, { roughness: 0.95 });

  const rocks = [
    { pos: [0, 0.11, 0], scale: [0.34, 0.26, 0.3], seed: 3, base: 0.22 },
    { pos: [0.09, 0.09, 0.04], scale: [0.2, 0.16, 0.18], seed: 7, base: 0.14 },
    { pos: [-0.09, 0.08, -0.04], scale: [0.18, 0.14, 0.2], seed: 11, base: 0.12 },
    { pos: [-0.03, 0.06, 0.07], scale: [0.12, 0.1, 0.11], seed: 19, base: 0.09 },
    { pos: [0.06, 0.05, -0.08], scale: [0.11, 0.09, 0.1], seed: 23, base: 0.08 },
  ];
  const parts = [];
  for (let i = 0; i < rocks.length; i++) {
    const r = rocks[i];
    const base = sphereGeo(r.base, 20, 14);
    const rough = rockDisplace(base, {
      seed: r.seed,
      amplitude: 0.013 * r.base,
      frequency: 0.75,
      octaves: 2,
      facetingAngle: 30,
    });
    const sy = r.scale[1];
    parts.push(
      createPart(`Rock_${i}`, rough, stone, {
        position: [r.pos[0], r.pos[1] - 0.2 * sy + 0.02, r.pos[2]],
        scale: r.scale,
        parent: root,
      }),
    );
  }
  for (let i = 1; i < parts.length; i++) snapTo(parts[i], parts[0]);
  return root;
}
