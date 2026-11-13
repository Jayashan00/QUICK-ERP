import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { hasPermission } from '../src/core/permissions/permissionUtils';
import { isPermissionInScope } from '../src/core/permissions/permissionScope';
import { productFormSchema } from '../src/features/products/schemas/productSchema';
import { brandFormSchema, categoryFormSchema, uomFormSchema } from '../src/features/products/schemas/masterDataSchemas';
import { productService } from '../src/features/products/services/productService';
import { buildProductImportTemplateCsv, productImportColumns, productImportService } from '../src/features/products/services/productImportService';
import { productHandoffService } from '../src/features/products/services/productHandoffService';
import { categoryService } from '../src/features/products/services/categoryService';
import { brandService } from '../src/features/products/services/brandService';
import { uomService } from '../src/features/products/services/uomService';

const mainScope = { tenantId: 'tenant-001', branchId: 'branch-001' };
const otherScope = { tenantId: 'tenant-002', branchId: 'branch-201' };

assert.equal(isPermissionInScope('products.view', 'tenant'), true);
assert.equal(isPermissionInScope('platform.tenants.view', 'tenant'), false);
assert.equal(hasPermission(['products.view'], 'products.edit'), false);
assert.equal(hasPermission(['products.view', 'products.import', 'products.export'], 'products.export'), true);

const categoryValues = { name: 'QA Auto Category', description: '', parentId: '', sortOrder: 95, isActive: true };
assert(categoryFormSchema.safeParse(categoryValues).success);
const generatedCategory = await categoryService.create(mainScope.tenantId, categoryValues);
assert.equal(generatedCategory.code, 'QA-AUTO-CATEGORY');
await assert.rejects(
  () => categoryService.create(mainScope.tenantId, { ...categoryValues, name: 'QA Duplicate Display Order' }),
  /Display order 95 is already used/,
);
const categoryWithMatchingCodeBase = await categoryService.create(mainScope.tenantId, { ...categoryValues, name: 'QA Auto-Category', sortOrder: 96 });
assert.equal(categoryWithMatchingCodeBase.code, 'QA-AUTO-CATEGORY-2');
await categoryService.remove(mainScope.tenantId, categoryWithMatchingCodeBase.id);
const renamedCategory = await categoryService.update(mainScope.tenantId, generatedCategory.id, { ...categoryValues, name: 'QA Renamed Category' });
assert.equal(renamedCategory.code, generatedCategory.code);
await categoryService.remove(mainScope.tenantId, generatedCategory.id);

const brandValues = { name: 'QA Auto Brand', description: '', websiteUrl: '', isActive: true };
assert(brandFormSchema.safeParse(brandValues).success);
const generatedBrand = await brandService.create(mainScope.tenantId, brandValues);
assert.equal(generatedBrand.code, 'QA-AUTO-BRAND');
assert.equal(generatedBrand.logoUrl, undefined);
const brandWithMatchingCodeBase = await brandService.create(mainScope.tenantId, { ...brandValues, name: 'QA Auto-Brand' });
assert.equal(brandWithMatchingCodeBase.code, 'QA-AUTO-BRAND-2');
await brandService.remove(mainScope.tenantId, brandWithMatchingCodeBase.id);
const renamedBrand = await brandService.update(mainScope.tenantId, generatedBrand.id, { ...brandValues, name: 'QA Renamed Brand' });
assert.equal(renamedBrand.code, generatedBrand.code);
await brandService.remove(mainScope.tenantId, generatedBrand.id);

const uomValues = { name: 'QA Weight Unit', symbol: 'qwu', type: 'weight' as const, decimalPlaces: 3, description: '', isDefault: false, isActive: true };
assert(uomFormSchema.safeParse(uomValues).success);
const uomOptions = await uomService.getOptions(mainScope.tenantId);
assert(uomOptions[0]?.isDefault);
const generatedUom = await uomService.create(mainScope.tenantId, uomValues);
assert.equal(generatedUom.code, 'QA-WEIGHT-UNIT');
const uomWithMatchingCodeBase = await uomService.create(mainScope.tenantId, { ...uomValues, name: 'QA Weight-Unit', symbol: 'qwu2' });
assert.equal(uomWithMatchingCodeBase.code, 'QA-WEIGHT-UNIT-2');
await uomService.remove(mainScope.tenantId, uomWithMatchingCodeBase.id);
const renamedUom = await uomService.update(mainScope.tenantId, generatedUom.id, { ...uomValues, name: 'QA Renamed Unit' });
assert.equal(renamedUom.code, generatedUom.code);
await uomService.remove(mainScope.tenantId, generatedUom.id);

