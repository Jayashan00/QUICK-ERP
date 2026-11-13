import { getTenantTaxRates, isSalesTaxApplicable } from '@/features/settings/finance/tax';
import type { ImportColumnDefinition, ImportFieldMapping, ImportPreviewRow, ImportRowError, ImportSummary } from '@/shared/types/import-record';
import * as XLSX from 'xlsx';
import { productFormSchema, type ProductFormValues } from '../schemas/productSchema';
import { masterDataStore } from './masterDataStore';
import { productService } from './productService';
import { productStore } from './productStore';
import { productVariantStore } from './productVariantStore';

type RawRow = Record<string, string>;

export const productImportColumns: ImportColumnDefinition[] = [
  { key: 'type', label: 'Type (goods or service)', required: true },
  { key: 'name', label: 'Product or Service Name', required: true },
  { key: 'shortName', label: 'Short Name' },
  { key: 'status', label: 'Status', required: true },
  { key: 'category', label: 'Category ID / Code / Name', required: true },
  { key: 'brand', label: 'Brand ID / Code / Name' },
  { key: 'internalCode', label: 'Internal Code' },
  { key: 'barcodeType', label: 'Barcode Format' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'description', label: 'Description' },
  { key: 'costPrice', label: 'Purchase / Cost Price' },
  { key: 'sellingPrice', label: 'Selling or Service Price', required: true },
  { key: 'taxCode', label: 'Sales Tax Code' },
  { key: 'pricesIncludeTax', label: 'Price Includes Tax' },
  { key: 'isSellable', label: 'Available for Sales' },
  { key: 'isPurchasable', label: 'Available for Purchasing' },
  { key: 'uom', label: 'UOM ID / Code / Name' },
  { key: 'trackInventory', label: 'Track Inventory' },
  { key: 'allowNegativeStock', label: 'Allow Negative Stock' },
  { key: 'minStockLevel', label: 'Minimum Stock' },
  { key: 'reorderLevel', label: 'Reorder Level' },
  { key: 'maxStockLevel', label: 'Maximum Stock' },
  { key: 'trackByBatch', label: 'Track by Batch' },
  { key: 'trackBySerialNumber', label: 'Track by Serial Number' },
  { key: 'trackExpiry', label: 'Track Expiry' },
];

const sourceColumns = productImportColumns.map((column) => column.key);

const templateRows: RawRow[] = [
  {
    type: 'goods', name: 'Sample Product', shortName: 'Sample item', status: 'draft', category: 'ELEC', brand: 'NORTH', internalCode: 'INTERNAL-001',
    barcodeType: 'CODE128', barcode: 'SAMPLE-PROD-001', description: 'Replace this example with a product.', costPrice: '1000', sellingPrice: '1500',
    taxCode: 'VAT18', pricesIncludeTax: 'false', isSellable: 'true', isPurchasable: 'true', uom: 'UNIT', trackInventory: 'true',
    allowNegativeStock: 'false', minStockLevel: '5', reorderLevel: '10', maxStockLevel: '100', trackByBatch: 'false', trackBySerialNumber: 'false', trackExpiry: 'false',
  },
  {
    type: 'service', name: 'Sample Service', shortName: 'Sample service', status: 'draft', category: 'SRV', brand: '', internalCode: 'SERVICE-001',
    barcodeType: '', barcode: '', description: 'Replace this example with a service.', costPrice: '', sellingPrice: '5000', taxCode: '', pricesIncludeTax: '',
    isSellable: 'true', isPurchasable: '', uom: '', trackInventory: '', allowNegativeStock: '', minStockLevel: '', reorderLevel: '', maxStockLevel: '',
    trackByBatch: '', trackBySerialNumber: '', trackExpiry: '',
  },
];

function escapeCsv(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildProductImportTemplateCsv() {
  return [sourceColumns, ...templateRows.map((row) => sourceColumns.map((column) => row[column] ?? ''))]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');
}

function requireTenant(tenantId: string) {
  if (!tenantId.trim()) throw new Error('Tenant context is required.');
  return tenantId;
}

function parseCsvLine(line: string) {
  const values: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += character;
  }
  values.push(value.trim()); return values;
}

