// Authored by: cloud-agent (FaberVi/kiln organic showcase).

const meta = { name: 'Seahorse', category: 'prop', role: 'prop' };

function build() {
  const root = createRoot('Seahorse');
  const bodyMat = gameMaterial(0xd4a04a, { roughness: 0.55 });
  const finMat = gameMaterial(0xe8c878, { roughness: 0.42, metalness: 0.02 });

  const spineCtrl = [
    [0.02, 0.04, -0.045],
    [-0.01, 0.044, -0.06],
    [-0.035, 0.05, -0.065],
    [-0.055, 0.058, -0.055],
    [-0.06, 0.068, -0.035],
    [-0.05, 0.082, -0.012],
    [-0.03, 0.1, 0.004],
    [-0.005, 0.13, 0.01],
    [0.02, 0.17, 0.012],
    [0.04, 0.22, 0.01],
    [0.055, 0.27, 0.007],
    [0.064, 0.32, 0.003],
    [0.068, 0.37, -0.002],
    [0.064, 0.41, -0.008],
    [0.055, 0.435, -0.012],
  ];
  const spinePath = catmullRomPath(spineCtrl, 10);
  const spineR = spinePath.map((_, i, a) => {
    const t = i / (a.length - 1);
    const belly = 0.017 * Math.sin(Math.PI * Math.min(t * 2.1, 1));
    const tailTip = t < 0.18 ? 0.014 * (1 - t / 0.18) : 0;
    const neck = t > 0.85 ? 0.009 : 0;
    return 0.024 + belly + neck + 0.013 * (1 - t * 0.52) - tailTip;
  });
  const bodyGeo = taperedTube(spinePath, spineR, { radialSegments: 32, creaseAngle: 180 });
  createPart('Body', creaseNormals(bodyGeo, { angle: 62 }), bodyMat, { parent: root });

  const headBase = spinePath[spinePath.length - 1];
  const snoutPath = catmullRomPath(
    [
      headBase,
      [headBase[0] + 0.035, headBase[1] - 0.004, headBase[2] + 0.006],
      [headBase[0] + 0.075, headBase[1] - 0.01, headBase[2] + 0.012],
      [headBase[0] + 0.12, headBase[1] - 0.016, headBase[2] + 0.016],
      [headBase[0] + 0.16, headBase[1] - 0.02, headBase[2] + 0.018],
      [headBase[0] + 0.19, headBase[1] - 0.022, headBase[2] + 0.019],
    ],
    10,
  );
  const snoutR = snoutPath.map((_, i, a) => 0.024 * (1 - (i / (a.length - 1)) * 0.82) + 0.005);
  createPart('Snout', taperedTube(snoutPath, snoutR, { radialSegments: 18 }), bodyMat, { parent: root });

  createPart('Head', sphereGeo(0.036, 22, 18), bodyMat, {
    position: [headBase[0] - 0.01, headBase[1] + 0.01, headBase[2]],
    scale: [1.15, 0.92, 0.88],
    parent: root,
  });
  for (const [name, ox, oy, oz] of [
    ['Coronet_L', headBase[0] - 0.02, headBase[1] + 0.028, headBase[2] + 0.012],
    ['Coronet_C', headBase[0] + 0.01, headBase[1] + 0.032, headBase[2]],
    ['Coronet_R', headBase[0] + 0.03, headBase[1] + 0.028, headBase[2] - 0.01],
  ]) {
    createPart(name, sphereGeo(0.011, 8, 6), bodyMat, { position: [ox, oy, oz], parent: root });
  }

  const finPath = catmullRomPath(
    [[0.015, 0.16, -0.028], [0.035, 0.22, -0.03], [0.048, 0.28, -0.028], [0.052, 0.34, -0.024]],
    4,
  );
  const finGeo = sweepProfile(
    [[0, 0], [0.016, 0.006], [0.02, 0.038], [0, 0.052], [-0.02, 0.038], [-0.016, 0.006]],
    finPath,
    { cap: true, creaseAngle: 50 },
  );
  createPart('DorsalFin', finGeo, finMat, { parent: root });

  return root;
}
