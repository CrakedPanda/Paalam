import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('./public/vendor/', import.meta.url);
await mkdir(new URL('wasm/', base), { recursive: true });
const version = '0.10.21';
const cdn = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/`;
const files = ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm', 'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm'];
const sources = files.map(file => [file, cdn + file]);
sources.push(['hand_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task']);
sources.push(['pose_landmarker_lite.task', 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task']);
sources.push(['LICENSE', 'https://raw.githubusercontent.com/google-ai-edge/mediapipe/v0.10.21/LICENSE']);
const manifest = { version, downloadedAt: new Date().toISOString(), files: [] };
for (const [file, url] of sources) {
  console.log(`Downloading ${file}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(file + '.tmp', base), data);
  await rename(new URL(file + '.tmp', base), new URL(file, base));
  manifest.files.push({ file, url, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await writeFile(new URL('manifest.json', base), JSON.stringify(manifest, null, 2));
console.log('Ready. All vision assets are local. Run node server.mjs.');
