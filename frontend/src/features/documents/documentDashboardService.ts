import { documentService } from './documentService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregateDocumentDashboard(context: ModuleDashboardContext) {
  const { scope, can, output, inPeriod, request } = context;
  if (!can('documents.view')) return;
  // The document service applies sensitive-file access before aggregating.
  const rows = documentService.list(scope, request.permissions, { branchId: scope.branchId, pageSize: Number.MAX_SAFE_INTEGER }).data;
  const categories = documentService.categories(scope);
  const selected = rows.filter(row => inPeriod(row.uploadedAt));
  const expiring = rows.filter(row => documentService.expiryStatus(row) === 'expiring');
  const expired = rows.filter(row => documentService.expiryStatus(row) === 'expired');
  output.metrics = [
    { label: 'Total documents', value: rows.length, description: 'Current visible, active documents' },
    { label: 'Uploads in period', value: selected.length, description: 'Uploaded in selected period' },
    { label: 'Expiring soon', value: expiring.length, description: 'Current document expiry rules' },
    { label: 'Expired', value: expired.length, description: 'Current document expiry rules' },
  ];
  output.charts = [
    { id: 'uploads', title: 'Upload Activity', subtitle: 'Visible document uploads in selected period', kind: 'area', wide: true, data: timeSeries(context, selected, row => row.uploadedAt), emptyMessage: 'No documents uploaded for this period.' },
    { id: 'expiry', title: 'Document Expiry', subtitle: 'Current expiry status for visible documents', kind: 'donut', data: group(rows, row => documentService.expiryStatus(row)) },
    { id: 'category', title: 'Documents by Category', subtitle: 'Current visible documents by category', data: group(rows, row => categories.find(category => category.id === row.category)?.name ?? row.category) },
    { id: 'module', title: 'Documents by Module', subtitle: 'Current linked-document ownership', data: group(rows, row => row.entityType) },
  ];
  addList(context, 'Expiring Documents', [...expired, ...expiring].sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')).map(row => ({ id: row.id, title: row.title, description: `${row.entityType} / ${row.entityReference}`, date: row.expiryDate, status: documentService.expiryStatus(row), to: `/documents?record=${row.id}` })), { emptyMessage: 'No expired or expiring documents.' });
  addList(context, 'Recently Uploaded', [...selected].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map(row => ({ id: row.id, title: row.title, description: `${row.uploadedBy} / ${row.entityReference}`, date: row.uploadedAt, status: row.sensitive ? 'restricted' : undefined, to: `/documents?record=${row.id}` })), { subtitle: 'Latest 5 uploads in selected period', wide: true, emptyMessage: 'No uploads for this period.' });
}
