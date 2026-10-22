import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { ImportWizard } from '@/shared/components/import/ImportWizard';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import type { ImportPreviewRow } from '@/shared/types/import-record';
import { accountingService } from './accountingService';

const columns = [
  { key: 'date', label: 'Date', required: true }, { key: 'reference', label: 'Reference', required: true },
  { key: 'debitAccount', label: 'Debit account code', required: true }, { key: 'creditAccount', label: 'Credit account code', required: true },
  { key: 'amount', label: 'Amount', required: true }, { key: 'notes', label: 'Notes' },
];
function csvRows(content: string) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const parse = (line: string) => { const result: string[] = []; let part = ''; let quoted = false; for (let index = 0; index < line.length; index++) { const char = line[index]; if (char === '"' && line[index + 1] === '"' && quoted) { part += '"'; index++; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { result.push(part.trim()); part = ''; } else part += char; } result.push(part.trim()); return result; };
  return lines.map(parse);
}
export function AccountingImportPage() {
  const { tenantId } = useTenant(); const { branchId, branches } = useBranch(); const { user } = useAuth(); const client = useQueryClient();
  const scope = { tenantId: tenantId ?? '', branchId: branchId ?? '', permittedBranchIds: branches.map((branch) => branch.id) };
  const actor = { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' };
  const read = async (file: File) => file.name.toLowerCase().endsWith('.csv') ? csvRows(await file.text()) : [columns.map((column) => column.key), ['2026-09-28', 'XLSX-PREVIEW-001', '6100', '1200', '250', 'Excel mock preview']];
  const template = () => { const blob = new Blob(['date,reference,debitAccount,creditAccount,amount,notes\n2026-09-28,JV-IMPORT-001,6100,1200,250,Office costs\n'], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'journal-import-template.csv'; anchor.click(); URL.revokeObjectURL(url); };
  return <PageContainer><PageHeader title="Journal import" description="Map, validate and preview journal rows. Excel files use a mock preview until a workbook parser is connected." /><ImportWizard title="Import journal drafts" columns={columns} onDownloadTemplate={template} prepareFile={async (file) => ({ sourceColumns: (await read(file))[0] ?? [] })} previewFile={async (file, mapping) => { const [headers, ...data] = await read(file); const accounts = accountingService.accounts(scope.tenantId); return data.map((row, index): ImportPreviewRow => { const values = Object.fromEntries(columns.map((column) => [column.key, row[headers.indexOf(mapping[column.key])] ?? ''])); const errors: ImportPreviewRow['errors'] = []; if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) errors.push({ field: 'date', message: 'Use YYYY-MM-DD.' }); if (!values.reference) errors.push({ field: 'reference', message: 'Reference is required.' }); if (!accounts.some((account) => account.code === values.debitAccount)) errors.push({ field: 'debitAccount', message: 'Debit account code was not found.' }); if (!accounts.some((account) => account.code === values.creditAccount)) errors.push({ field: 'creditAccount', message: 'Credit account code was not found.' }); if (!(Number(values.amount) > 0)) errors.push({ field: 'amount', message: 'Amount must be positive.' }); return { rowNumber: index + 2, values, status: errors.length ? 'failed' : 'valid', errors }; }); }} importRows={async (rows) => { let validRows = 0; for (const row of rows.filter((item) => item.status === 'valid')) { const accounts = accountingService.accounts(scope.tenantId); const amount = Number(row.values.amount); accountingService.saveJournal(scope, actor, { branchId: scope.branchId, date: row.values.date, reference: row.values.reference, notes: row.values.notes ?? '', attachments: [], lines: [{ accountId: accounts.find((item) => item.code === row.values.debitAccount)!.id, debit: amount, credit: 0 }, { accountId: accounts.find((item) => item.code === row.values.creditAccount)!.id, debit: 0, credit: amount }] }); validRows++; } await client.invalidateQueries({ queryKey: ['accounting'] }); return { totalRows: rows.length, validRows, skippedRows: 0, failedRows: rows.length - validRows }; }} /></PageContainer>;
}
