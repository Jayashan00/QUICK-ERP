import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Bundles and runs scripts/export-backend-seed.ts (writes the backend's starter-data.json).
const directory = await mkdtemp(join(tmpdir(), 'quick-erp-seed-export-'));
const output = join(directory, 'export-backend-seed.mjs');
try {
  await build({ entryPoints: ['scripts/export-backend-seed.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', target: 'node22', tsconfig: 'tsconfig.app.json', logLevel: 'silent' });
  await import(`${new URL(`file:///${output.replace(/\\/g, '/')}`).href}?run=${Date.now()}`);
} finally { await rm(directory, { recursive: true, force: true }); }
