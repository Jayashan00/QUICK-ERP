import { auditEventService, type AuditAccessScope, type AuditFilters, type TenantAuditEntry } from '@/core/audit';
import { downloadCsv, downloadExcel, type ExportColumn } from '@/shared/utils/fileExport';

const columns: ExportColumn<TenantAuditEntry>[] = [
  { header: 'Date and time', value: (row) => row.createdAt },
  { header: 'User', value: (row) => row.actorName },
  { header: 'Module', value: (row) => row.module },
  { header: 'Action', value: (row) => row.action },
  { header: 'Entity', value: (row) => row.entityType },
  { header: 'Reference', value: (row) => row.reference },
  { header: 'Branch ID', value: (row) => row.branchId },
  { header: 'Description', value: (row) => row.description },
  { header: 'Remarks', value: (row) => row.remarks },
  { header: 'Sensitivity', value: (row) => row.sensitivity },
  { header: 'Previous values', value: (row) => row.previousValues ? JSON.stringify(row.previousValues) : '' },
  { header: 'New values', value: (row) => row.newValues ? JSON.stringify(row.newValues) : '' },
];

export const auditExportService = {
  async export(scope: AuditAccessScope, filters: AuditFilters, format: 'csv' | 'excel') {
    const rows = await auditEventService.listForExport(scope, filters);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') downloadCsv(`tenant-audit-${stamp}.csv`, columns, rows);
    else downloadExcel(`tenant-audit-${stamp}.xls`, 'Audit Log', columns, rows);
    return rows.length;
  },
};
