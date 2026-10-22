import type { ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SummaryCard } from '@/shared/components/cards/SummaryCard';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import type { DashboardChartData } from '../types/dashboard';

const colors = ['#2563eb', '#64748b', '#d97706', '#dc2626', '#0284c7'];
interface Props { title: string; subtitle: string; data: DashboardChartData[]; kind?: 'area' | 'bar' | 'donut'; currency?: string; action?: ReactNode; className?: string; emptyMessage?: string; primaryLabel?: string; secondaryLabel?: string; valueFormatter?: (value: number) => string }
export function DashboardChartCard({ title, subtitle, data, kind = 'bar', currency, action, className, emptyMessage = 'No records available for this scope.', primaryLabel = currency ? 'Amount' : 'Records', secondaryLabel, valueFormatter }: Props) {
  const format = (value: number) => valueFormatter ? valueFormatter(value) : currency ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) : value.toLocaleString();
  const axis = (value: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const tooltip = <Tooltip formatter={(value, name) => [format(Number(value)), name === 'secondary' ? secondaryLabel : kind === 'donut' ? String(name) : primaryLabel]} contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }} />;
  return <SummaryCard title={title} subtitle={subtitle} action={action} className={className}>
    {!data.some(row => row.value !== 0 || (row.secondary ?? 0) !== 0) ? <EmptyState title="No activity" message={emptyMessage} /> : <>
      <div className="h-64 min-w-0" role="img" aria-label={`${title}. ${data.map(row => `${row.label}: ${primaryLabel} ${format(row.value)}${secondaryLabel ? `, ${secondaryLabel} ${format(row.secondary ?? 0)}` : ''}`).join('; ')}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {kind === 'area' ? <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
            <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={36} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={value => /^\d{4}-/.test(String(value)) ? new Intl.DateTimeFormat(undefined, { month: 'short', ...(String(value).length > 7 ? { day: 'numeric' as const } : { year: '2-digit' as const }), timeZone: 'UTC' }).format(new Date(`${value}${String(value).length === 7 ? '-01' : ''}T00:00:00Z`)) : String(value)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={axis} width={48} />
            {tooltip}<Area type="monotone" dataKey="value" stroke="#2563eb" fill="#eff6ff" strokeWidth={2} isAnimationActive={false} />{secondaryLabel && <Area type="monotone" dataKey="secondary" stroke="#64748b" fill="#f8fafc" strokeWidth={2} isAnimationActive={false} />}
          </AreaChart> : kind === 'donut' ? <PieChart accessibilityLayer>{tooltip}<Pie data={data} dataKey="value" nameKey="label" innerRadius={60} outerRadius={86} paddingAngle={2} isAnimationActive={false}>{data.map((row, index) => <Cell key={row.label} fill={colors[index % colors.length]} />)}</Pie></PieChart> : <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} accessibilityLayer>
            <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={axis} tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis type="category" dataKey="label" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} />
            {tooltip}<Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false} />{secondaryLabel && <Bar dataKey="secondary" fill="#64748b" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false} />}
          </BarChart>}
        </ResponsiveContainer>
      </div>
      {secondaryLabel && <p className="mt-2 text-xs text-slate-600">Blue: {primaryLabel} / Gray: {secondaryLabel}</p>}
      {kind === 'donut' && <dl className="mt-2 grid gap-2 text-xs">{data.map((row, index) => <div key={row.label} className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 capitalize text-slate-600"><span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{row.label}</dt><dd className="font-semibold text-slate-900">{format(row.value)}</dd></div>)}</dl>}
      <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer rounded focus-visible:outline-blue-600">View chart values</summary><dl className="mt-3 grid gap-2 sm:grid-cols-2">{data.map(row => <div key={row.label} className="flex justify-between gap-3"><dt className="capitalize">{row.label}</dt><dd className="font-semibold text-slate-900">{format(row.value)}{secondaryLabel && ` / ${format(row.secondary ?? 0)}`}</dd></div>)}</dl></details>
    </>}
  </SummaryCard>;
}
