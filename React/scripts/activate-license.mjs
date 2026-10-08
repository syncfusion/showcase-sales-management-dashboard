// Registers the Syncfusion licence from a local .env file (never committed) before dev/build.
// Runs Syncfusion's own `syncfusion-license activate`, which reads SYNCFUSION_LICENSE and patches
// @syncfusion/ej2-base in node_modules. Without a key the app still runs, showing the trial banner.
import { existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (!process.env.SYNCFUSION_LICENSE?.trim()) {
  console.log('Syncfusion licence: SYNCFUSION_LICENSE not set (add it to .env); the trial banner will show.');
  process.exit(0);
}
const bin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'syncfusion-license.cmd' : 'syncfusion-license');
const result = spawnSync(bin, ['activate'], { cwd: root, env: process.env, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) process.exit(result.status ?? 1);
// Vite caches pre-bundled dependencies; drop the cache so the patched ej2-base is picked up.
rmSync(join(root, 'node_modules', '.vite'), { recursive: true, force: true });
