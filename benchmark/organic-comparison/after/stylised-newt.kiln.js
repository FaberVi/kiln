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
      { center: [0.06, 0.058, 0], radius: 0.09 },
      { center: [0.22, 0.064, 0], radius: 0.102 },
      { center: [0.36, 0.066, 0], radius: 0.095 },
      { center: [0.46, 0.068, 0], radius: 0.052 },
      { center: [0.5, 0.072, 0], radius: 0.078 },
      { center: [0.54, 0.07, 0], radius: 0.048 },
    ],
    {
      bounds: { min: [-0.06, -0.02, -0.15], max: [0.58, 0.14, 0.15] },
      edgeLength: 0.038,
      blend: 0.068,
    },
  );
  createPart('Torso', creaseNormals(bodyGeo, { angle: 50 }), skin, { parent: root });

  createPart('Eye_L', sphereGeo(0.015, 12, 10), eye, { position: [0.52, 0.09, 0.04], parent: root });
  createPart('Eye_R', sphereGeo(0.015, 12, 10), eye, { position: [0.52, 0.09, -0.04], parent: root });

  const tailCtrl = [
    [0.05, 0.062, 0],
    [-0.02, 0.066, 0],
    [-0.12, 0.072, 0.01],
    [-0.22, 0.076, 0.016],
    [-0.32, 0.07, 0.02],
    [-0.4, 0.062, 0.022],
  ];
  const tailPath = catmullRomPath(tailCtrl, 12);
  const tailProfile = [[0, 0], [0.095, 0], [0, 0.042], [-0.095, 0]];
  const tailSections = tailPath.map((origin, i, a) => {
    const t = i / (a.length - 1);
    const s = 1 - t * 0.72;
    const flat = 1 - t * 0.15;
    return {
      profile: tailProfile.map(([x, z]) => [x * s, z * s * flat]),
      frame: { origin, rotation: [0, 0, 0] },
    };
  });
  createPart('Tail', creaseNormals(loftProfiles(tailSections, { cap: true }), { angle: 52 }), skin, {
    parent: root,
  });

  function salamanderLeg(name, hipX, hipZ, side) {
    const hip = [hipX, 0.052, hipZ];
    const elbow = [hipX - 0.012, 0.034, hipZ + side * 0.042];
    const knee = [hipX - 0.022, 0.018, hipZ + side * 0.055];
    const ankle = [hipX - 0.028, 0.01, hipZ + side * 0.062];
    const foot = [hipX - 0.03, 0.006, hipZ + side * 0.068];

    const upperPath = catmullRomPath([hip, elbow, knee], 8);
    const upperR = upperPath.map((_, i, arr) => 0.02 * (1 - i / (arr.length - 1) * 0.15) + 0.014);
    createPart(
      `${name}_Upper`,
      creaseNormals(taperedTube(upperPath, upperR, { radialSegments: 14 }), { angle: 42 }),
      skin,
      { parent: root },
    );

    const lowerPath = catmullRomPath([knee, ankle, foot], 8);
    const lowerR = lowerPath.map((_, i, arr) => 0.016 * (1 - i / (arr.length - 1) * 0.35) + 0.009);
    createPart(
      `${name}_Lower`,
      creaseNormals(taperedTube(lowerPath, lowerR, { radialSegments: 12 }), { angle: 42 }),
      skin,
      { parent: root },
    );

    createPart(`${name}_Foot`, sphereGeo(0.022, 12, 10), skin, {
      position: foot,
      scale: [1.15, 0.55, 1.35],
      parent: root,
    });
    for (let t = 0; t < 3; t++) {
      const toe = [
        foot[0] - 0.012,
        foot[1],
        foot[2] + side * (0.014 + t * 0.01),
      ];
      createPart(
        `${name}_Toe_${t}`,
        taperedTube([foot, toe], [0.009, 0.004], { radialSegments: 6 }),
        skin,
        { parent: root },
      );
    }
  }

  salamanderLeg('Leg_FL', 0.32, 0.058, 1);
  salamanderLeg('Leg_FR', 0.32, -0.058, -1);
  salamanderLeg('Leg_BL', 0.15, 0.062, 1);
  salamanderLeg('Leg_BR', 0.15, -0.062, -1);

  createPart('Belly', sphereGeo(0.078, 16, 12), belly, {
    position: [0.26, 0.03, 0],
    scale: [1.45, 0.32, 1.1],
    parent: root,
  });

  return root;
}
