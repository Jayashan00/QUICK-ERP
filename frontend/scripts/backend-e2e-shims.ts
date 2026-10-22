// Minimal browser globals so the frontend sync modules run in Node.
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() }; };
const g = globalThis as Record<string, unknown>;
g.localStorage = store(); g.sessionStorage = store();
g.window = { location: { pathname: '/', replace() {} }, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, setInterval, clearInterval };
g.document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' };
