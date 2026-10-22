import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'quick-erp-api-qa-'));
const output = join(directory, 'api-qa.mjs');
try {
  await build({ entryPoints: ['scripts/api-qa.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', target: 'node22', tsconfig: 'tsconfig.app.json', logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: 'https://api.example.test/api/v1/', VITE_USE_MOCKS: 'false', DEV: false, PROD: true }) } });
  await import(pathToFileURL(output).href);
} finally { await rm(directory, { recursive: true, force: true }); }
