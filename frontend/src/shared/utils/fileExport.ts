export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function escapeCsvValue(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(content: BlobPart, mimeType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv<T>(fileName: string, columns: ExportColumn<T>[], rows: T[]) {
  const lines = [
    columns.map((column) => escapeCsvValue(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row))).join(',')),
  ];
  downloadBlob(`\uFEFF${lines.join('\n')}`, 'text/csv;charset=utf-8', fileName);
}

function escapeHtml(value: unknown) {
  return (value == null ? '' : String(value))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Frontend-only Excel-compatible HTML workbook. Replace with an API-generated XLSX later. */
export function downloadExcel<T>(fileName: string, sheetName: string, columns: ExportColumn<T>[], rows: T[]) {
  const header = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`).join('');
  const workbook = `<html><head><meta charset="utf-8"></head><body><table data-sheet="${escapeHtml(sheetName)}"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  downloadBlob(workbook, 'application/vnd.ms-excel;charset=utf-8', fileName);
}
