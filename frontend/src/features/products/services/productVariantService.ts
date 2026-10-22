import { productVariantFormSchema, type ProductVariantFormValues } from '../schemas/productVariantSchema';
import type { Product, ProductVariant, ProductVariantAttributeValue, ProductVariantListItem } from '../types/product';
import { masterDataStore } from './masterDataStore';
import { productStore } from './productStore';
import { productVariantStore } from './productVariantStore';

const wait = (duration = 180) => new Promise((resolve) => globalThis.setTimeout(resolve, duration));

function clone(variant: ProductVariant): ProductVariant {
  return { ...variant, attributes: variant.attributes.map((attribute) => ({ ...attribute })) };
}

function requireParent(tenantId: string, productId: string): Product {
  const product = productStore.all().find((item) => item.tenantId === tenantId && item.id === productId);
  if (!product) throw new Error('Parent product not found.');
  return product;
}

function enrich(variant: ProductVariant, parent: Product): ProductVariantListItem {
  return {
    ...clone(variant),
    effectiveSellingPrice: variant.sellingPrice ?? parent.sellingPrice,
    effectiveCostPrice: variant.costPrice ?? parent.costPrice,
    usesParentSellingPrice: variant.sellingPrice === undefined,
    usesParentCostPrice: variant.costPrice === undefined,
  };
}

function assertUniqueIdentifiers(tenantId: string, values: ProductVariantFormValues, excludeId?: string) {
  const sku = values.sku.toLocaleLowerCase();
  if (productStore.all().some((product) => product.tenantId === tenantId && product.sku.toLocaleLowerCase() === sku) ||
    productVariantStore.all().some((variant) => variant.tenantId === tenantId && variant.id !== excludeId && variant.sku.toLocaleLowerCase() === sku)) {
    throw new Error(`A product or variant with SKU "${values.sku}" already exists.`);
  }
  if (!values.barcode) return;
  const barcode = values.barcode.toLocaleLowerCase();
  const productUsesBarcode = productStore.all().some((product) => product.tenantId === tenantId && [product.barcode, ...(product.alternateBarcodes ?? [])].some((value) => value?.toLocaleLowerCase() === barcode));
  const variantUsesBarcode = productVariantStore.all().some((variant) => variant.tenantId === tenantId && variant.id !== excludeId && variant.barcode?.toLocaleLowerCase() === barcode);
  if (productUsesBarcode || variantUsesBarcode) throw new Error(`Barcode "${values.barcode}" is already assigned within this tenant.`);
}

function resolveAttributes(tenantId: string, values: ProductVariantFormValues, existing?: ProductVariant): ProductVariantAttributeValue[] {
  return values.attributes.map((selection) => {
    const attribute = masterDataStore.attributes.find((item) => item.tenantId === tenantId && item.id === selection.attributeId);
    const wasUsed = existing?.attributes.some((item) => item.attributeId === selection.attributeId);
    if (!attribute || (!attribute.isActive && !wasUsed)) throw new Error('Select an active product attribute.');
    const option = attribute.options.find((item) => item.id === selection.optionId);
    if (!option) throw new Error(`Select a valid value for ${attribute.name}.`);
    return { attributeId: attribute.id, attributeCode: attribute.code, attributeName: attribute.name, optionId: option.id, value: option.value };
  });
}

function combinationKey(attributes: ProductVariantAttributeValue[]) {
  return attributes.map((attribute) => `${attribute.attributeId}:${attribute.optionId}`).sort().join('|');
}

function assertUniqueCombination(tenantId: string, productId: string, attributes: ProductVariantAttributeValue[], excludeId?: string) {
  const key = combinationKey(attributes);
  const duplicate = productVariantStore.all().some((variant) => variant.tenantId === tenantId && variant.productId === productId && variant.id !== excludeId && combinationKey(variant.attributes) === key);
  if (duplicate) throw new Error('A variant with this attribute combination already exists.');
}

function syncParentVariantFlag(tenantId: string, productId: string) {
  const index = productStore.all().findIndex((product) => product.tenantId === tenantId && product.id === productId);
  if (index < 0) return;
  const parent = productStore.all()[index];
  const hasVariants = productVariantStore.all().some((variant) => variant.tenantId === tenantId && variant.productId === productId);
  if (parent.hasVariants !== hasVariants) productStore.replace(index, { ...parent, hasVariants, updatedAt: new Date().toISOString() });
}

