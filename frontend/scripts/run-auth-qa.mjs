import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const directory = await mkdtemp(join(tmpdir(), 'quick-erp-auth-qa-'));
const output = join(directory, 'auth-qa.mjs');
try {
  await build({ entryPoints: ['scripts/auth-qa.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', target: 'node22', tsconfig: 'tsconfig.app.json', logLevel: 'silent' });
  await import(`${new URL(`file:///${output.replace(/\\/g, '/')}`).href}?run=${Date.now()}`);
} finally { await rm(directory, { recursive: true, force: true }); }
