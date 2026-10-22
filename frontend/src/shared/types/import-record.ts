export type ImportRowStatus = 'valid' | 'skipped' | 'failed';

export interface ImportRowError {
  field: string;
  message: string;
}

export interface ImportColumnDefinition {
  key: string;
  label: string;
  required?: boolean;
}

export type ImportFieldMapping = Record<string, string>;

export interface ImportPreviewRow {
  rowNumber: number;
  values: Record<string, string>;
  status: ImportRowStatus;
  errors: ImportRowError[];
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  failedRows: number;
}
