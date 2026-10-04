// Authored by: cloud-agent (FaberVi/kiln organic showcase).

const meta = { name: 'Seahorse', category: 'prop', role: 'prop' };

function build() {
  const root = createRoot('Seahorse');
  const H = 0.48;
  const bodyMat = gameMaterial(0xd4a04a, { roughness: 0.55 });
  const finMat = gameMaterial(0xe8c878, { roughness: 0.42, metalness: 0.02 });

  const spineCtrl = [
    [0.02, 0.052, 0.05],
    [0.028, 0.05, 0.035],
    [0.02, 0.055, 0.018],
    [0.008, 0.072, 0.012],
    [0, 0.095, 0.018],
    [0, 0.13, 0.032],
    [0, 0.19, 0.048],
    [0, 0.25, 0.062],
    [0, 0.3, 0.05],
    [-0.004, 0.34, 0.02],
    [-0.003, 0.365, -0.01],
    [-0.002, 0.378, -0.018],
  ];
  const spinePath = catmullRomPath(spineCtrl, 9);
  const ring = (i) => 1 + 0.055 * Math.sin(i * 1.15);

  const spineRadii = spinePath.map((_, i, a) => {
    const t = i / (a.length - 1);
    const belly = t > 0.38 && t < 0.72 ? 0.04 * Math.sin(((t - 0.38) / 0.34) * Math.PI) : 0;
    const tail = t < 0.28 ? 0.008 + t * 0.05 : 0;
    const neck = t > 0.82 ? 0.026 - (t - 0.82) * 0.08 : 0;
    const core = 0.012 + (1 - t) * 0.01;
    return Math.max(0.006, (core + belly + tail + neck) * ring(i));
  });

  const bodyGeo = taperedTube(spinePath, spineRadii, { radialSegments: 28, creaseAngle: 180 });
  createPart('Body', creaseNormals(bodyGeo, { angle: 34 }), bodyMat, {
    parent: root,
    scale: [0.48, 1, 1],
  });

  const neckTop = spinePath[spinePath.length - 1];
  const headPath = catmullRomPath(
    [
      neckTop,
      [0, 0.374, -0.01],
      [0, 0.358, 0.02],
      [0, 0.338, 0.048],
      [0, 0.318, 0.062],
      [0, 0.298, 0.068],
    ],
    6,
  );
  const headR = H / 5;
  const headRadii = headPath.map((_, i, a) => {
    const t = i / (a.length - 1);
    if (t < 0.4) return headR * 0.44;
    return Math.max(0.005, headR * 0.32 * (1 - (t - 0.4) / 0.6));
  });
  const headGeo = taperedTube(headPath, headRadii, { radialSegments: 20, creaseAngle: 180 });
  createPart('HeadSnout', creaseNormals(headGeo, { angle: 60 }), bodyMat, {
    parent: root,
    scale: [0.55, 1, 1],
  });

  const crown = headPath[2];
  for (const [name, ox, oy, oz, r] of [
    ['Coronet_L', -0.01, 0.012, -0.006, 0.008],
    ['Coronet_C', 0, 0.018, 0, 0.011],
    ['Coronet_R', 0.01, 0.012, 0.006, 0.008],
  ]) {
    createPart(name, sphereGeo(r, 10, 8), bodyMat, {
      position: [crown[0] + ox, crown[1] + oy, crown[2] + oz],
      parent: root,
    });
  }

  const dorsalGeo = sweepProfile(
    [[0, 0], [0.012, 0.002], [0.016, 0.014], [0, 0.022], [-0.016, 0.014], [-0.012, 0.002]],
    catmullRomPath(
      [
        [0, 0.22, -0.026],
        [0, 0.27, -0.034],
        [0, 0.31, -0.036],
      ],
      3,
    ),
    { cap: true, creaseAngle: 55 },
  );
  createPart('DorsalFin', dorsalGeo, finMat, { parent: root, scale: [0.5, 1, 1] });

  function pectoralFin(name, side) {
    const fin = sweepProfile(
      [[0, 0], [side * 0.008, 0.002], [side * 0.011, 0.01], [0, 0.012]],
      catmullRomPath(
        [
          [side * 0.012, 0.348, 0.01],
          [side * 0.024, 0.344, 0.016],
        ],
        2,
      ),
      { cap: true, creaseAngle: 55 },
    );
    createPart(name, fin, finMat, { parent: root });
  }
  pectoralFin('Pectoral_L', 1);
  pectoralFin('Pectoral_R', -1);

  return root;
}
