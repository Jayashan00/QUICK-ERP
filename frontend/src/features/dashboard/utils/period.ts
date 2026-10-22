import type { DashboardPeriod, DashboardTrend } from '../types/dashboard';
export const dashboardPeriods: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Today' }, { value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' }, { value: 'year', label: 'This Year' }, { value: 'custom', label: 'Custom Range' },
];
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function periodRange(period: DashboardPeriod, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (period === 'month') start.setDate(1);
  if (period === 'quarter') { start.setDate(1); start.setMonth(Math.floor(start.getMonth() / 3) * 3); }
  if (period === 'year') { start.setDate(1); start.setMonth(0); }
  return { dateFrom: dateKey(start), dateTo: dateKey(now) };
}
export function previousRange(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  return { dateFrom: new Date(start - days * 86400000).toISOString().slice(0, 10), dateTo: new Date(start - 86400000).toISOString().slice(0, 10) };
}
export function trend(current: number, previous: number): DashboardTrend {
  return { value: previous === 0 ? current === 0 ? 'No change' : 'New activity' : `${((current - previous) / previous * 100).toFixed(1)}%`, trend: current > previous ? 'up' : current < previous ? 'down' : 'neutral', label: 'vs previous equal-length period' };
}
