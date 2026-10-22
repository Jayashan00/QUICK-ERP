import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { inventoryStockService } from '@/features/inventory/services/inventoryStockService';
import { getTenantTaxRates, isSalesTaxApplicable } from '@/features/settings/finance/tax';
import {
  getProductsParamsSchema,
  productFormSchema,
  productSchema,
  productStatuses,
  productTypes,
  type ProductFormValues,
} from '../schemas/productSchema';
import type {
  Category,
  Product,
  ProductFilterOptions,
  ProductListItem,
  ProductListSummary,
  ProductStatus,
  ProductType,
  UOM,
} from '../types/product';
import { masterDataStore } from './masterDataStore';
import { productStore } from './productStore';
import { productDocumentStore } from './productDocumentStore';
import { productImageStore } from './productImageStore';
import { productRelationshipStore } from './productRelationshipStore';
import { productSpecificationStore } from './productSpecificationStore';
import { productVariantStore } from './productVariantStore';

export type ProductSortField = 'name' | 'sku' | 'sellingPrice' | 'createdAt' | 'status';
export type ProductSortOrder = 'asc' | 'desc';
export type InventoryTrackingFilter = 'all' | 'tracked' | 'not_tracked';
export type ProductUsage = 'sale' | 'purchase';

export interface GetProductsParams {
  search?: string;
  status?: ProductStatus | 'all';
  categoryId?: string;
  type?: ProductType | 'all';
  inventoryTracking?: InventoryTrackingFilter;
  sortField?: ProductSortField;
  sortOrder?: ProductSortOrder;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProductsResult {
  data: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: ProductListSummary;
}

export interface ProductDashboardStockSummary {
  stockUnits: number;
  lowStockProducts: number;
}

export interface ProductIdentifierAvailability {
  skuAvailable: boolean;
  barcodeAvailable: boolean;
  qrValueAvailable: boolean;
}

export interface ProductDeletionImpact {
  canDelete: boolean;
  dependencies: string[];
}

export interface ProductExportRow {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  type: ProductType;
  uom: string;
  costPrice: number;
  sellingPrice: number;
  status: ProductStatus;
  trackInventory: boolean;
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

function requireTenantId(tenantId: string) {
  if (!tenantId.trim()) throw new Error('Tenant context is required.');
  return tenantId;
}

function requireScope(scope: TenantBranchScope) {
  requireTenantId(scope.tenantId);
  return scope;
}

function enrichProduct(product: Product, branchId: string): ProductListItem {
  const category = masterDataStore.categories.find(
    (item) => item.id === product.categoryId && item.tenantId === product.tenantId,
  );
  const uom = masterDataStore.uoms.find(
    (item) => item.id === product.uomId && item.tenantId === product.tenantId,
  );
  const brand = product.brandId
    ? masterDataStore.brands.find(
        (item) => item.id === product.brandId && item.tenantId === product.tenantId,
      )
    : undefined;
  const stock = inventoryStockService.getProductSummary(
    { tenantId: product.tenantId, branchId },
    product.id,
    { trackInventory: product.trackInventory, reorderLevel: product.reorderLevel },
  );
  const images = productImageStore.records
    .filter((image) => image.tenantId === product.tenantId && image.productId === product.id)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const primaryImage = images.find((image) => image.isPrimary) ?? images[0];

  return {
    ...product,
    alternateBarcodes: product.alternateBarcodes ? [...product.alternateBarcodes] : undefined,
    variantAttributes: product.variantAttributes ? { ...product.variantAttributes } : undefined,
    priceTiers: product.priceTiers.map((tier) => ({ ...tier })),
    brand: brand?.name ?? product.brand,
    categoryName: category?.name ?? 'Uncategorized',
    uomCode: uom?.code ?? 'N/A',
    uomName: uom?.name ?? 'Unknown UOM',
    stock,
    primaryImage: primaryImage ? { ...primaryImage } : undefined,
    imageCount: images.length,
  };
}

function compareProducts(
  left: ProductListItem,
  right: ProductListItem,
  field: ProductSortField,
  order: ProductSortOrder,
) {
  const direction = order === 'desc' ? -1 : 1;
  const leftValue = left[field];
  const rightValue = right[field];

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return (leftValue - rightValue) * direction;
  }
  return String(leftValue).localeCompare(String(rightValue)) * direction;
}

function buildSummary(products: ProductListItem[]): ProductListSummary {
  return {
    totalProducts: products.length,
    activeProducts: products.filter((product) => product.status === 'active').length,
    inventoryTrackedProducts: products.filter((product) => product.trackInventory).length,
    lowStockProducts: products.filter(
      (product) =>
        product.status === 'active' &&
        (product.stock.status === 'low_stock' || product.stock.status === 'out_of_stock'),
    ).length,
  };
}

function filterAndSortProducts(scope: TenantBranchScope, params: GetProductsParams) {
  requireScope(scope);
  const parsed = getProductsParamsSchema.parse(params);
  let filtered = productStore.all()
    .filter((product) => product.tenantId === scope.tenantId)
    .map((product) => enrichProduct(product, scope.branchId));

  if (parsed.search) {
    const query = parsed.search.toLocaleLowerCase();
    filtered = filtered.filter((product) =>
      [
        product.name,
        product.shortName,
        product.sku,
        product.internalCode,
        product.barcode,
        product.qrValue,
        product.brand,
        ...(product.alternateBarcodes ?? []),
      ].some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }
  if (parsed.status !== 'all') filtered = filtered.filter((product) => product.status === parsed.status);
  if (parsed.categoryId !== 'all') filtered = filtered.filter((product) => product.categoryId === parsed.categoryId);
  if (parsed.type !== 'all') filtered = filtered.filter((product) => product.type === parsed.type);
  if (parsed.inventoryTracking !== 'all') {
    const tracked = parsed.inventoryTracking === 'tracked';
    filtered = filtered.filter((product) => product.trackInventory === tracked);
  }

  return {
    parsed,
    products: [...filtered].sort((left, right) =>
      compareProducts(left, right, parsed.sortField, parsed.sortOrder),
    ),
  };
}

function normalizeProductInput(tenantId: string, data: ProductFormValues): ProductFormValues {
  const parsed = productFormSchema.parse(data);
  const brand = parsed.brandId
    ? masterDataStore.brands.find((item) => item.tenantId === tenantId && item.id === parsed.brandId)?.name
    : undefined;
  return {
    ...parsed,
    sku: parsed.sku.toUpperCase(),
    barcode: parsed.barcode || '',
    barcodeType: parsed.barcode ? parsed.barcodeType : undefined,
    qrValue: parsed.qrValue || undefined,
    internalCode: parsed.internalCode || undefined,
    shortName: parsed.shortName || undefined,
    brandId: parsed.brandId || undefined,
    brand,
    description: parsed.description || undefined,
    purchaseUomId: parsed.purchaseUomId || undefined,
    taxCode: parsed.taxCode || undefined,
    pricesIncludeTax: Boolean(parsed.taxCode) && parsed.pricesIncludeTax,
    priceTiers: parsed.priceTiers
      .map((tier) => ({
        ...tier,
        id: tier.id || `tier-${crypto.randomUUID().slice(0, 8)}`,
        name: tier.name.trim(),
      }))
      .sort((left, right) => left.minimumQuantity - right.minimumQuantity),
    allowNegativeStock: parsed.trackInventory ? parsed.allowNegativeStock : false,
    trackByBatch: parsed.trackInventory ? parsed.trackByBatch : false,
    trackBySerialNumber: parsed.trackInventory ? parsed.trackBySerialNumber : false,
    trackExpiry: parsed.trackInventory && parsed.trackByBatch ? parsed.trackExpiry : false,
    minStockLevel: parsed.trackInventory ? parsed.minStockLevel : undefined,
    reorderLevel: parsed.trackInventory ? parsed.reorderLevel : undefined,
    maxStockLevel: parsed.trackInventory ? parsed.maxStockLevel : undefined,
  };
}

async function assertTaxReference(tenantId: string, taxCode?: string, existingTaxCode?: string) {
  if (!taxCode) return;
  const taxes = await getTenantTaxRates(tenantId);
  const tax = taxes.find((item) => item.code.toLocaleLowerCase() === taxCode.toLocaleLowerCase());
  if (!tax) throw new Error('The selected Tax/VAT record no longer exists.');
  if (!isSalesTaxApplicable(tax) && tax.code !== existingTaxCode) {
    throw new Error('Select an active sales-applicable Tax/VAT record.');
  }
}

function assertUniqueIdentifiers(
  tenantId: string,
  data: Pick<ProductFormValues, 'sku' | 'barcode' | 'qrValue'>,
  excludeId?: string,
) {
  const duplicateSku = productStore.all().some(
    (product) =>
      product.tenantId === tenantId &&
      product.id !== excludeId &&
      product.sku.toLocaleLowerCase() === data.sku.toLocaleLowerCase(),
  );
  const variantUsesSku = productVariantStore.all().some(
    (variant) => variant.tenantId === tenantId && variant.sku.toLocaleLowerCase() === data.sku.toLocaleLowerCase(),
  );
  if (duplicateSku || variantUsesSku) throw new Error(`A product or variant with SKU "${data.sku}" already exists.`);

  const barcode = data.barcode;
  if (barcode) {
    const duplicateBarcode = productStore.all().some(
      (product) =>
        product.tenantId === tenantId &&
        product.id !== excludeId &&
        product.barcode?.toLocaleLowerCase() === barcode.toLocaleLowerCase(),
    );
    const variantUsesBarcode = productVariantStore.all().some(
      (variant) => variant.tenantId === tenantId && variant.barcode?.toLocaleLowerCase() === barcode.toLocaleLowerCase(),
    );
    if (duplicateBarcode || variantUsesBarcode) throw new Error(`A product or variant with barcode "${barcode}" already exists.`);
  }

  const qrValue = data.qrValue;
  if (qrValue && productStore.all().some(
    (product) =>
      product.tenantId === tenantId &&
      product.id !== excludeId &&
      product.qrValue?.toLocaleLowerCase() === qrValue.toLocaleLowerCase(),
  )) {
    throw new Error('This QR value is already assigned to another product.');
  }
}

function assertMasterDataReferences(tenantId: string, data: ProductFormValues, existing?: Product) {
  const hasCategory = masterDataStore.categories.some(
    (category) => category.tenantId === tenantId && category.id === data.categoryId && (category.isActive || existing?.categoryId === category.id),
  );
  if (!hasCategory) throw new Error('Select an active category for this tenant.');

  const uomIds = [data.uomId, data.purchaseUomId].filter(Boolean);
  const hasInvalidUom = uomIds.some(
    (uomId) => !masterDataStore.uoms.some(
      (uom) => uom.id === uomId && uom.tenantId === tenantId && (uom.isActive || existing?.uomId === uom.id || existing?.purchaseUomId === uom.id),
    ),
  );
  if (hasInvalidUom) throw new Error('Select an active unit of measure.');

  if (data.brandId) {
    const hasBrand = masterDataStore.brands.some(
      (brand) =>
        brand.tenantId === tenantId &&
        brand.id === data.brandId &&
        (brand.isActive || existing?.brandId === brand.id),
    );
    if (!hasBrand) throw new Error('Select an active brand for this tenant.');
  }
}

export const productService = {
  async getAll(
    scope: TenantBranchScope,
    params: GetProductsParams = {},
  ): Promise<PaginatedProductsResult> {
    await wait(200);
    requireScope(scope);
    const tenantProducts = productStore.all()
      .filter((product) => product.tenantId === scope.tenantId)
      .map((product) => enrichProduct(product, scope.branchId));
    const summary = buildSummary(tenantProducts);
    const { parsed, products } = filterAndSortProducts(scope, params);
    const total = products.length;
    const startIndex = (parsed.page - 1) * parsed.pageSize;

    return {
      data: products.slice(startIndex, startIndex + parsed.pageSize),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
      summary,
    };
  },

  async getById(scope: TenantBranchScope, id: string): Promise<ProductListItem | null> {
    await wait(120);
    requireScope(scope);
    const product = productStore.all().find(
      (item) => item.id === id && item.tenantId === scope.tenantId,
    );
    return product ? enrichProduct(product, scope.branchId) : null;
  },

  async generateSku(
    tenantId: string,
    input: { name: string; categoryId?: string; type?: ProductType },
  ): Promise<string> {
    await wait(100);
    requireTenantId(tenantId);
    const categoryCode = masterDataStore.categories.find(
      (category) => category.tenantId === tenantId && category.id === input.categoryId,
    )?.code;
    const typeCode = input.type === 'service' ? 'SRV' : input.type === 'composite' ? 'KIT' : 'PRD';
    const prefix = (categoryCode || typeCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const nameCode = input.name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 14) || 'ITEM';
    const stem = `${prefix}-${nameCode}`.slice(0, 42);
    let sequence = 1;
    let candidate = `${stem}-${String(sequence).padStart(3, '0')}`;
    const tenantProducts = productStore.all().filter((product) => product.tenantId === tenantId);
    const tenantVariants = productVariantStore.all().filter((variant) => variant.tenantId === tenantId);
    while (tenantProducts.some((product) => product.sku.toLocaleLowerCase() === candidate.toLocaleLowerCase()) || tenantVariants.some((variant) => variant.sku.toLocaleLowerCase() === candidate.toLocaleLowerCase())) {
      sequence += 1;
      candidate = `${stem}-${String(sequence).padStart(3, '0')}`;
    }
    return candidate;
  },

  async checkIdentifierAvailability(
    tenantId: string,
    input: { sku?: string; barcode?: string; qrValue?: string; excludeId?: string },
  ): Promise<ProductIdentifierAvailability> {
    await wait(90);
    requireTenantId(tenantId);
    const records = productStore.all().filter(
      (product) => product.tenantId === tenantId && product.id !== input.excludeId,
    );
    const variants = productVariantStore.all().filter((variant) => variant.tenantId === tenantId);
    const normalizedSku = input.sku?.trim().toLocaleLowerCase();
    const normalizedBarcode = input.barcode?.trim().toLocaleLowerCase();
    const normalizedQr = input.qrValue?.trim().toLocaleLowerCase();
    return {
      skuAvailable: !normalizedSku || (!records.some((product) => product.sku.toLocaleLowerCase() === normalizedSku) && !variants.some((variant) => variant.sku.toLocaleLowerCase() === normalizedSku)),
      barcodeAvailable: !normalizedBarcode || (!records.some((product) => product.barcode?.toLocaleLowerCase() === normalizedBarcode) && !variants.some((variant) => variant.barcode?.toLocaleLowerCase() === normalizedBarcode)),
      qrValueAvailable: !normalizedQr || !records.some((product) => product.qrValue?.toLocaleLowerCase() === normalizedQr),
    };
  },

  async create(tenantId: string, data: ProductFormValues): Promise<Product> {
    await wait(280);
    requireTenantId(tenantId);
    const normalized = normalizeProductInput(tenantId, data);
    assertUniqueIdentifiers(tenantId, normalized);
    assertMasterDataReferences(tenantId, normalized);
    await assertTaxReference(tenantId, normalized.taxCode);
    const timestamp = new Date().toISOString();
    const product = productSchema.parse({
      ...normalized,
      barcode: normalized.barcode || undefined,
      id: `product-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      hasVariants: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    productStore.insert(product);
    return { ...product, priceTiers: product.priceTiers.map((tier) => ({ ...tier })) };
  },

  async update(tenantId: string, id: string, data: ProductFormValues): Promise<Product> {
    await wait(260);
    requireTenantId(tenantId);
    const index = productStore.all().findIndex(
      (product) => product.tenantId === tenantId && product.id === id,
    );
    if (index < 0) throw new Error('Product not found.');

    const normalized = normalizeProductInput(tenantId, data);
    assertUniqueIdentifiers(tenantId, normalized, id);
    const existing = productStore.all()[index];
    assertMasterDataReferences(tenantId, normalized, existing);
    await assertTaxReference(tenantId, normalized.taxCode, existing.taxCode);
    const updated = productSchema.parse({
      ...existing,
      ...normalized,
      barcode: normalized.barcode || undefined,
      id: existing.id,
      tenantId: existing.tenantId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    productStore.replace(index, updated);
    return { ...updated, priceTiers: updated.priceTiers.map((tier) => ({ ...tier })) };
  },

  async getCategories(tenantId: string): Promise<Category[]> {
    await wait(80);
    requireTenantId(tenantId);
    return masterDataStore.categories
      .filter((category) => category.tenantId === tenantId)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((category) => ({ ...category }));
  },

  async getUoms(tenantId: string): Promise<UOM[]> {
    await wait(80);
    requireTenantId(tenantId);
    return masterDataStore.uoms
      .filter((uom) => uom.tenantId === tenantId)
      .map((uom) => ({ ...uom }));
  },

  async getFilterOptions(tenantId: string): Promise<ProductFilterOptions> {
    requireTenantId(tenantId);
    const [categories, uoms] = await Promise.all([
      productService.getCategories(tenantId),
      productService.getUoms(tenantId),
    ]);
    return {
      categories: categories
        .filter((category) => category.isActive)
        .map(({ id, code, name }) => ({ id, code, name })),
      brands: masterDataStore.brands
        .filter((brand) => brand.tenantId === tenantId && brand.isActive)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(({ id, code, name }) => ({ id, code, name })),
      uoms: uoms
        .filter((uom) => uom.isActive)
        .map(({ id, code, name, symbol }) => ({ id, code, name, symbol })),
      statuses: [...productStatuses],
      types: [...productTypes],
    };
  },

  /** Future sales and purchasing selectors consume only active, eligible products. */
  async getSelectableProducts(
    scope: TenantBranchScope,
    usage: ProductUsage,
    search = '',
  ): Promise<ProductListItem[]> {
    const result = await productService.getAll(scope, {
      search,
      status: 'active',
      sortField: 'name',
      sortOrder: 'asc',
      page: 1,
      pageSize: 100,
    });
    return result.data.filter((product) =>
      usage === 'sale' ? product.isSellable : product.isPurchasable,
    );
  },

  async getDashboardStockSummary(scope: TenantBranchScope): Promise<ProductDashboardStockSummary> {
    requireScope(scope);
    const products = productStore.all()
      .filter((product) => product.tenantId === scope.tenantId && product.status === 'active')
      .map((product) => enrichProduct(product, scope.branchId))
      .filter((product) => product.trackInventory);
    return {
      stockUnits: products.reduce((total, product) => total + product.stock.quantityOnHand, 0),
      lowStockProducts: products.filter(
        (product) => product.stock.status === 'low_stock' || product.stock.status === 'out_of_stock',
      ).length,
    };
  },

  async getExportRows(scope: TenantBranchScope, params: GetProductsParams = {}): Promise<ProductExportRow[]> {
    await wait(180);
    const { products } = filterAndSortProducts(scope, params);
    return products.map((product) => ({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? '',
      category: product.categoryName,
      brand: product.brand ?? '',
      type: product.type,
      uom: product.uomCode,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      status: product.status,
      trackInventory: product.trackInventory,
    }));
  },

  async setStatus(tenantId: string, id: string, status: 'active' | 'inactive'): Promise<Product> {
    await wait(180);
    requireTenantId(tenantId);
    const index = productStore.all().findIndex((product) => product.tenantId === tenantId && product.id === id);
    if (index < 0) throw new Error('Product not found for this tenant.');
    const existing = productStore.all()[index];
    const updated = productSchema.parse({ ...existing, status, updatedAt: new Date().toISOString() });
    productStore.replace(index, updated);
    return { ...updated, priceTiers: updated.priceTiers.map((tier) => ({ ...tier })) };
  },

  async archive(tenantId: string, id: string): Promise<Product> {
    await wait(180);
    requireTenantId(tenantId);
    const index = productStore.all().findIndex((product) => product.tenantId === tenantId && product.id === id);
    if (index < 0) throw new Error('Product not found for this tenant.');
    const existing = productStore.all()[index];
    const updated = productSchema.parse({ ...existing, status: 'archived', updatedAt: new Date().toISOString() });
    productStore.replace(index, updated);
    return { ...updated, priceTiers: updated.priceTiers.map((tier) => ({ ...tier })) };
  },

  async getDeletionImpact(tenantId: string, id: string): Promise<ProductDeletionImpact> {
    await wait(80);
    requireTenantId(tenantId);
    const product = productStore.all().find((item) => item.tenantId === tenantId && item.id === id);
    if (!product) throw new Error('Product not found for this tenant.');
    const dependencies: string[] = [];
    if (productVariantStore.all().some((item) => item.tenantId === tenantId && item.productId === id)) dependencies.push('variants');
    if (productStore.all().some((item) => item.tenantId === tenantId && item.parentProductId === id)) dependencies.push('child product records');
    if (productRelationshipStore.suppliers().some((item) => item.tenantId === tenantId && item.productId === id)) dependencies.push('supplier relationships');
    if (productRelationshipStore.bundles().some((item) => item.tenantId === tenantId && (item.productId === id || item.components.some((component) => component.productId === id)))) dependencies.push('bundle definitions');
    if (productRelationshipStore.related().some((item) => item.tenantId === tenantId && (item.productId === id || item.relatedProductId === id))) dependencies.push('related products');
    if (inventoryStockService.hasProductRecords(tenantId, id)) dependencies.push('branch stock records');
    if (productImageStore.records.some((item) => item.tenantId === tenantId && item.productId === id)) dependencies.push('images');
    if (productDocumentStore.records.some((item) => item.tenantId === tenantId && item.productId === id)) dependencies.push('documents');
    if (productSpecificationStore.records.some((item) => item.tenantId === tenantId && item.productId === id)) dependencies.push('specifications');
    return { canDelete: dependencies.length === 0, dependencies };
  },

  async remove(tenantId: string, id: string): Promise<void> {
    await wait(180);
    const impact = await productService.getDeletionImpact(tenantId, id);
    if (!impact.canDelete) {
      throw new Error(`This product cannot be permanently deleted because it has ${impact.dependencies.join(', ')}. Archive it instead.`);
    }
    productStore.remove(tenantId, id);
  },
};
