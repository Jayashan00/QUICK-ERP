import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'quick-erp-inquiry-qa-'));
try {
  const output = join(directory, 'inquiry-qa.mjs');
  await build({ entryPoints: ['scripts/inquiry-qa.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', target: 'node22', tsconfig: 'tsconfig.app.json', logLevel: 'silent' });
  await import(pathToFileURL(output).href);
} finally {
  const relativePath = relative(tmpdir(), directory);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('Unsafe QA cleanup path');
  await rm(directory, { recursive: true, force: true });
}
