import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { usePermissions } from '@/core/permissions/permission-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { Button } from '@/shared/components/common/Button';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { PermissionDenied } from '@/shared/components/feedback/PermissionDenied';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { downloadCsv, downloadExcel } from '@/shared/utils/fileExport';
import { ReportFilters } from '../components/ReportFilters';
import { ReportChart, ReportKpis, ReportTable } from '../components/ReportWidgets';
import { useReport } from '../hooks/useReport';
import { findReport } from '../reportCatalog';
import type { ReportFilters as Filters, ReportRow } from '../types/report';

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
const defaults = (): Filters => ({ dateFrom: monthStart(), dateTo: today(), branchId: 'all' });

export function ReportDetailPage() {
  const { reportId = '' } = useParams();
  const definition = findReport(reportId);
  const { currentTenant } = useTenant();
  const { hasPermission } = usePermissions();
  const [filters, setFilters] = useState<Filters>(defaults);
  const [exporting, setExporting] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const query = useReport(reportId, filters);
  const canExport = definition ? hasPermission('reports.export') || hasPermission(`${definition.permission.replace('.view', '.export')}`) : false;
  const canPrint = hasPermission('reports.print');
  const currency = currentTenant?.currency ?? 'USD';
  const exportColumns = useMemo(() => query.data?.columns.map((column) => ({ header: column.label, value: (row: ReportRow) => row[column.key] })) ?? [], [query.data?.columns]);

  useEffect(() => {
    if (!definition) return;
    try { const current = JSON.parse(localStorage.getItem('quick-erp-recent-reports') ?? '[]') as string[]; localStorage.setItem('quick-erp-recent-reports', JSON.stringify([definition.id, ...current.filter((id) => id !== definition.id)].slice(0, 8))); } catch { /* storage can be unavailable */ }
  }, [definition]);

  if (!definition) return <Navigate to="/reports" replace />;
  if (!hasPermission(definition.permission)) return <PermissionDenied message="You do not have permission to view this report." />;
  const runExport = (kind: 'csv' | 'excel') => {
    if (!query.data || !canExport) return;
    setExporting(true);
    try { if (kind === 'csv') downloadCsv(`${definition.id}.csv`, exportColumns, query.data.rows); else downloadExcel(`${definition.id}.xls`, definition.title, exportColumns, query.data.rows); toast.success(`${kind === 'csv' ? 'CSV' : 'Excel-ready'} export created.`); } finally { window.setTimeout(() => setExporting(false), 200); }
  };
  return <PageContainer><div className="report-page" ref={resultsRef}><PageHeader title={definition.title} description={`${definition.description} Source: ${query.data?.sourceModules.join(', ') ?? 'existing ERP modules'}.`} actions={<div className="report-screen-actions flex flex-wrap gap-2">{canExport && <><Button size="sm" variant="secondary" isLoading={exporting} leftIcon={<Download size={15} />} onClick={() => runExport('csv')}>CSV</Button><Button size="sm" variant="secondary" isLoading={exporting} leftIcon={<FileSpreadsheet size={15} />} onClick={() => runExport('excel')}>Excel-ready</Button></>}{canPrint && <Button size="sm" variant="secondary" leftIcon={<Printer size={15} />} onClick={() => window.print()}>Print / PDF</Button>}</div>} />
    <div className="report-screen-actions"><ReportFilters definition={definition} value={filters} onChange={setFilters} onReset={() => setFilters(defaults())} /></div>
    <div className="mt-6 space-y-6">{query.isLoading ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton height={112} /><Skeleton height={112} /></div><Skeleton height={280} /></div> : query.error ? <ErrorState message={query.error instanceof Error ? query.error.message : 'Unable to load the report.'} onRetry={() => void query.refetch()} /> : query.data ? <><ReportKpis items={query.data.kpis} currency={currency} />{query.data.chart.length > 0 && <div className="report-screen-chart"><ReportChart title={`${definition.title} overview`} items={query.data.chart} onSelect={() => document.getElementById('report-results')?.scrollIntoView({ behavior: 'smooth' })} /></div>}<ReportTable columns={query.data.columns} rows={query.data.rows} currency={currency} detailRoute={definition.detailRoute} /><p className="text-xs text-slate-500">Generated {new Date(query.data.generatedAt).toLocaleString()} · {query.data.rows.length.toLocaleString()} rows · tenant and permitted branch scope enforced.</p></> : null}</div>
  </div></PageContainer>;
}
