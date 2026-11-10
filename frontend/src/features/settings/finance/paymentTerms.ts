import type { PaymentTerm } from './types/tenant-settings';

export function matchPaymentTerm(terms: PaymentTerm[], value?: string | number) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  const netDays = /^net\s+(\d+)$/i.exec(String(value).trim())?.[1];
  return terms.find((term) =>
    term.code.toLowerCase() === normalized
    || term.name.toLowerCase() === normalized
    || String(term.dueDays) === normalized
    || (netDays !== undefined && term.dueDays === Number(netDays))
  );
}

export function addPaymentTermDays(date: string, dueDays: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + dueDays);
  return value.toISOString().slice(0, 10);
}
