import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { Card } from '@/shared/components/common/Card';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import type { ReportChartItem, ReportColumn, ReportDefinition, ReportKpi, ReportRow } from '../types/report';

const display = (value: number, format: ReportKpi['format'], currency: string) => format === 'currency' ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) : format === 'percent' ? `${value.toFixed(1)}%` : value.toLocaleString();
const cellDisplay = (value: string | number | boolean | null, format: ReportColumn['format'], currency: string) => {
  if (value == null || value === '') return '—';
  if (format === 'currency' && typeof value === 'number') return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  if (format === 'number' && typeof value === 'number') return value.toLocaleString();
  if (format === 'percent' && typeof value === 'number') return `${value.toFixed(1)}%`;
  return String(value).replace(/_/g, ' ');
};

export function ReportKpis({ items, currency }: { items: ReportKpi[]; currency: string }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <Card key={item.label} className="min-h-28"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{display(item.value, item.format, currency)}</p></Card>)}</div>;
}

export function ReportChart({ title, items, onSelect }: { title: string; items: ReportChartItem[]; onSelect: () => void }) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return <Card><div className="mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-blue-600" /><h2 className="font-semibold text-slate-900">{title}</h2></div>{items.length ? <div className="space-y-3">{items.map((item) => <button type="button" key={item.label} className="block w-full text-left" onClick={onSelect}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{item.label}</span><span className="font-semibold text-slate-900">{item.value.toLocaleString()}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, item.value / maximum * 100)}%` }} /></div></button>)}</div> : <EmptyState title="No chart data" message="No values match the current filters." />}</Card>;
}

export function ReportTable({ columns, rows, currency, detailRoute }: { columns: ReportColumn[]; rows: ReportRow[]; currency: string; detailRoute: string }) {
  if (!rows.length) return <EmptyState title="No results" message="No source records match the selected filters. Reset or widen the filters and try again." />;
  return <div id="report-results" className="report-print-area overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{column.label}</th>)}<th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Drill down</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">{columns.map((column) => <td key={column.key} className="max-w-72 whitespace-nowrap px-4 py-3 text-slate-700">{cellDisplay(row[column.key] ?? null, column.format, currency)}</td>)}<td className="px-4 py-3 text-right"><Link to={detailRoute} className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700">Open module <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div></div>;
}

export function ReportLinkCard({ report }: { report: ReportDefinition }) {
  return <Link to={`/reports/${report.category}/${report.id}`} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"><h3 className="font-semibold text-slate-900 group-hover:text-blue-700">{report.title}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{report.description}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">View report <ArrowRight size={13} /></span></Link>;
}
