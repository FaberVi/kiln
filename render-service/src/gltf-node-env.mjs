import { readFileSync } from 'node:fs';
import { Worker as NodeWorker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

/** Browser globals GLTFLoader expects when parsing embedded PNG textures in Node. */
export function ensureGltfNodeEnvironment() {
  if (globalThis.__kilnGltfNodeEnv) return;
  globalThis.self = globalThis;
  if (typeof globalThis.ProgressEvent === 'undefined') {
    globalThis.ProgressEvent = class ProgressEvent extends Event {
      constructor(type, init = {}) {
        super(type);
        this.lengthComputable = init.lengthComputable ?? false;
        this.loaded = init.loaded ?? 0;
        this.total = init.total ?? 0;
      }
    };
  }
  const baseFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('file://')) {
      const body = readFileSync(fileURLToPath(url));
      const headers = new Headers(init?.headers);
      if (!headers.has('content-type')) {
        headers.set(
          'content-type',
          url.endsWith('.wasm') ? 'application/wasm' : 'application/javascript',
        );
      }
      return new Response(body, { status: 200, headers });
    }
    return baseFetch(input, init);
  };
  globalThis.createImageBitmap = async (blob) => {
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error('only PNG images supported in GLB');
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: new Uint8Array(png.data), close() {} };
  };
  if (typeof globalThis.Worker === 'undefined') {
    const NativeBlob = globalThis.Blob;
    const workerSources = new Map();
    let workerUrlId = 0;
    globalThis.Blob = class KilnTrackedBlob extends NativeBlob {
      constructor(parts, options) {
        super(parts, options);
        this._kilnParts = parts;
      }
    };
    const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob?._kilnParts) {
        const text = blob._kilnParts
          .map((part) => (typeof part === 'string' ? part : ''))
          .join('\n');
        if (text.includes('/* draco decoder */')) {
          const id = `kiln-worker-${workerUrlId++}`;
          workerSources.set(
            id,
            [
              "const { parentPort } = require('node:worker_threads');",
              'globalThis.self = globalThis;',
              'self.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);',
              text,
              'parentPort.on("message", (message) => { if (typeof onmessage === "function") onmessage({ data: message }); });',
            ].join('\n'),
          );
          return `blob:${id}`;
        }
      }
      return nativeCreateObjectURL(blob);
    };
    const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      if (typeof url === 'string' && url.startsWith('blob:kiln-worker-')) {
        workerSources.delete(url.slice(5));
        return;
      }
      nativeRevokeObjectURL(url);
    };
    globalThis.Worker = class Worker {
      constructor(url) {
        const source = workerSources.get(url.slice(5));
        if (!source) throw new Error(`unknown worker URL ${url}`);
        this._callbacks = {};
        this._taskCosts = {};
        this._taskLoad = 0;
        this._worker = new NodeWorker(source, { eval: true });
        this._worker.on('message', (message) => this.onmessage?.({ data: message }));
        this._worker.on('error', (error) => this.onerror?.(error));
      }
      postMessage(message, transfer) {
        this._worker.postMessage(message, transfer);
      }
      terminate() {
        this._worker.terminate();
      }
    };
  }
  globalThis.__kilnGltfNodeEnv = true;
}
