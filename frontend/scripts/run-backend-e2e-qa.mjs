import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Bundles scripts/backend-e2e-qa.ts with the backend address and runs it against the running backend.
const api = process.env.E2E_API ?? 'http://localhost:8000/api/v1';
const directory = await mkdtemp(join(tmpdir(), 'quick-erp-backend-e2e-'));
const output = join(directory, 'backend-e2e-qa.mjs');
try {
  await build({ entryPoints: ['scripts/backend-e2e-qa.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', target: 'node22', tsconfig: 'tsconfig.app.json', logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: api, VITE_USE_MOCKS: 'false' }) } });
  await import(`${new URL(`file:///${output.replace(/\\/g, '/')}`).href}?run=${Date.now()}`);
} finally { await rm(directory, { recursive: true, force: true }); }
