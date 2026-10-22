import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Clock3, Search } from 'lucide-react';
import { ModuleDashboardPanel } from '@/features/dashboard/components/ModuleDashboard';
import { usePermissions } from '@/core/permissions/permission-context';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { reportCatalog, reportCategories } from '../reportCatalog';
import { ReportLinkCard } from '../components/ReportWidgets';

function recentIds() {
  try { return JSON.parse(localStorage.getItem('quick-erp-recent-reports') ?? '[]') as string[]; } catch { return []; }
}

export function ReportsDashboardPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const visibleCategories = reportCategories.filter(category => hasPermission(category.permission));
  const visibleReports = reportCatalog.filter(report => hasPermission(report.permission));
  const recent = recentIds().map(id => visibleReports.find(report => report.id === id)).filter(report => report !== undefined).slice(0, 4);
  const query = search.trim().toLowerCase();
  const matchingReports = query
    ? visibleReports.filter(report => `${report.title} ${report.description} ${report.category}`.toLowerCase().includes(query))
    : visibleReports;

  return (
    <PageContainer>
      <div className="space-y-8">
        <header className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-800 to-blue-950 px-6 py-7 text-white shadow-sm sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Business intelligence</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Reports &amp; analytics</h1>
              <p className="mt-3 text-sm leading-6 text-blue-100 sm:text-base">Explore live reports across the parts of your business you can access.</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-5 py-3">
              <p className="text-sm text-blue-100">Available reports</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{visibleReports.length}</p>
            </div>
          </div>
        </header>

        {!visibleCategories.length ? <EmptyState title="No reports available" message="Your permissions do not provide access to tenant operational reports." /> : (
          <>
            <ModuleDashboardPanel module="reports" />

            <section aria-labelledby="report-categories-heading">
              <div className="mb-4">
                <h2 id="report-categories-heading" className="text-xl font-semibold text-slate-900">Browse by category</h2>
                <p className="mt-1 text-sm text-slate-500">Choose an area to see all its reports.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {visibleCategories.map(category => {
                  const count = visibleReports.filter(report => report.category === category.id).length;
                  return <Link key={category.id} to={`/reports/${category.id}`} className="group flex min-h-36 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                    <div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><BarChart3 size={20} aria-hidden="true" /></span><ArrowRight size={18} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" aria-hidden="true" /></div>
                    <h3 className="mt-4 font-semibold text-slate-900 group-hover:text-blue-700">{category.label}</h3>
                    <p className="mt-1 text-sm text-slate-500">{count} {count === 1 ? 'report' : 'reports'}</p>
                  </Link>;
                })}
              </div>
            </section>

            {recent.length > 0 && <section aria-labelledby="recent-reports-heading">
              <div className="mb-4 flex items-center gap-2"><Clock3 size={20} className="text-blue-700" aria-hidden="true" /><h2 id="recent-reports-heading" className="text-xl font-semibold text-slate-900">Recently viewed</h2></div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{recent.map(report => <ReportLinkCard key={report.id} report={report} />)}</div>
            </section>}

            <section aria-labelledby="all-reports-heading">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div><h2 id="all-reports-heading" className="text-xl font-semibold text-slate-900">All reports</h2><p className="mt-1 text-sm text-slate-500">Find the report you need by name or topic.</p></div>
                <label className="relative w-full sm:w-80"><span className="sr-only">Search reports</span><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search reports" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-200" /></label>
              </div>
              {matchingReports.length === 0 ? <EmptyState title="No matching reports" message="Try another report name or topic." /> : (
                <div className="space-y-7">
                  {visibleCategories.map(category => {
                    const reports = matchingReports.filter(report => report.category === category.id);
                    if (!reports.length) return null;
                    return <div key={category.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-slate-900">{category.label}</h3><p className="text-sm text-slate-500">{reports.length} {reports.length === 1 ? 'report' : 'reports'} available</p></div><Link to={`/reports/${category.id}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">View all <ArrowRight size={16} aria-hidden="true" /></Link></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(query ? reports : reports.slice(0, 3)).map(report => <ReportLinkCard key={report.id} report={report} />)}</div></div>;
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageContainer>
  );
}
