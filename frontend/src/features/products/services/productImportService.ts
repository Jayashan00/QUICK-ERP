import type { ImportFieldMapping, ImportPreviewRow, ImportRowError, ImportSummary } from '@/shared/types/import-record';
import type { ProductFormValues } from '../schemas/productSchema';
import { masterDataStore } from './masterDataStore';
import { productService } from './productService';
import { productStore } from './productStore';
import { productVariantStore } from './productVariantStore';

type RawRow = Record<string, string>;
const sourceColumns = ['name', 'sku', 'barcode', 'category', 'uom', 'costPrice', 'sellingPrice', 'status', 'type', 'trackInventory'];
const mockExcelRows: RawRow[] = [
  { name: 'Adjustable Laptop Stand', sku: 'IMP-LAP-STAND', barcode: '9900000000011', category: 'ELEC', uom: 'UNIT', costPrice: '28', sellingPrice: '49', status: 'active', type: 'goods', trackInventory: 'true' },
  { name: 'Existing Laptop', sku: 'ELEC-LAP-001', barcode: '9900000000028', category: 'ELEC', uom: 'UNIT', costPrice: '500', sellingPrice: '700', status: 'active', type: 'goods', trackInventory: 'true' },
  { name: '', sku: 'IMP-BAD-ROW', barcode: '', category: 'UNKNOWN', uom: 'INVALID', costPrice: '-10', sellingPrice: '25', status: 'active', type: 'goods', trackInventory: 'true' },
  { name: 'Duplicate file row', sku: 'IMP-LAP-STAND', barcode: '9900000000011', category: 'ELEC', uom: 'UNIT', costPrice: '28', sellingPrice: '49', status: 'active', type: 'goods', trackInventory: 'true' },
];

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
  if (extension !== 'csv') return { headers: sourceColumns, rows: mockExcelRows.map((row) => ({ ...row })) };
  const lines = (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('The CSV file must include a header and at least one data row.');
  const headers = parseCsvLine(lines[0]);
  return { headers, rows: lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? '']))) };
}

function resolveReference<T extends { id: string; code: string; name: string; tenantId: string; isActive: boolean }>(records: T[], tenantId: string, value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  return records.find((item) => item.tenantId === tenantId && item.isActive && [item.id, item.code, item.name].some((candidate) => candidate.toLocaleLowerCase() === normalized));
}

function mapped(raw: RawRow, mapping: ImportFieldMapping) {
  return Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, source ? raw[source] ?? '' : ''])) as Record<string, string>;
}

function barcodeType(value: string): ProductFormValues['barcodeType'] {
  if (/^\d{13}$/.test(value)) return 'EAN13';
  if (/^\d{12}$/.test(value)) return 'UPC_A';
  return value ? 'CODE128' : undefined;
}

function toProductValues(tenantId: string, values: Record<string, string>): ProductFormValues {
  const category = resolveReference(masterDataStore.categories, tenantId, values.category);
  const uom = resolveReference(masterDataStore.uoms, tenantId, values.uom);
  const type = ['goods', 'service', 'composite'].includes(values.type) ? values.type as ProductFormValues['type'] : 'goods';
  const inventory = type !== 'service' && !['false', 'no', '0'].includes(values.trackInventory.toLocaleLowerCase());
  return { name: values.name.trim(), shortName: '', sku: values.sku.trim(), internalCode: '', barcode: values.barcode.trim(), barcodeType: barcodeType(values.barcode.trim()), qrValue: '', brandId: '', brand: '', description: '', type, status: values.status as ProductFormValues['status'], categoryId: category?.id ?? '', uomId: uom?.id ?? '', purchaseUomId: '', sellingPrice: Number(values.sellingPrice), costPrice: Number(values.costPrice), priceTiers: [], taxCode: '', pricesIncludeTax: false, isSellable: true, isPurchasable: type !== 'service', trackInventory: inventory, trackByBatch: false, trackBySerialNumber: false, trackExpiry: false, allowNegativeStock: false };
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
    const { rows } = await readRows(file); const seenSku = new Set<string>(); const seenBarcode = new Set<string>();
    return rows.map((raw, index) => {
      const values = mapped(raw, mapping); const errors: ImportRowError[] = []; const sku = values.sku.trim().toLocaleLowerCase(); const barcode = values.barcode.trim().toLocaleLowerCase();
      if (!values.name.trim()) errors.push({ field: 'name', message: 'Product name is required.' });
      if (!values.sku.trim()) errors.push({ field: 'sku', message: 'SKU is required.' });
      else if (productStore.all().some((item) => item.tenantId === tenantId && item.sku.toLocaleLowerCase() === sku) || productVariantStore.all().some((item) => item.tenantId === tenantId && item.sku.toLocaleLowerCase() === sku)) errors.push({ field: 'sku', message: 'SKU already exists in this tenant.' });
      if (barcode && (productStore.all().some((item) => item.tenantId === tenantId && item.barcode?.toLocaleLowerCase() === barcode) || productVariantStore.all().some((item) => item.tenantId === tenantId && item.barcode?.toLocaleLowerCase() === barcode))) errors.push({ field: 'barcode', message: 'Barcode already exists in this tenant.' });
      if (!resolveReference(masterDataStore.categories, tenantId, values.category)) errors.push({ field: 'category', message: 'Category ID, code or name is invalid.' });
      if (!resolveReference(masterDataStore.uoms, tenantId, values.uom)) errors.push({ field: 'uom', message: 'UOM ID, code or name is invalid.' });
      const costPrice = Number(values.costPrice); const sellingPrice = Number(values.sellingPrice);
      if (values.costPrice === '' || !Number.isFinite(costPrice) || costPrice < 0) errors.push({ field: 'costPrice', message: 'Cost price must be a non-negative number.' });
      if (values.sellingPrice === '' || !Number.isFinite(sellingPrice) || sellingPrice < 0) errors.push({ field: 'sellingPrice', message: 'Selling price must be a non-negative number.' });
      if (!['draft', 'active', 'inactive', 'archived'].includes(values.status)) errors.push({ field: 'status', message: 'Status must be draft, active, inactive or archived.' });
      if (values.type && !['goods', 'service', 'composite'].includes(values.type)) errors.push({ field: 'type', message: 'Type must be goods, service or composite.' });
      const duplicateInFile = (sku && seenSku.has(sku)) || (barcode && seenBarcode.has(barcode));
      if (sku) seenSku.add(sku); if (barcode) seenBarcode.add(barcode);
      if (duplicateInFile) return { rowNumber: index + 2, values, status: 'skipped' as const, errors: [{ field: 'row', message: 'Duplicate SKU or barcode within this file.' }] };
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
