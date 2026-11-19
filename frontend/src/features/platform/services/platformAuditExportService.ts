import type { PlatformAuditEvent } from '@/features/platform/types/platform';
import { downloadCsv, downloadExcel, type ExportColumn } from '@/shared/utils/fileExport';

const columns: ExportColumn<PlatformAuditEvent>[] = [
  { header: 'Date and Time', value: (row) => row.createdAt },
  { header: 'Actor Name', value: (row) => row.actorName },
  { header: 'Actor Email', value: (row) => row.actorEmail ?? 'admin@quickerp.cloud' },
  { header: 'Action', value: (row) => row.action },
  { header: 'Entity Type', value: (row) => row.entityType },
  { header: 'Entity Reference', value: (row) => row.reference },
  { header: 'Entity ID', value: (row) => row.entityId },
  { header: 'Description', value: (row) => row.description },
];

export const platformAuditExportService = {
  export(events: PlatformAuditEvent[], format: 'csv' | 'excel'): number {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      downloadCsv(`platform-audit-${stamp}.csv`, columns, events);
    } else {
      downloadExcel(`platform-audit-${stamp}.xls`, 'Platform Audit Log', columns, events);
    }
    return events.length;
  },
};
