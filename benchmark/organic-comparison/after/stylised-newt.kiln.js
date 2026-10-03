// Benchmark (after): organic helpers — same brief as before/stylised-newt.kiln.js
// Authored by: cloud-agent, organic benchmark, after lane.

const meta = { name: 'StylisedNewt', category: 'prop', role: 'prop' };

async function build() {
  const root = createRoot('StylisedNewt');
  const skin = gameMaterial(0x3d6b4f, { roughness: 0.72 });
  const belly = gameMaterial(0x8a9a6b, { roughness: 0.8 });
  const eye = gameMaterial(0x1a1a1a, { roughness: 0.3 });

  const bodyGeo = await metaballSurface(
    [
      { center: [0.08, 0.06, 0], radius: 0.095 },
      { center: [0.24, 0.065, 0], radius: 0.105 },
      { center: [0.36, 0.068, 0], radius: 0.082 },
      { center: [0.44, 0.072, 0], radius: 0.062 },
    ],
    {
      bounds: { min: [-0.05, -0.02, -0.14], max: [0.5, 0.14, 0.14] },
      edgeLength: 0.04,
      blend: 0.078,
    },
  );
  createPart('Torso', creaseNormals(bodyGeo, { angle: 50 }), skin, { parent: root });

  createPart('Eye_L', sphereGeo(0.014, 12, 10), eye, { position: [0.44, 0.088, 0.038], parent: root });
  createPart('Eye_R', sphereGeo(0.014, 12, 10), eye, { position: [0.44, 0.088, -0.038], parent: root });

  const tailCtrl = [
    [0.02, 0.062, 0],
    [-0.05, 0.068, 0],
    [-0.14, 0.078, 0.012],
    [-0.24, 0.082, 0.018],
    [-0.33, 0.072, 0.022],
  ];
  const tailPath = catmullRomPath(tailCtrl, 10);
  const tailProfile = [[0, 0], [0.082, 0], [0, 0.034], [-0.082, 0]];
  const tailSections = tailPath.map((origin, i, a) => {
    const t = i / (a.length - 1);
    const s = 1 - t * 0.48;
    return {
      profile: tailProfile.map(([x, z]) => [x * s, z * s]),
      frame: { origin, rotation: [0, 0, 0] },
    };
  });
  createPart('Tail', creaseNormals(loftProfiles(tailSections, { cap: true }), { angle: 52 }), skin, {
    parent: root,
  });

  function leg(name, hipX, hipZ, side) {
    const path = catmullRomPath(
      [
        [hipX, 0.048, hipZ],
        [hipX - 0.018, 0.028, hipZ + side * 0.028],
        [hipX - 0.028, 0.014, hipZ + side * 0.038],
        [hipX - 0.032, 0.006, hipZ + side * 0.042],
      ],
      8,
    );
    const radii = path.map((_, i, arr) => {
      const t = i / (arr.length - 1);
      if (t > 0.78) return 0.024;
      return 0.022 * (1 - t * 0.2) + 0.011;
    });
    createPart(name, creaseNormals(taperedTube(path, radii, { radialSegments: 16 }), { angle: 42 }), skin, {
      parent: root,
    });
  }

  leg('Leg_FL', 0.3, 0.052, 1);
  leg('Leg_FR', 0.3, -0.052, -1);
  leg('Leg_BL', 0.13, 0.056, 1);
  leg('Leg_BR', 0.13, -0.056, -1);

  createPart('Belly', sphereGeo(0.075, 16, 12), belly, {
    position: [0.24, 0.03, 0],
    scale: [1.4, 0.3, 1.08],
    parent: root,
  });

  return root;
}
