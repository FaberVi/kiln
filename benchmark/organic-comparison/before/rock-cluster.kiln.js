// Benchmark (before): legacy primitives only.
// Authored by: cloud-agent, organic benchmark, before lane.

const meta = { name: 'RockCluster', category: 'prop', role: 'prop' };

function build() {
  const root = createRoot('RockCluster');
  const stone = gameMaterial(0x6a6660, { roughness: 0.95 });

  const rocks = [
    { pos: [0, 0.14, 0], scale: [0.32, 0.28, 0.3] },
    { pos: [0.22, 0.1, 0.12], scale: [0.22, 0.18, 0.2] },
    { pos: [-0.18, 0.08, -0.1], scale: [0.2, 0.16, 0.22] },
  ];
  for (let i = 0; i < rocks.length; i++) {
    const r = rocks[i];
    createPart(`Rock_${i}`, sphereGeo(0.2, 10, 8), stone, {
      position: r.pos,
      scale: r.scale,
      parent: root,
    });
  }
  return root;
}
