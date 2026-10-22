import { hasPermission } from '@/core/permissions';
import type { DashboardChartData } from '../types/dashboard';
import type { ModuleDashboardContext, ModuleDashboardRequest, ModuleRecord } from '../types/moduleDashboard';
import { dateKey } from './period';

export function dashboardContext(request: ModuleDashboardRequest): ModuleDashboardContext {
  const { tenantId, branchId, permittedBranchIds, dateFrom, dateTo, permissions } = request;
  if (!tenantId || tenantId === 'platform' || !branchId || !permittedBranchIds.includes(branchId)) throw new Error('Choose a permitted tenant branch.');
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(dateFrom) || !valid(dateTo) || dateFrom > dateTo) throw new Error('Choose a valid dashboard date range.');
  if (Date.parse(dateTo) - Date.parse(dateFrom) > 3660 * 86400000) throw new Error('Choose a date range of ten years or less.');
  return {
    request, scope: { tenantId, branchId, permittedBranchIds: [branchId] },
    params: { branchId, permittedBranchIds: [branchId], page: 1, pageSize: Number.MAX_SAFE_INTEGER },
    can: permission => hasPermission(permissions, permission),
    inPeriod: date => date.slice(0, 10) >= dateFrom && date.slice(0, 10) <= dateTo,
    today: dateKey(new Date()), output: { metrics: [], charts: [], lists: [], workflow: [] },
  };
}
export const sum = <T,>(rows: T[], value: (row: T) => number) => Math.round(rows.reduce((total, row) => total + value(row), 0) * 100) / 100;
export const humanize = (value: string) => value.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase());
export function group<T>(rows: T[], label: (row: T) => string, value: (row: T) => number = () => 1): DashboardChartData[] {
  const groups = new Map<string, number>();
  rows.forEach(row => { const key = label(row); groups.set(key, (groups.get(key) ?? 0) + value(row)); });
  return [...groups].map(([label, value]) => ({ label: humanize(label), value: Math.round(value * 100) / 100 }));
}
export const ranked = (rows: DashboardChartData[]) => [...rows].sort((a, b) => b.value - a.value).slice(0, 5);
export function timeSeries<T>(context: ModuleDashboardContext, rows: T[], date: (row: T) => string, value: (row: T) => number = () => 1, secondary?: (row: T) => number): DashboardChartData[] {
  const { dateFrom, dateTo } = context.request;
  const monthly = Date.parse(dateTo) - Date.parse(dateFrom) > 62 * 86400000;
  const buckets = new Map<string, DashboardChartData>();
  for (const day = new Date(`${dateFrom}T00:00:00Z`); day.toISOString().slice(0, 10) <= dateTo; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = day.toISOString().slice(0, monthly ? 7 : 10);
    buckets.set(key, { label: key, value: 0, ...(secondary ? { secondary: 0 } : {}) });
  }
  rows.filter(row => context.inPeriod(date(row))).forEach(row => {
    const bucket = buckets.get(date(row).slice(0, monthly ? 7 : 10));
    if (bucket) { bucket.value += value(row); if (secondary) bucket.secondary = (bucket.secondary ?? 0) + secondary(row); }
  });
  return [...buckets.values()].map(row => ({ ...row, value: Math.round(row.value * 100) / 100, ...(secondary ? { secondary: Math.round((row.secondary ?? 0) * 100) / 100 } : {}) }));
}
export function recordLink(path: string, id: string, reference?: string) {
  return `${path}?record=${encodeURIComponent(id)}${reference ? `&reference=${encodeURIComponent(reference)}` : ''}`;
}
export function addList(context: ModuleDashboardContext, title: string, records: ModuleRecord[], options: { subtitle?: string; emptyMessage?: string; to?: string; wide?: boolean } = {}) {
  context.output.lists.push({ title, records: records.slice(0, 5), subtitle: options.subtitle ?? 'Current work in the active branch', emptyMessage: options.emptyMessage ?? 'No records require attention.', to: options.to, wide: options.wide });
}
