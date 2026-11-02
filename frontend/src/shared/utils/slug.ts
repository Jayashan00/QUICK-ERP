export function toUrlSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
}

export function toUniqueUrlSlug(value: string, existingSlugs: Iterable<string>): string {
  const base = toUrlSlug(value);
  const reserved = new Set(existingSlugs);
  if (!reserved.has(base)) return base;
  let suffix = 2;
  while (reserved.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
