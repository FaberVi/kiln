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
  const bodyScale = [0.48, 1, 1];

  function spineAtY(targetY) {
    let idx = 0;
    for (let i = 1; i < spinePath.length; i++) {
      if (Math.abs(spinePath[i][1] - targetY) < Math.abs(spinePath[idx][1] - targetY)) idx = i;
    }
    return { point: spinePath[idx], radius: spineRadii[idx] };
  }

  const finYs = [0.238, 0.268, 0.298, 0.318];
  const finHeight = 0.028;
  const finHalfW = 0.02;
  let finPart = null;
  for (const y of finYs) {
    const { point, radius } = spineAtY(y);
    const backZ = point[2] - radius + 0.03;
    const base = [point[0], point[1] - 0.004, backZ];
    const tip = [point[0], point[1] + finHeight, backZ];
    const colProf = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      colProf.push([
        Math.cos(a) * finHalfW * 0.62,
        Math.sin(a) * finHalfW - (i === 0 || i === 8 ? 0.011 : 0),
      ]);
    }
    const colGeo = sweepProfile(colProf, catmullRomPath([base, tip], 1), {
      cap: true,
      creaseAngle: 66,
      up: [0, 0, 1],
    });
    const colPart = createPart(`DorsalCol_${y}`, creaseNormals(colGeo, { angle: 58 }), finMat, {
      scale: bodyScale,
    });
    finPart = finPart ? await boolUnion('DorsalFin', finPart, colPart) : colPart;
  }
  const bodyPart = createPart('BodyMesh', creaseNormals(bodyGeo, { angle: 34 }), bodyMat, {
    scale: bodyScale,
  });
  const bodyWithFin = await boolUnion('Body', bodyPart, finPart);
  root.add(bodyWithFin);

  const neckTop = spinePath[spinePath.length - 1];
  const headLen = H / 5;

  const snoutPath = catmullRomPath(
    [
      [0, 0.328, 0.056],
      [0, 0.306, 0.078],
      [0, 0.282, 0.098],
      [0, 0.256, 0.112],
      [0, 0.232, 0.122],
      [0, 0.212, 0.126],
      [0, 0.198, 0.124],
      [0, 0.188, 0.118],
    ],
    8,
  );
  const snoutRadii = snoutPath.map((_, i, a) => {
    const t = i / (a.length - 1);
    const base = headLen * 0.42;
    if (t < 0.05) return base;
    if (t > 0.78) return headLen * 0.48;
    return Math.max(0.01, base * (1 - (t - 0.05) * 0.58));
  });
  const snoutSpheres = snoutPath.map((center, i) => ({
    center,
    radius: snoutRadii[i] * 0.92,
  }));
  const snoutTip = snoutPath[snoutPath.length - 1];
  snoutSpheres.push({ center: snoutTip, radius: headLen * 0.5 });

  const headSpheres = [
    { center: [neckTop[0], neckTop[1] - 0.022, neckTop[2] + 0.006], radius: headLen * 0.5 },
    { center: [neckTop[0], neckTop[1] - 0.006, neckTop[2] + 0.012], radius: headLen * 0.46 },
    { center: [0, 0.37, 0.004], radius: headLen * 0.5 },
    { center: [0, 0.356, 0.022], radius: headLen * 0.5 },
    { center: [0, 0.344, 0.038], radius: headLen * 0.47 },
    { center: [0, 0.334, 0.05], radius: headLen * 0.42 },
  ];
  const headGeo = await metaballSurface(headSpheres.concat(snoutSpheres), {
    bounds: { min: [-0.07, 0.28, -0.05], max: [0.07, 0.42, 0.13] },
    edgeLength: 0.019,
    blend: 0.052,
  });
  createPart('Head', headGeo, bodyMat, {
    parent: root,
    scale: [0.5, 1, 1],
  });

  const crown = [0, 0.358, 0.018];
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
    position: [0.015, 0.352, 0.03],
    parent: root,
  });
  createPart('Eye_R', sphereGeo(0.0075, 12, 10), bodyMat, {
    position: [-0.015, 0.352, 0.03],
    parent: root,
  });

  function pectoralFin(name, side) {
    const base = [side * 0.016, 0.348, 0.018];
    const pecPath = catmullRomPath([base, [side * 0.028, 0.344, 0.022]], 2);
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
