/// <reference lib="dom" />
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

let dracoLoader: DRACOLoader | undefined;
let meshoptReady: Promise<void> | undefined;

/** Wait for WASM meshopt support (safe to call multiple times). */
export function ensureMeshoptDecoder(): Promise<void> {
  if (!meshoptReady) meshoptReady = MeshoptDecoder.ready.then(() => undefined);
  return meshoptReady;
}

/**
 * GLTFLoader configured for Kiln review assets: Draco geometry, meshopt compression,
 * and ordinary uncompressed glTF 2.0 buffers.
 */
export async function createGLTFLoader(
  manager: THREE.LoadingManager = new THREE.LoadingManager(),
): Promise<GLTFLoader> {
  await ensureMeshoptDecoder();
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (!dracoLoader) dracoLoader = new DRACOLoader(new THREE.LoadingManager());
  loader.setDRACOLoader(dracoLoader);
  return loader;
}
