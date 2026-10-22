import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'quick-erp-support-qa-'));
const outfile = join(directory, 'support-qa.mjs');
try {
  await build({ entryPoints: ['scripts/support-qa.ts'], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', tsconfig: 'tsconfig.app.json', logLevel: 'silent' });
  await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
