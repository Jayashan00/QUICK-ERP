import assert from 'node:assert/strict';
import { hasPermission } from '../src/core/permissions/permissionUtils';
import { isPermissionInScope } from '../src/core/permissions/permissionScope';
import { productFormSchema } from '../src/features/products/schemas/productSchema';
import { priceListFormSchema, priceRuleFormSchema } from '../src/features/products/schemas/priceListSchema';
import { productService } from '../src/features/products/services/productService';
import { productHandoffService } from '../src/features/products/services/productHandoffService';
import { priceListService } from '../src/features/products/services/priceListService';

const mainScope = { tenantId: 'tenant-001', branchId: 'branch-001' };
const otherScope = { tenantId: 'tenant-002', branchId: 'branch-201' };

assert.equal(isPermissionInScope('products.view', 'tenant'), true);
assert.equal(isPermissionInScope('products.price_lists.view', 'tenant'), true);
assert.equal(isPermissionInScope('platform.tenants.view', 'tenant'), false);
assert.equal(hasPermission(['products.view'], 'products.edit'), false);
assert.equal(hasPermission(['products.view', 'products.import', 'products.export'], 'products.export'), true);

const product = await productService.getById(mainScope, 'prod-001');
assert(product);
assert.equal(await productService.getById(otherScope, 'prod-001'), null);
assert((await productService.getAll(otherScope)).data.every((item) => item.tenantId === otherScope.tenantId));

const posOptions = await productHandoffService.getPosOptions(mainScope);
assert(posOptions.length > 0);
assert(posOptions.every((item) => item.status === 'active'));
assert(!posOptions.some((item) => ['prod-007', 'prod-012'].includes(item.productId)));
assert(!posOptions.some((item) => item.selectionId === 'variant-glove-large'));
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

const lists = await priceListService.getAll(mainScope.tenantId, { page: 1, pageSize: 100 });
assert(lists.data.every((item) => item.tenantId === mainScope.tenantId));
assert.equal(await priceListService.getById(otherScope.tenantId, 'price-list-retail'), null);
assert.equal(priceListFormSchema.safeParse({ name: 'QA', code: 'QA', type: 'retail', currency: 'LKR', status: 'active', effectiveStartDate: '2026-12-31', effectiveEndDate: '2026-01-01' }).success, false);
assert.equal(priceRuleFormSchema.safeParse({ productId: 'prod-001', pricingType: 'quantity_tier', tiers: [{ minQuantity: 1, maxQuantity: 10, price: 10 }, { minQuantity: 10, price: 8 }] }).success, false);
assert.equal((await priceListService.resolvePrice(mainScope, { priceListId: 'price-list-wholesale', productId: 'prod-006', quantity: 10, date: '2026-09-25' })).price, 5.9);
await assert.rejects(() => priceListService.createRule(mainScope, 'price-list-retail', { productId: 'prod-001', variantId: '', pricingType: 'fixed', fixedPrice: 1000, tiers: [] }), /already exists/);
await assert.rejects(() => priceListService.remove(mainScope.tenantId, 'price-list-wholesale'), /has pricing rules/);

const qaList = await priceListService.create(mainScope.tenantId, { name: 'QA Customer Pricing', code: 'QA-PRICE', description: '', type: 'custom', currency: 'LKR', status: 'active', effectiveStartDate: '', effectiveEndDate: '' });
await priceListService.remove(mainScope.tenantId, qaList.id);
assert.equal(await priceListService.getById(mainScope.tenantId, qaList.id), null);

assert.equal((await productService.getDeletionImpact(mainScope.tenantId, 'prod-001')).canDelete, false);
console.log('Product Master Data QA passed: permissions, tenant isolation, validation, price lists, handoffs, and deletion safeguards.');