const product = await productService.getById(mainScope, 'prod-001');
assert(product);
assert.equal(await productService.getById(otherScope, 'prod-001'), null);
assert((await productService.getAll(otherScope)).data.every((item) => item.tenantId === otherScope.tenantId));

const posOptions = await productHandoffService.getPosOptions(mainScope);
assert(posOptions.length > 0);
assert(posOptions.every((item) => item.status === 'active'));
assert(!posOptions.some((item) => ['prod-007', 'prod-012'].includes(item.productId)));
assert(posOptions.every((item) => !item.variantId && !item.variantLabel));
assert(posOptions.some((item) => item.productId === 'prod-011' && item.selectionId === 'prod-011'));
const purchaseOptions = await productHandoffService.getPurchaseOptions(mainScope);
assert(purchaseOptions.every((item) => item.productId && item.sku));
assert(purchaseOptions.every((item) => item.uomId && !('purchaseUomId' in item)));
assert(!purchaseOptions.some((item) => ['prod-007', 'prod-012'].includes(item.productId)));

const generatedProductCode = await productService.generateSku(mainScope.tenantId, { name: 'QA Catalog Item', categoryId: 'cat-electronics', type: 'goods' });
const generatedServiceCode = await productService.generateSku(mainScope.tenantId, { name: 'QA Catalog Item', categoryId: 'cat-services', type: 'service' });
assert.match(generatedProductCode, /^PRD-/);
assert.match(generatedServiceCode, /^SRV-/);
assert.notEqual(generatedProductCode, generatedServiceCode);

const validProduct = {
  name: 'QA Product', sku: 'QA-PRODUCT-001', barcode: '', barcodeType: 'CODE128' as const,
  type: 'goods' as const, status: 'draft' as const, categoryId: 'cat-electronics', uomId: 'uom-unit',
  sellingPrice: 20, costPrice: 10, priceTiers: [], pricesIncludeTax: false, isSellable: true,
  isPurchasable: true, trackInventory: true, trackByBatch: false, trackBySerialNumber: false,
  trackExpiry: false, allowNegativeStock: false, minStockLevel: 5, reorderLevel: 8, maxStockLevel: 20,
};
assert(productFormSchema.safeParse(validProduct).success);
assert.equal(productFormSchema.safeParse({ ...validProduct, costPrice: -1 }).success, false);
assert.equal(productFormSchema.safeParse({ ...validProduct, minStockLevel: 10, maxStockLevel: 5 }).success, false);
assert.equal(productFormSchema.safeParse({ ...validProduct, trackExpiry: true, trackByBatch: false }).success, false);
assert.equal(productFormSchema.safeParse({ ...validProduct, barcode: '4006381333931', barcodeType: 'EAN13' }).success, true);
assert.equal(productFormSchema.safeParse({ ...validProduct, barcode: '4006381333932', barcodeType: 'EAN13' }).success, false);
assert.equal(productFormSchema.safeParse({ ...validProduct, barcode: '036000291452', barcodeType: 'UPC_A' }).success, true);
assert.equal(productFormSchema.safeParse({ ...validProduct, barcode: '036000291453', barcodeType: 'UPC_A' }).success, false);
assert.equal(productFormSchema.safeParse({ ...validProduct, uomId: '' }).success, false);
assert.equal(productFormSchema.safeParse({ ...validProduct, type: 'service', uomId: '' }).success, true);

