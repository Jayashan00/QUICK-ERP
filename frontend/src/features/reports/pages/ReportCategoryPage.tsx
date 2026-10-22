import { Navigate, useParams } from 'react-router-dom';
import { usePermissions } from '@/core/permissions/permission-context';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PermissionDenied } from '@/shared/components/feedback/PermissionDenied';
import { reportCatalog, reportCategories } from '../reportCatalog';
import { ReportLinkCard } from '../components/ReportWidgets';
import type { ReportCategory } from '../types/report';

export function ReportCategoryPage() {
  const { category = '' } = useParams();
  const { hasPermission } = usePermissions();
  const meta = reportCategories.find((item) => item.id === category);
  if (!meta) return <Navigate to="/reports" replace />;
  if (!hasPermission(meta.permission)) return <PermissionDenied message="You do not have permission to view this report category." />;
  const reports = reportCatalog.filter((report) => report.category === category as ReportCategory);
  return <PageContainer><PageHeader title={meta.label} description={`${reports.length} tenant reports derived from the existing operational module services.`} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reports.map((report) => <ReportLinkCard key={report.id} report={report} />)}</div></PageContainer>;
}
