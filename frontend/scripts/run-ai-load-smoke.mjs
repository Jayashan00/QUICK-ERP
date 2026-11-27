/** Bounded localhost-only smoke harness. It never prints tokens or response bodies. */
const origin = process.env.AI_LOAD_BASE_URL ?? 'http://127.0.0.1:8000';
const target = new URL(origin);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || !['http:', 'https:'].includes(target.protocol))
  throw new Error('Load smoke is restricted to a local backend. Use a reviewed staging plan for remote load.');
const token = process.env.AI_LOAD_TOKEN;
const branch = process.env.AI_LOAD_BRANCH;
if (!token || !branch) throw new Error('Set AI_LOAD_TOKEN and AI_LOAD_BRANCH for a synthetic test user.');
const total = Number(process.env.AI_LOAD_REQUESTS ?? '8');
const concurrency = Number(process.env.AI_LOAD_CONCURRENCY ?? '2');
if (!Number.isInteger(total) || total < 1 || total > 100 || !Number.isInteger(concurrency)
    || concurrency < 1 || concurrency > 10 || concurrency > total) throw new Error('Invalid bounded load size.');
const durations = [];
const statuses = new Map();
let next = 0;
const worker = async () => {
  while (next < total) {
    next += 1;
    const started = performance.now();
    let status = 'network_error';
    try {
      const response = await fetch(new URL('/api/v1/ai/chat', target), {
        method: 'POST', signal: AbortSignal.timeout(75_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'List the ERP resources I can access.', currentBranchId: branch }),
      });
      status = String(response.status);
      await response.arrayBuffer();
    } catch { /* The summary keeps only status, never private payloads. */ }
    durations.push(Math.round(performance.now() - started));
    statuses.set(status, (statuses.get(status) ?? 0) + 1);
  }
};
await Promise.all(Array.from({ length: concurrency }, worker));
durations.sort((a, b) => a - b);
console.log(JSON.stringify({ requests: total, concurrency, statuses: Object.fromEntries(statuses),
  p50Ms: durations[Math.ceil(total * 0.5) - 1], p95Ms: durations[Math.ceil(total * 0.95) - 1] }, null, 2));
if (statuses.size !== 1 || !statuses.has('200')) process.exitCode = 1;
