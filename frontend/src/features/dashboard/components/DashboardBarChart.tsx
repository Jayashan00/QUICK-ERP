import { Card } from '@/shared/components/common/Card';
import { EmptyState } from '@/shared/components/feedback/EmptyState';

export interface DashboardChartItem { label: string; value: number; displayValue?: string }

export function DashboardBarChart({ title, subtitle, items }: { title: string; subtitle?: string; items: DashboardChartItem[] }) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return <Card><div className="mb-5"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{items.length === 0 ? <EmptyState title="No chart data" message="There is no activity for the selected branch." /> : <div className="space-y-4">{items.map((item) => <div key={item.label}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{item.label}</span><span className="font-semibold text-slate-900">{item.displayValue ?? item.value.toLocaleString()}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, (item.value / maximum) * 100)}%` }} /></div></div>)}</div>}</Card>;
}
