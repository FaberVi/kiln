// Benchmark (after): organic helpers.
// Authored by: cloud-agent, organic benchmark, after lane.

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
    [0.066, 0.405, -0.006],
    [0.06, 0.425, -0.009],
    [0.056, 0.442, -0.01],
    [0.052, 0.456, -0.009],
    [0.048, 0.468, -0.007],
  ];
  const spinePath = catmullRomPath(spineCtrl, 10);
  const spineR = spinePath.map((_, i, a) => {
    const t = i / (a.length - 1);
    const belly = 0.017 * Math.sin(Math.PI * Math.min(t * 2.1, 1));
    const tailTip = t < 0.18 ? 0.014 * (1 - t / 0.18) : 0;
    const headSwelling = t > 0.78 ? 0.014 * Math.sin(((t - 0.78) / 0.22) * Math.PI) : 0;
    const neckTaper = t > 0.68 && t < 0.82 ? -0.004 * Math.sin(((t - 0.68) / 0.14) * Math.PI) : 0;
    return 0.024 + belly + headSwelling + neckTaper + 0.013 * (1 - t * 0.52) - tailTip;
  });
  const bodyGeo = taperedTube(spinePath, spineR, { radialSegments: 32, creaseAngle: 180 });
  createPart('Body', creaseNormals(bodyGeo, { angle: 62 }), bodyMat, { parent: root });

  const snoutStart = spinePath[spinePath.length - 1];
  const snoutR0 = spineR[spineR.length - 1] * 0.92;
  const snoutPath = catmullRomPath(
    [
      snoutStart,
      [snoutStart[0] + 0.03, snoutStart[1] - 0.003, snoutStart[2] + 0.005],
      [snoutStart[0] + 0.065, snoutStart[1] - 0.008, snoutStart[2] + 0.01],
      [snoutStart[0] + 0.11, snoutStart[1] - 0.014, snoutStart[2] + 0.014],
      [snoutStart[0] + 0.15, snoutStart[1] - 0.018, snoutStart[2] + 0.017],
      [snoutStart[0] + 0.18, snoutStart[1] - 0.02, snoutStart[2] + 0.018],
    ],
    10,
  );
  const snoutR = snoutPath.map((_, i, a) => snoutR0 * (1 - (i / (a.length - 1)) * 0.86) + 0.004);
  createPart('Snout', taperedTube(snoutPath, snoutR, { radialSegments: 18 }), bodyMat, { parent: root });

  const crown = spinePath[Math.floor(spinePath.length * 0.92)];
  for (const [name, ox, oy, oz] of [
    ['Coronet_L', crown[0] - 0.018, crown[1] + 0.022, crown[2] + 0.01],
    ['Coronet_C', crown[0] + 0.008, crown[1] + 0.026, crown[2]],
    ['Coronet_R', crown[0] + 0.028, crown[1] + 0.022, crown[2] - 0.01],
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
