import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
// qa:backend is left out: it checks a running backend and is started by hand (npm run qa:backend).
const excluded = new Set(['qa:all', 'qa:backend']);
const suites = Object.entries(scripts).filter(([name]) => name.startsWith('qa:') && !excluded.has(name));

// Each suite has a fresh process: mutable mock stores never leak between suites.
for (const [name, command] of suites) {
  const match = /^node (scripts\/run-[a-z-]+-qa\.mjs)$/.exec(command);
  if (!match) throw new Error(`Unsupported QA command for ${name}: expected one Node QA runner.`);
  console.log(`\nRunning ${name}`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [match[1]], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (status, signal) => resolve(signal ? 1 : status ?? 1));
  });
  if (code !== 0) { process.exitCode = code; break; }
}
if (!process.exitCode) console.log(`\nAll ${suites.length} QA suites passed.`);