async function readRows(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase();
  if (extension === 'csv') {
    const lines = (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error('The CSV file must include a header and at least one data row.');
    const headers = parseCsvLine(lines[0]);
    return { headers, rows: lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    }) };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  } catch {
    throw new Error('The Excel workbook could not be read. Upload a valid XLSX or XLS file.');
  }
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!worksheet) throw new Error('The Excel workbook must contain at least one worksheet.');
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(worksheet, { header: 1, defval: '', raw: true });
  const nonEmptyRows = matrix.filter((row) => row.some((value) => String(value).trim()));
  if (nonEmptyRows.length < 2) throw new Error('The first worksheet must include a header and at least one data row.');
  const headers = nonEmptyRows[0].map((value) => String(value).trim());
  if (headers.some((header) => !header)) throw new Error('Every imported Excel column must have a header in the first row.');
  return {
    headers,
    rows: nonEmptyRows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? '').trim()]))),
  };
}

function resolveReference<T extends { id: string; code: string; name: string; tenantId: string; isActive: boolean }>(records: T[], tenantId: string, value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  if (!normalized) return undefined;
  return records.find((item) => item.tenantId === tenantId && item.isActive && [item.id, item.code, item.name].some((candidate) => candidate.toLocaleLowerCase() === normalized));
}

function mapped(raw: RawRow, mapping: ImportFieldMapping) {
  return Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, source ? raw[source] ?? '' : ''])) as Record<string, string>;
}

function normalized(value: string | undefined) {
  return (value ?? '').trim().toLocaleLowerCase();
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  const candidate = normalized(value);
  if (!candidate) return fallback;
  return ['true', 'yes', '1'].includes(candidate);
}

function isBooleanValue(value: string | undefined) {
  const candidate = normalized(value);
  return !candidate || ['true', 'false', 'yes', 'no', '1', '0'].includes(candidate);
}

function optionalNumber(value: string | undefined) {
  return value?.trim() ? Number(value) : undefined;
}

function barcodeType(value: string, barcode: string): ProductFormValues['barcodeType'] {
  const candidate = value.trim().toUpperCase().replace(/[- ]/g, '_');
  if (candidate === 'EAN_13') return 'EAN13';
  if (candidate === 'UPC' || candidate === 'UPCA') return 'UPC_A';
  if (candidate === 'CODE_128') return 'CODE128';
  if (['EAN13', 'UPC_A', 'CODE128', 'OTHER'].includes(candidate)) return candidate as ProductFormValues['barcodeType'];
  if (/^\d{13}$/.test(barcode)) return 'EAN13';
  if (/^\d{12}$/.test(barcode)) return 'UPC_A';
  return barcode ? 'CODE128' : undefined;
}

function toProductValues(tenantId: string, values: Record<string, string>): ProductFormValues {
  const category = resolveReference(masterDataStore.categories, tenantId, values.category ?? '');
  const uom = resolveReference(masterDataStore.uoms, tenantId, values.uom ?? '');
  const brand = resolveReference(masterDataStore.brands, tenantId, values.brand ?? '');
  const type = normalized(values.type) as ProductFormValues['type'];
  const isService = type === 'service';
  const inventory = !isService && parseBoolean(values.trackInventory, true);
  const barcode = isService ? '' : (values.barcode ?? '').trim();
  return {
    name: (values.name ?? '').trim(), shortName: (values.shortName ?? '').trim(), sku: 'IMPORT-PREVIEW', internalCode: (values.internalCode ?? '').trim(),
    barcode, barcodeType: isService ? undefined : barcodeType(values.barcodeType ?? '', barcode), qrValue: '', brandId: isService ? '' : brand?.id ?? '', brand: '',
    description: (values.description ?? '').trim(), type, status: normalized(values.status) as ProductFormValues['status'], categoryId: category?.id ?? '',
    uomId: isService ? '' : uom?.id ?? '', purchaseUomId: '', sellingPrice: Number(values.sellingPrice), costPrice: isService ? 0 : Number(values.costPrice),
    priceTiers: [], taxCode: isService ? '' : (values.taxCode ?? '').trim(), pricesIncludeTax: !isService && parseBoolean(values.pricesIncludeTax, false),
    isSellable: parseBoolean(values.isSellable, true), isPurchasable: !isService && parseBoolean(values.isPurchasable, true), trackInventory: inventory,
    trackByBatch: inventory && parseBoolean(values.trackByBatch, false), trackBySerialNumber: inventory && parseBoolean(values.trackBySerialNumber, false),
    trackExpiry: inventory && parseBoolean(values.trackExpiry, false), allowNegativeStock: inventory && parseBoolean(values.allowNegativeStock, false),
    minStockLevel: inventory ? optionalNumber(values.minStockLevel) : undefined, reorderLevel: inventory ? optionalNumber(values.reorderLevel) : undefined,
    maxStockLevel: inventory ? optionalNumber(values.maxStockLevel) : undefined,
  };
}

