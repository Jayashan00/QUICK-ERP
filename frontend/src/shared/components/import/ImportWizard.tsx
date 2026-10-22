import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { FileUpload } from '@/shared/components/forms/FileUpload';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { appToast } from '@/shared/utils/toast';
import type { ImportColumnDefinition, ImportFieldMapping, ImportPreviewRow, ImportSummary } from '@/shared/types/import-record';

type ImportStep = 'upload' | 'mapping' | 'validate' | 'preview' | 'summary';

export interface ImportWizardProps {
  title?: string;
  columns: ImportColumnDefinition[];
  prepareFile: (file: File) => Promise<{ sourceColumns: string[] }>;
  previewFile: (file: File, mapping: ImportFieldMapping) => Promise<ImportPreviewRow[]>;
  importRows: (rows: ImportPreviewRow[]) => Promise<ImportSummary>;
  onDownloadTemplate?: () => void;
}

function summarize(rows: ImportPreviewRow[]): ImportSummary {
  return { totalRows: rows.length, validRows: rows.filter((row) => row.status === 'valid').length, skippedRows: rows.filter((row) => row.status === 'skipped').length, failedRows: rows.filter((row) => row.status === 'failed').length };
}

export function ImportWizard({ title = 'Import Records', columns, prepareFile, previewFile, importRows, onDownloadTemplate }: ImportWizardProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportFieldMapping>({});
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const previewSummary = useMemo(() => summarize(rows), [rows]);

  const reset = () => { setStep('upload'); setFile(null); setFileError(null); setSourceColumns([]); setMapping({}); setRows([]); setResult(null); };
  const selectFile = (selected: File) => {
    const extension = selected.name.split('.').pop()?.toLocaleLowerCase();
    if (!extension || !['csv', 'xlsx', 'xls'].includes(extension)) { setFile(null); setFileError('Select a CSV, XLSX or XLS file.'); return; }
    setFile(selected); setFileError(null);
  };
  const prepare = async () => {
    if (!file) { setFileError('Select a CSV or Excel file.'); return; }
    setBusy(true);
    try {
      const prepared = await prepareFile(file);
      setSourceColumns(prepared.sourceColumns);
      setMapping(Object.fromEntries(columns.map((column) => [column.key, prepared.sourceColumns.find((source) => source.toLocaleLowerCase().replace(/[^a-z0-9]/g, '') === column.key.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')) ?? ''])));
      setStep('mapping');
    } catch (error) { setFileError(error instanceof Error ? error.message : 'Unable to read the selected file.'); }
    finally { setBusy(false); }
  };
  const validate = async () => {
    if (!file) return;
    const missing = columns.find((column) => column.required && !mapping[column.key]);
    if (missing) { appToast.error(`Map the required ${missing.label} field.`); return; }
    setStep('validate');
    try { setRows(await previewFile(file, mapping)); setStep('preview'); }
    catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to validate import rows.'); setStep('mapping'); }
  };
  const complete = async () => {
    setBusy(true);
    try { const summary = await importRows(rows); setResult(summary); setStep('summary'); appToast.success(`${summary.validRows} valid product row(s) imported.`); }
    catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to complete the import.'); }
    finally { setBusy(false); }
  };
  const downloadErrors = () => {
    const csv = ['Row,Field,Error', ...rows.filter((row) => row.errors.length).flatMap((row) => row.errors.map((error) => `${row.rowNumber},"${error.field.replace(/"/g, '""')}","${error.message.replace(/"/g, '""')}"`))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'import-errors.csv'; anchor.click(); URL.revokeObjectURL(url); appToast.success('Import error report downloaded.');
  };
  const summary = result ?? previewSummary;

  return <Card>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-900">{title}</h3><p className="text-xs text-slate-500">Upload → Map columns → Validate → Preview → Import summary</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">{step}</span></div>
    {step === 'upload' && <div className="space-y-4"><div className="rounded-lg border border-dashed border-slate-300 p-6 text-center"><Upload className="mx-auto mb-3 text-slate-400" /><FileUpload id="import-file" className="justify-center" accept=".csv,.xls,.xlsx" maxSizeMb={5} selectedFileName={file?.name} error={fileError ?? undefined} onError={setFileError} onFileSelect={selectFile} /><p className="mt-3 text-xs text-slate-500">CSV, XLSX or XLS. Maximum file size: 5 MB.</p></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="secondary" leftIcon={<Download size={15} />} onClick={onDownloadTemplate}>Download Template</Button><Button isLoading={busy} onClick={() => void prepare()}>Continue to Mapping</Button></div></div>}
    {step === 'mapping' && <div className="space-y-5"><div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">Map file columns to the required import fields before validation.</div><div className="grid gap-4 sm:grid-cols-2">{columns.map((column) => <FormField key={column.key} label={column.label} required={column.required}><Select value={mapping[column.key] ?? ''} onChange={(event) => setMapping((current) => ({ ...current, [column.key]: event.target.value }))} placeholder="Do not import" options={sourceColumns.map((source) => ({ value: source, label: source }))} /></FormField>)}</div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="secondary" onClick={reset}>Start Over</Button><Button onClick={() => void validate()}>Validate Rows</Button></div></div>}
    {step === 'validate' && <div className="flex flex-col items-center py-10 text-sm text-slate-600" role="status" aria-live="polite"><span className="mb-3 size-7 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" aria-hidden="true" />Validating identifiers, references and row values…</div>}
    {step === 'preview' && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 size={18} /><div className="mt-2 text-2xl font-bold">{summary.validRows}</div><div className="text-xs">Valid</div></div><div className="rounded-lg bg-amber-50 p-4 text-amber-800"><FileSpreadsheet size={18} /><div className="mt-2 text-2xl font-bold">{summary.skippedRows}</div><div className="text-xs">Skipped</div></div><div className="rounded-lg bg-red-50 p-4 text-red-800"><XCircle size={18} /><div className="mt-2 text-2xl font-bold">{summary.failedRows}</div><div className="text-xs">Failed</div></div></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="data-table"><thead><tr><th>Row</th><th>Values</th><th>Status</th><th>Field Errors</th></tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber} className={row.status === 'valid' ? 'bg-emerald-50/30' : row.status === 'failed' ? 'bg-red-50/30' : 'bg-amber-50/30'}><td>{row.rowNumber}</td><td>{Object.values(row.values).filter(Boolean).join(' · ')}</td><td><StatusBadge status={row.status} /></td><td>{row.errors.length ? <ul className="space-y-1 text-xs text-red-700">{row.errors.map((error, index) => <li key={`${error.field}-${index}`}><span className="font-semibold">{error.field}:</span> {error.message}</li>)}</ul> : <span className="text-xs text-emerald-700">Ready to import</span>}</td></tr>)}</tbody></table></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button variant="secondary" onClick={reset}>Start Over</Button>{summary.failedRows + summary.skippedRows > 0 && <Button variant="secondary" leftIcon={<Download size={15} />} onClick={downloadErrors}>Download Error Report</Button>}</div><Button isLoading={busy} disabled={summary.validRows === 0} onClick={() => void complete()}>Import Valid Rows</Button></div></div>}
    {step === 'summary' && <div className="space-y-5"><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Import completed in frontend mock storage. The flow is ready to map to a backend import job later.</div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 size={18} /><div className="mt-2 text-2xl font-bold">{summary.validRows}</div><div className="text-xs">Imported</div></div><div className="rounded-lg bg-amber-50 p-4 text-amber-800"><FileSpreadsheet size={18} /><div className="mt-2 text-2xl font-bold">{summary.skippedRows}</div><div className="text-xs">Skipped</div></div><div className="rounded-lg bg-red-50 p-4 text-red-800"><XCircle size={18} /><div className="mt-2 text-2xl font-bold">{summary.failedRows}</div><div className="text-xs">Failed</div></div></div><div className="flex justify-end"><Button variant="secondary" onClick={reset}>Import Another File</Button></div></div>}
  </Card>;
}
