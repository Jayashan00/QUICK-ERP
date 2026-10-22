export function readRecentSearches(key: string | null): string[] {
  if (!key) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((term): term is string => typeof term === 'string' && term.trim().length >= 2 && term.length <= 120).slice(0, 5) : [];
  } catch { return []; }
}
export function rememberSearch(key: string | null, query: string) {
  const term = query.trim().slice(0, 120);
  if (!key || term.length < 2) return;
  try { localStorage.setItem(key, JSON.stringify([term, ...readRecentSearches(key).filter(value => value.toLowerCase() !== term.toLowerCase())].slice(0, 5))); } catch { /* Search works when local storage is unavailable. */ }
}
