import * as THREE from 'three';
import { createRoot, createPart, boxGeo, gameMaterial } from '../primitives';

export const hue = (i: number, n: number): number =>
  new THREE.Color().setHSL(i / n, 0.7, 0.5).getHex();

export function manyColorScene(n: number): THREE.Object3D {
  const root = createRoot('Palette');
  for (let i = 0; i < n; i++) {
    createPart(`Box${i}`, boxGeo(1, 1, 1), gameMaterial(hue(i, n)), {
      position: [i * 1.5, 0, 0],
      parent: root,
    });
  }
  return root;
}
