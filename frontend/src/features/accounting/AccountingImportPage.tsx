import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { ImportWizard } from '@/shared/components/import/ImportWizard';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import type { ImportPreviewRow } from '@/shared/types/import-record';
import { accountingService } from './accountingService';

const columns = [
  { key: 'date', label: 'Date', required: true },
  { key: 'reference', label: 'Reference', required: true },
  { key: 'debitAccount', label: 'Debit account code', required: true },
  { key: 'creditAccount', label: 'Credit account code', required: true },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'notes', label: 'Notes' },
];

function csvRows(content: string) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const parse = (line: string) => {
    const result: string[] = [];
    let part = '';
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"' && quoted) {
        part += '"';
        index++;
      } else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) {
        result.push(part.trim());
        part = '';
      } else part += char;
    }
    result.push(part.trim());
    return result;
  };
  return lines.map(parse);
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return trimmed;
}

async function readRows(file: File): Promise<string[][]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv') {
    return csvRows(await file.text());
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date>>(worksheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  const nonEmptyRows = rawRows.filter(
    (row) => Array.isArray(row) && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
  );

  return nonEmptyRows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return '';
      if (cell instanceof Date) {
        if (!isNaN(cell.getTime())) {
          return cell.toISOString().slice(0, 10);
        }
        return '';
      }
      return String(cell).trim();
    })
  );
}

export function AccountingImportPage() {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { user } = useAuth();
  const client = useQueryClient();
  const scope = {
    tenantId: tenantId ?? '',
    branchId: branchId ?? '',
    permittedBranchIds: branches.map((branch) => branch.id),
  };
  const actor = { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' };

  const template = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['date', 'reference', 'debitAccount', 'creditAccount', 'amount', 'notes'],
      ['2026-09-28', 'JV-IMPORT-001', '6100', '1200', 250, 'Office costs'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'JournalTemplate');
    XLSX.writeFile(wb, 'journal-import-template.xlsx');
  };

  return (
    <PageContainer>
      <PageHeader
        title="Journal import"
        description="Map, validate, preview and import journal rows from CSV or Excel (.xlsx, .xls) files."
      />
      <ImportWizard
        title="Import journal drafts"
        columns={columns}
        onDownloadTemplate={template}
        prepareFile={async (file) => ({
          sourceColumns: (await readRows(file))[0] ?? [],
        })}
        previewFile={async (file, mapping) => {
          const [headers = [], ...data] = await readRows(file);
          const accounts = accountingService.accounts(scope.tenantId);
          const findAccount = (codeOrId: string) => {
            const normalized = codeOrId.trim().toLowerCase();
            return accounts.find(
              (account) =>
                account.code.toLowerCase() === normalized ||
                account.id.toLowerCase() === normalized ||
                account.name.toLowerCase() === normalized
            );
          };

          return data.map((row, index): ImportPreviewRow => {
            const values = Object.fromEntries(
              columns.map((column) => {
                const headerIdx = headers.indexOf(mapping[column.key]);
                const rawVal = headerIdx >= 0 ? row[headerIdx] ?? '' : '';
                return [column.key, rawVal];
              })
            );
            if (values.date) {
              values.date = normalizeDate(values.date);
            }
            const errors: ImportPreviewRow['errors'] = [];
            if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
              errors.push({ field: 'date', message: 'Use YYYY-MM-DD.' });
            }
            if (!values.reference?.trim()) {
              errors.push({ field: 'reference', message: 'Reference is required.' });
            }
            if (!findAccount(values.debitAccount)) {
              errors.push({ field: 'debitAccount', message: 'Debit account code was not found.' });
            }
            if (!findAccount(values.creditAccount)) {
              errors.push({ field: 'creditAccount', message: 'Credit account code was not found.' });
            }
            if (values.debitAccount && values.creditAccount && values.debitAccount.trim().toLowerCase() === values.creditAccount.trim().toLowerCase()) {
              errors.push({ field: 'creditAccount', message: 'The same account cannot be selected for both Debit and Credit lines within a single Journal Entry.' });
            }
            const cleanAmount = String(values.amount ?? '').replace(/[^\d.-]/g, '');
            const amountNum = Number(cleanAmount);
            if (!(amountNum > 0)) {
              errors.push({ field: 'amount', message: 'Amount must be positive.' });
            } else {
              const creditAcc = findAccount(values.creditAccount);
              if (creditAcc) {
                const available = accountingService.availableBalance(scope, creditAcc.id);
                const isRestricted = Boolean(creditAcc.cashKind) || (creditAcc.type === 'asset' && available > 0);
                if (isRestricted && amountNum > available) {
                  errors.push({
                    field: 'amount',
                    message: `Insufficient balance: Transfer amount (${amountNum.toFixed(2)}) exceeds available balance (${available.toFixed(2)}) for account ${creditAcc.name}.`,
                  });
                }
              }
            }
            return {
              rowNumber: index + 2,
              values,
              status: errors.length ? 'failed' : 'valid',
              errors,
            };
          });
        }}
        importRows={async (rows) => {
          let validRows = 0;
          const accounts = accountingService.accounts(scope.tenantId);
          const findAccount = (codeOrId: string) => {
            const normalized = codeOrId.trim().toLowerCase();
            return accounts.find(
              (account) =>
                account.code.toLowerCase() === normalized ||
                account.id.toLowerCase() === normalized ||
                account.name.toLowerCase() === normalized
            );
          };

          for (const row of rows.filter((item) => item.status === 'valid')) {
            const cleanAmount = String(row.values.amount ?? '').replace(/[^\d.-]/g, '');
            const amount = Number(cleanAmount);
            const debitAccount = findAccount(row.values.debitAccount);
            const creditAccount = findAccount(row.values.creditAccount);
            if (!debitAccount || !creditAccount) continue;

            accountingService.saveJournal(scope, actor, {
              branchId: scope.branchId,
              date: row.values.date,
              reference: row.values.reference.trim(),
              notes: row.values.notes?.trim() ?? '',
              attachments: [],
              lines: [
                { accountId: debitAccount.id, debit: amount, credit: 0 },
                { accountId: creditAccount.id, debit: 0, credit: amount },
              ],
            });
            validRows++;
          }
          await client.invalidateQueries({ queryKey: ['accounting'] });
          return {
            totalRows: rows.length,
            validRows,
            skippedRows: 0,
            failedRows: rows.length - validRows,
          };
        }}
      />
    </PageContainer>
  );
}