function addError(errors: ImportRowError[], field: string, message: string) {
  if (!errors.some((error) => error.field === field && error.message === message)) errors.push({ field, message });
}

export const productImportService = {
  async prepareFile(file: File) {
    if (file.size > 5 * 1024 * 1024) throw new Error('Import files must be 5 MB or smaller.');
    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    if (!extension || !['csv', 'xlsx', 'xls'].includes(extension)) throw new Error('Select a CSV, XLSX or XLS file.');
    const result = await readRows(file); return { sourceColumns: result.headers };
  },

  async preview(tenantId: string, file: File, mapping: ImportFieldMapping): Promise<ImportPreviewRow[]> {
    requireTenant(tenantId);
    const { rows } = await readRows(file);
    const taxes = await getTenantTaxRates(tenantId);
    const seenBarcode = new Set<string>();
    return rows.map((raw, index) => {
      const values = mapped(raw, mapping); const errors: ImportRowError[] = [];
      const type = normalized(values.type); const isService = type === 'service'; const barcode = isService ? '' : normalized(values.barcode);
      if (!['goods', 'service'].includes(type)) addError(errors, 'type', 'Type must be goods or service.');
      if (!values.sellingPrice?.trim()) addError(errors, 'sellingPrice', 'Selling or service price is required.');
      if (!isService && !values.costPrice?.trim()) addError(errors, 'costPrice', 'Purchase / cost price is required for products.');
      if (!resolveReference(masterDataStore.categories, tenantId, values.category ?? '')) addError(errors, 'category', 'Category ID, code or name is invalid.');
      if (!isService && !resolveReference(masterDataStore.uoms, tenantId, values.uom ?? '')) addError(errors, 'uom', 'UOM ID, code or name is invalid.');
      if (!isService && values.brand?.trim() && !resolveReference(masterDataStore.brands, tenantId, values.brand)) addError(errors, 'brand', 'Brand ID, code or name is invalid.');
      if (!isService && values.taxCode?.trim() && !taxes.some((tax) => tax.code.toLocaleLowerCase() === values.taxCode.trim().toLocaleLowerCase() && isSalesTaxApplicable(tax))) addError(errors, 'taxCode', 'Sales tax code is invalid or unavailable.');
      if (!isService && values.barcodeType?.trim() && !['ean13', 'ean-13', 'ean_13', 'upc', 'upca', 'upc-a', 'upc_a', 'code128', 'code-128', 'code_128', 'other'].includes(normalized(values.barcodeType))) addError(errors, 'barcodeType', 'Barcode format must be EAN13, UPC_A, CODE128 or OTHER.');
      ['pricesIncludeTax', 'isSellable', 'isPurchasable', 'trackInventory', 'allowNegativeStock', 'trackByBatch', 'trackBySerialNumber', 'trackExpiry'].forEach((field) => {
        if (!isBooleanValue(values[field])) addError(errors, field, 'Use true/false, yes/no or 1/0.');
      });
      const parsed = productFormSchema.safeParse(toProductValues(tenantId, values));
      if (!parsed.success) parsed.error.issues.forEach((issue) => addError(errors, String(issue.path[0] ?? 'row'), issue.message));
      if (barcode && (productStore.all().some((item) => item.tenantId === tenantId && item.barcode?.toLocaleLowerCase() === barcode) || productVariantStore.all().some((item) => item.tenantId === tenantId && item.barcode?.toLocaleLowerCase() === barcode))) addError(errors, 'barcode', 'Barcode already exists in this tenant.');
      const duplicateInFile = Boolean(barcode && seenBarcode.has(barcode));
      if (barcode) seenBarcode.add(barcode);
      if (duplicateInFile) return { rowNumber: index + 2, values, status: 'skipped' as const, errors: [{ field: 'row', message: 'Duplicate barcode within this file.' }] };
      return { rowNumber: index + 2, values, status: errors.length ? 'failed' as const : 'valid' as const, errors };
    });
  },

  async importRows(tenantId: string, rows: ImportPreviewRow[]): Promise<ImportSummary> {
    requireTenant(tenantId);
    let imported = 0; let failed = rows.filter((row) => row.status === 'failed').length; const skipped = rows.filter((row) => row.status === 'skipped').length;
    for (const row of rows.filter((item) => item.status === 'valid')) {
      try { await productService.create(tenantId, toProductValues(tenantId, row.values)); imported += 1; }
      catch { failed += 1; }
    }
    return { totalRows: rows.length, validRows: imported, skippedRows: skipped, failedRows: failed };
  },
};
