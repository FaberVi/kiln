// Benchmark (after): seahorse silhouette (lateral reference).
// Authored by: cloud-agent, organic benchmark, after lane.

const meta = { name: 'Seahorse', category: 'prop', role: 'prop' };

async function build() {
  const root = createRoot('Seahorse');
  const H = 0.48;
  const bodyMat = gameMaterial(0xd4a04a, { roughness: 0.55 });
  const finMat = gameMaterial(0xe8c878, { roughness: 0.42, metalness: 0.02 });

  const tailSpiral = spiralPath({
    center: [0, 0.046, 0.042],
    radius: H * 0.068,
    rise: H * 0.2,
    turns: 1.78,
    forward: [0, 0, 1],
    samples: 42,
  });
  const tailRadii = tailSpiral.map((_, i, a) => {
    const t = i / (a.length - 1);
    return Math.max(0.0035, 0.016 * (1 - t * 0.92));
  });
  const tailGeo = taperedTube(tailSpiral, tailRadii, { radialSegments: 22, creaseAngle: 180 });
  createPart('Tail', creaseNormals(tailGeo, { angle: 48 }), bodyMat, {
    parent: root,
    scale: [0.5, 1, 1],
  });

  const trunkCtrl = [
    tailSpiral[tailSpiral.length - 1],
    [0, 0.12, 0.028],
    [0, 0.19, 0.046],
    [0, 0.25, 0.062],
    [0, 0.3, 0.05],
    [-0.004, 0.34, 0.018],
    [-0.003, 0.362, -0.006],
    [-0.002, 0.376, -0.016],
  ];
  const spinePath = catmullRomPath(trunkCtrl, 8);
  const ring = (i) => 1 + 0.055 * Math.sin(i * 1.15);

  const spineRadii = spinePath.map((_, i, a) => {
    const t = i / (a.length - 1);
    const belly = t > 0.32 && t < 0.78 ? 0.042 * Math.sin(((t - 0.32) / 0.46) * Math.PI) : 0;
    const neck = t > 0.82 ? 0.028 - (t - 0.82) * 0.07 : 0;
    const core = 0.014 + (1 - t) * 0.008;
    return Math.max(0.008, (core + belly + neck) * ring(i));
  });

  const bodyGeo = taperedTube(spinePath, spineRadii, { radialSegments: 28, creaseAngle: 180 });
  createPart('Body', creaseNormals(bodyGeo, { angle: 34 }), bodyMat, {
    parent: root,
    scale: [0.48, 1, 1],
  });

  const neckTop = spinePath[spinePath.length - 1];
  const headGeo = await metaballSurface(
    [
      { center: neckTop, radius: 0.031 },
      { center: [0, 0.368, -0.008], radius: 0.036 },
      { center: [0, 0.354, 0.014], radius: 0.032 },
      { center: [0, 0.344, 0.034], radius: 0.024 },
    ],
    {
      bounds: { min: [-0.05, 0.32, -0.045], max: [0.05, 0.395, 0.075] },
      edgeLength: 0.026,
      blend: 0.024,
    },
  );
  createPart('Head', creaseNormals(headGeo, { angle: 58 }), bodyMat, {
    parent: root,
    scale: [0.52, 1, 1],
  });

  const snoutBase = [0, 0.342, 0.036];
  const snoutPath = catmullRomPath(
    [
      snoutBase,
      [0, 0.328, 0.052],
      [0, 0.312, 0.066],
      [0, 0.296, 0.076],
      [0, 0.282, 0.082],
      [0, 0.272, 0.084],
    ],
    6,
  );
  const snoutLen = H / 5;
  const snoutRadii = snoutPath.map((_, i, a) => {
    const t = i / (a.length - 1);
    if (t < 0.12) return snoutLen * 0.32;
    if (t > 0.9) return snoutLen * 0.28;
    return Math.max(0.004, snoutLen * 0.3 * (1 - (t - 0.12) / 0.78) + 0.005);
  });
  const snoutGeo = taperedTube(snoutPath, snoutRadii, { radialSegments: 24, creaseAngle: 180 });
  createPart('Snout', creaseNormals(snoutGeo, { angle: 72 }), bodyMat, {
    parent: root,
    scale: [0.52, 1, 1],
  });

  const crown = [0, 0.362, 0.01];
  for (const [name, ox, oy, oz, r] of [
    ['Coronet_L', -0.01, 0.014, -0.006, 0.008],
    ['Coronet_C', 0, 0.02, 0, 0.012],
    ['Coronet_R', 0.01, 0.014, 0.006, 0.008],
  ]) {
    createPart(name, sphereGeo(r, 10, 8), bodyMat, {
      position: [crown[0] + ox, crown[1] + oy, crown[2] + oz],
      parent: root,
    });
  }

  createPart('Eye_L', sphereGeo(0.0075, 12, 10), bodyMat, {
    position: [0.015, 0.356, 0.028],
    parent: root,
  });
  createPart('Eye_R', sphereGeo(0.0075, 12, 10), bodyMat, {
    position: [-0.015, 0.356, 0.028],
    parent: root,
  });

  const finPath = catmullRomPath(
    [
      [0, 0.235, -0.021],
      [0, 0.265, -0.026],
      [0, 0.295, -0.028],
      [0, 0.318, -0.025],
    ],
    4,
  );
  const finScales = finPath.map((_, i) => (i === 0 ? [0.08, 1] : [1, 1]));
  const dorsalGeo = sweepProfile(
    [
      [0, 0],
      [0.02, 0],
      [0.026, -0.008],
      [0.028, -0.018],
      [0, -0.024],
      [-0.028, -0.018],
      [-0.026, -0.008],
      [-0.02, 0],
    ],
    finPath,
    { cap: 'end', creaseAngle: 62, scale: finScales, up: [0, 0, 1] },
  );
  createPart('DorsalFin', creaseNormals(dorsalGeo, { angle: 52 }), finMat, {
    parent: root,
    scale: [0.48, 1, 1],
  });
  for (let r = 0; r < 4; r++) {
    const y = 0.248 + r * 0.018;
    createPart(
      `DorsalRay_${r}`,
      taperedTube(
        [
          [0, y, -0.022],
          [0, y + 0.006, -0.034],
        ],
        [0.002, 0.001],
        { radialSegments: 6 },
      ),
      finMat,
      { parent: root, scale: [0.48, 1, 1] },
    );
  }

  function pectoralFin(name, side) {
    const base = [side * 0.016, 0.352, 0.012];
    const pecPath = catmullRomPath([base, [side * 0.028, 0.348, 0.016]], 2);
    const fin = sweepProfile(
      [[0, 0], [side * 0.01, 0.001], [side * 0.014, 0.008], [0, 0.01]],
      pecPath,
      {
        cap: 'end',
        creaseAngle: 58,
        scale: pecPath.map((_, i) => (i === 0 ? [0.12, 1] : [1, 1])),
      },
    );
    createPart(name, fin, finMat, { parent: root });
  }
  pectoralFin('Pectoral_L', 1);
  pectoralFin('Pectoral_R', -1);

  return root;
}
