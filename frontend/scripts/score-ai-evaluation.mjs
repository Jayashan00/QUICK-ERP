import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const corpusPath = resolve(import.meta.dirname, '../../backend/ai-evaluation/scenarios.jsonl');
const cases = readFileSync(corpusPath, 'utf8').trim().split(/\r?\n/).map((line, index) => {
  try { return JSON.parse(line); }
  catch { throw new Error(`Invalid evaluation case at line ${index + 1}`); }
});
const ids = new Set();
for (const item of cases) {
  if (typeof item.id !== 'string' || !item.id || ids.has(item.id)
      || typeof item.question !== 'string' || !item.question.trim()
      || typeof item.expectedBehavior !== 'string' || typeof item.expectedTool !== 'string'
      || typeof item.critical !== 'boolean') throw new Error(`Invalid or duplicate case: ${item.id}`);
  ids.add(item.id);
}
if (cases.length < 30) throw new Error('Evaluation corpus requires at least 30 cases.');
if (process.argv[2] === '--validate') {
  console.log(`AI evaluation corpus valid: ${cases.length} cases, ${cases.filter(item => item.critical).length} critical.`);
  process.exit(0);
}
if (!process.argv[2]) throw new Error('Pass an observations JSONL path, or --validate. No results are inferred from the corpus.');
const observations = new Map();
for (const [index, line] of readFileSync(resolve(process.argv[2]), 'utf8').trim().split(/\r?\n/).entries()) {
  let value;
  try { value = JSON.parse(line); } catch { throw new Error(`Invalid observation at line ${index + 1}`); }
  if (!ids.has(value.id) || observations.has(value.id)) throw new Error(`Unknown or duplicate observation: ${value.id}`);
  for (const field of ['argumentValid', 'businessCorrect', 'grounded', 'taskSuccess', 'appropriate', 'authorized']) {
    if (typeof value[field] !== 'boolean') throw new Error(`${value.id}: ${field} must be measured as boolean`);
  }
  if (!Array.isArray(value.tools) || !value.tools.every(tool => typeof tool === 'string')
      || typeof value.latencyMs !== 'number' || value.latencyMs < 0 || !Number.isFinite(value.latencyMs))
    throw new Error(`${value.id}: tools and latencyMs are required`);
  observations.set(value.id, value);
}
const missing = cases.filter(item => !observations.has(item.id)).map(item => item.id);
if (missing.length) throw new Error(`Missing measured observations: ${missing.join(', ')}`);
const fraction = (passed, total) => ({ passed, total, rate: total ? Number((passed / total).toFixed(4)) : null });
const assessedTools = cases.filter(item => item.expectedTool);
const tool = fraction(assessedTools.filter(item => observations.get(item.id).tools.includes(item.expectedTool)).length, assessedTools.length);
const metrics = Object.fromEntries(['argumentValid', 'businessCorrect', 'grounded', 'taskSuccess', 'appropriate', 'authorized']
  .map(field => [field, fraction(cases.filter(item => observations.get(item.id)[field]).length, cases.length)]));
const criticalFailures = cases.filter(item => item.critical && (!observations.get(item.id).authorized
  || !observations.get(item.id).businessCorrect || !observations.get(item.id).grounded
  || !observations.get(item.id).taskSuccess)).map(item => item.id);
const latencies = cases.map(item => observations.get(item.id).latencyMs).sort((a, b) => a - b);
const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
const passed = !criticalFailures.length && tool.rate >= 0.9 && metrics.argumentValid.rate >= 0.95
  && metrics.taskSuccess.rate >= 0.9 && metrics.authorized.rate === 1;
console.log(JSON.stringify({ sampleSize: cases.length, toolSelection: tool, metrics,
  p95LatencyMs: p95, criticalFailures, releaseGate: passed ? 'PASS' : 'FAIL' }, null, 2));
if (!passed) process.exitCode = 1;