export const productVariantService = {
  async getAll(tenantId: string, productId: string): Promise<ProductVariantListItem[]> {
    await wait(120);
    const parent = requireParent(tenantId, productId);
    return productVariantStore.all()
      .filter((variant) => variant.tenantId === tenantId && variant.productId === productId)
      .sort((left, right) => left.sku.localeCompare(right.sku))
      .map((variant) => enrich(variant, parent));
  },

  async getSelectable(tenantId: string, productId: string): Promise<ProductVariantListItem[]> {
    await wait(120);
    const parent = requireParent(tenantId, productId);
    if (parent.status !== 'active' || !parent.isSellable) return [];
    return productVariantStore.all()
      .filter((variant) => variant.tenantId === tenantId && variant.productId === productId && variant.status === 'active')
      .sort((left, right) => left.sku.localeCompare(right.sku))
      .map((variant) => enrich(variant, parent));
  },

  async generateSku(tenantId: string, productId: string, selections: ProductVariantFormValues['attributes']): Promise<string> {
    await wait(100);
    const parent = requireParent(tenantId, productId);
    const resolved = resolveAttributes(tenantId, { sku: 'TEMP', status: 'active', attributes: selections });
    const suffix = resolved.map((attribute) => masterDataStore.attributes.find((item) => item.tenantId === tenantId && item.id === attribute.attributeId)?.options.find((option) => option.id === attribute.optionId)?.code ?? attribute.value).join('-').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) || 'VAR';
    const stem = `${parent.sku}-${suffix}`.slice(0, 46);
    let candidate = stem;
    let sequence = 1;
    const isUsed = (sku: string) => productStore.all().some((product) => product.tenantId === tenantId && product.sku.toLocaleLowerCase() === sku.toLocaleLowerCase()) || productVariantStore.all().some((variant) => variant.tenantId === tenantId && variant.sku.toLocaleLowerCase() === sku.toLocaleLowerCase());
    while (isUsed(candidate)) {
      sequence += 1;
      candidate = `${stem.slice(0, 45)}-${sequence}`.slice(0, 50);
    }
    return candidate;
  },

  async create(tenantId: string, productId: string, values: ProductVariantFormValues): Promise<ProductVariantListItem> {
    await wait(260);
    const parent = requireParent(tenantId, productId);
    const parsed = productVariantFormSchema.parse(values);
    assertUniqueIdentifiers(tenantId, parsed);
    const attributes = resolveAttributes(tenantId, parsed);
    assertUniqueCombination(tenantId, productId, attributes);
    const timestamp = new Date().toISOString();
    const variant: ProductVariant = {
      id: `variant-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      productId,
      sku: parsed.sku.toUpperCase(),
      barcode: parsed.barcode || undefined,
      barcodeType: parsed.barcode ? parsed.barcodeType : undefined,
      status: parsed.status,
      attributes,
      sellingPrice: parsed.sellingPrice,
      costPrice: parsed.costPrice,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    productVariantStore.insert(variant);
    syncParentVariantFlag(tenantId, productId);
    return enrich(variant, parent);
  },

  async update(tenantId: string, productId: string, id: string, values: ProductVariantFormValues): Promise<ProductVariantListItem> {
    await wait(260);
    const parent = requireParent(tenantId, productId);
    const index = productVariantStore.all().findIndex((variant) => variant.tenantId === tenantId && variant.productId === productId && variant.id === id);
    if (index < 0) throw new Error('Product variant not found.');
    const parsed = productVariantFormSchema.parse(values);
    assertUniqueIdentifiers(tenantId, parsed, id);
    const existing = productVariantStore.all()[index];
    const attributes = resolveAttributes(tenantId, parsed, existing);
    assertUniqueCombination(tenantId, productId, attributes, id);
    const updated: ProductVariant = {
      ...existing,
      sku: parsed.sku.toUpperCase(),
      barcode: parsed.barcode || undefined,
      barcodeType: parsed.barcode ? parsed.barcodeType : undefined,
      status: parsed.status,
      attributes,
      sellingPrice: parsed.sellingPrice,
      costPrice: parsed.costPrice,
      updatedAt: new Date().toISOString(),
    };
    productVariantStore.replace(index, updated);
    return enrich(updated, parent);
  },

  async remove(tenantId: string, productId: string, id: string) {
    await wait(220);
    const exists = productVariantStore.all().some((variant) => variant.tenantId === tenantId && variant.productId === productId && variant.id === id);
    if (!exists) throw new Error('Product variant not found.');
    productVariantStore.remove(tenantId, id);
    syncParentVariantFlag(tenantId, productId);
  },
};