const importTemplate = buildProductImportTemplateCsv();
const importTemplateLines = importTemplate.split(/\r?\n/);
const importHeaders = importTemplateLines[0].split(',');
assert.equal(importTemplateLines.length, 3);
assert.equal(importHeaders.length, productImportColumns.length);
assert(!importHeaders.includes('sku'));
assert(importHeaders.includes('brand'));
assert(importHeaders.includes('taxCode'));
assert(importHeaders.includes('minStockLevel'));
assert(importHeaders.includes('trackBySerialNumber'));
const importFile = new File([importTemplate], 'product-service-template.csv', { type: 'text/csv' });
const importMapping = Object.fromEntries(productImportColumns.map((column) => [column.key, column.key]));
const importPreview = await productImportService.preview(mainScope.tenantId, importFile, importMapping);
assert.equal(importPreview.length, 2);
assert(importPreview.every((row) => row.status === 'valid'));
assert.equal(importPreview[0].values.type, 'goods');
assert.equal(importPreview[1].values.type, 'service');
const importWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(importWorkbook, XLSX.utils.aoa_to_sheet(importTemplateLines.map((line) => line.split(','))), 'Products');
for (const [extension, bookType] of [['xlsx', 'xlsx'], ['xls', 'biff8']] as const) {
  const workbookFile = new File(
    [XLSX.write(importWorkbook, { bookType, type: 'array' })],
    `product-service-template.${extension}`,
  );
  const preparedWorkbook = await productImportService.prepareFile(workbookFile);
  assert.deepEqual(preparedWorkbook.sourceColumns, importHeaders);
  const workbookPreview = await productImportService.preview(mainScope.tenantId, workbookFile, importMapping);
  assert.equal(workbookPreview.length, 2);
  assert(workbookPreview.every((row) => row.status === 'valid'));
}

const normalizedService = await productService.create(mainScope.tenantId, {
  ...validProduct,
  name: 'QA Service',
  sku: 'QA-SERVICE-001',
  type: 'service',
  categoryId: 'cat-services',
  uomId: 'uom-hour',
  barcode: '4006381333931',
  barcodeType: 'EAN13',
  brandId: 'brand-logitech',
  purchaseUomId: 'uom-box',
  isPurchasable: true,
  trackInventory: true,
  allowNegativeStock: true,
  minStockLevel: 5,
  reorderLevel: 8,
  maxStockLevel: 20,
  priceTiers: [{ name: 'Legacy tier', minimumQuantity: 2, price: 15 }],
});
assert.equal(normalizedService.barcode, undefined);
assert.match(normalizedService.sku, /^SRV-/);
assert.equal(normalizedService.brandId, undefined);
assert.equal(normalizedService.purchaseUomId, undefined);
assert.equal(normalizedService.uomId, '');
assert.equal(normalizedService.costPrice, 0);
assert.deepEqual(normalizedService.priceTiers, []);
assert.equal(normalizedService.taxCode, undefined);
assert.equal(normalizedService.isPurchasable, false);
assert.equal(normalizedService.trackInventory, false);
assert.equal(normalizedService.allowNegativeStock, false);
assert.equal(normalizedService.minStockLevel, undefined);
const nextServiceCode = await productService.generateSku(mainScope.tenantId, { name: normalizedService.name, categoryId: normalizedService.categoryId, type: 'service' });
assert.match(nextServiceCode, /^SRV-/);
assert.notEqual(nextServiceCode, normalizedService.sku);
assert(!(await productHandoffService.getPosOptions(mainScope)).some((item) => item.productId === normalizedService.id));
assert(!(await productHandoffService.getPurchaseOptions(mainScope)).some((item) => item.productId === normalizedService.id));
const updatedService = await productService.update(mainScope.tenantId, normalizedService.id, { ...normalizedService, sku: 'MANUAL-CODE-NOT-ALLOWED' });
assert.equal(updatedService.sku, normalizedService.sku);
await productService.remove(mainScope.tenantId, normalizedService.id);

assert.equal((await productService.getDeletionImpact(mainScope.tenantId, 'prod-001')).canDelete, false);
console.log('Product Master Data QA passed: permissions, tenant isolation, validation, handoffs, and deletion safeguards.');
