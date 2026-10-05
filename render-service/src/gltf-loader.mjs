/** GLTFLoader with Draco and meshopt decoders for self-contained GLB review renders. */
import { ensureGltfNodeEnvironment } from './gltf-node-env.mjs';
const THREE = await import('three/webgpu');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');

let dracoLoader;
let meshoptReady;

export async function createGltfLoader(manager) {
  ensureGltfNodeEnvironment();
  if (!meshoptReady) meshoptReady = MeshoptDecoder.ready;
  await meshoptReady;
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (!dracoLoader) dracoLoader = new DRACOLoader(new THREE.LoadingManager());
  loader.setDRACOLoader(dracoLoader);
  return loader;
}

/** Release Draco worker threads so short-lived Node processes can exit cleanly. */
export function disposeGltfDecoderSingletons() {
  dracoLoader?.dispose();
  dracoLoader = undefined;
}
