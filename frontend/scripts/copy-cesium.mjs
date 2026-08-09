/**
 * EMBER — stage Cesium's static assets into `public/cesium`.
 * OWNER: FRONTEND
 *
 * Cesium ships web workers, textures and widget CSS that must be served as
 * plain files. `vite-plugin-cesium` is supposed to do this, but under Vite 6 it
 * serves Assets/ and Widgets/ while Workers/ falls through to the SPA fallback —
 * you get `index.html` with a text/html MIME type where a worker script should
 * be, and Cesium dies with "The source image could not be decoded".
 *
 * Copying into `public/` sidesteps the plugin entirely: Vite serves `public/`
 * verbatim in dev and copies it into `dist/` on build, so one mechanism covers
 * both. `window.CESIUM_BASE_URL` in index.html points Cesium at it.
 *
 * Runs from `predev` / `prebuild`. Skips work when already up to date.
 */

import { cp, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '..');
// Hoisted to the workspace root by npm, so look in both places.
const candidates = [
  resolve(frontend, 'node_modules/cesium/Build/Cesium'),
  resolve(frontend, '../node_modules/cesium/Build/Cesium'),
];

const source = candidates.find((p) => existsSync(p));
if (!source) {
  console.error('[cesium] Build/Cesium not found — is `cesium` installed?');
  process.exit(0); // Non-fatal: the app still runs, 3D just reports unavailable.
}

const target = resolve(frontend, 'public/cesium');
const DIRS = ['Workers', 'Assets', 'ThirdParty', 'Widgets'];

// Cheap freshness check — copying ~10MB on every dev boot is a slow feedback loop.
const upToDate = async () => {
  try {
    const [src, dst] = await Promise.all([
      stat(resolve(source, 'Workers')),
      stat(resolve(target, 'Workers')),
    ]);
    return dst.mtimeMs >= src.mtimeMs;
  } catch {
    return false;
  }
};

if (await upToDate()) {
  console.log('[cesium] public/cesium up to date');
} else {
  await mkdir(target, { recursive: true });
  for (const dir of DIRS) {
    const from = resolve(source, dir);
    if (!existsSync(from)) continue;
    await cp(from, resolve(target, dir), { recursive: true });
  }
  console.log(`[cesium] staged ${DIRS.join(', ')} → public/cesium`);
}
