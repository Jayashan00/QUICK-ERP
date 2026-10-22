import { supplierService } from '@/features/suppliers/services/supplierService';
import type { Supplier } from '@/features/suppliers/types/supplier';
import { productBundleFormSchema, productSupplierFormSchema, type ProductBundleFormValues, type ProductSupplierFormValues } from '../schemas/productRelationshipSchemas';
import type { ProductBundle, ProductBundleDetail, ProductReference, ProductSupplier, ProductSupplierListItem, RelatedProduct, RelatedProductListItem } from '../types/productRelationships';
import { productStore } from './productStore';
import { productRelationshipStore } from './productRelationshipStore';

const wait = (duration = 140) => new Promise((resolve) => globalThis.setTimeout(resolve, duration));
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

function requireProduct(tenantId: string, productId: string) {
  const product = productStore.all().find((item) => item.tenantId === tenantId && item.id === productId);
  if (!product) throw new Error('Product not found.');
  return product;
}

async function resolveSupplier(item: ProductSupplier): Promise<ProductSupplierListItem> {
  const supplier = await supplierService.getSupplierById(item.tenantId, item.supplierId);
  return {
    ...item,
    supplierName: supplier?.name ?? 'Unavailable supplier',
    supplierCode: supplier?.code ?? item.supplierId,
    supplierStatus: supplier?.status ?? 'inactive',
  };
}

function assertSupplierCodeUnique(tenantId: string, supplierId: string, code?: string, excludeId?: string) {
  if (!code) return;
  const duplicate = productRelationshipStore.suppliers().some((item) => item.tenantId === tenantId && item.supplierId === supplierId && item.id !== excludeId && item.supplierProductCode?.toLocaleLowerCase() === code.toLocaleLowerCase());
  if (duplicate) throw new Error(`Supplier product code "${code}" is already assigned for this supplier.`);
}

function normalizeSupplier(values: ProductSupplierFormValues) {
  const parsed = productSupplierFormSchema.parse(values);
  return { ...parsed, supplierProductCode: parsed.supplierProductCode || undefined };
}

export const productSupplierService = {
  async getAll(tenantId: string, productId: string) {
    await wait();
    requireProduct(tenantId, productId);
    const records = productRelationshipStore.suppliers().filter((item) => item.tenantId === tenantId && item.productId === productId);
    return Promise.all(records.map(resolveSupplier));
  },

  async getSupplierOptions(tenantId: string): Promise<Supplier[]> {
    const result = await supplierService.getSuppliers(tenantId, { status: 'active', sortField: 'name', sortOrder: 'asc', page: 1, pageSize: 100 });
    return result.data.map((supplier) => ({ ...supplier, address: { ...supplier.address } }));
  },

  async create(tenantId: string, productId: string, values: ProductSupplierFormValues) {
    await wait(180);
    requireProduct(tenantId, productId);
    const data = normalizeSupplier(values);
    const supplier = await supplierService.getSupplierById(tenantId, data.supplierId);
    if (!supplier || supplier.status !== 'active') throw new Error('Select an active supplier for this tenant.');
    if (productRelationshipStore.suppliers().some((item) => item.tenantId === tenantId && item.productId === productId && item.supplierId === data.supplierId)) throw new Error('This supplier is already linked to the product.');
    assertSupplierCodeUnique(tenantId, data.supplierId, data.supplierProductCode);
    const timestamp = now();
    let records = productRelationshipStore.suppliers();
    if (data.isPreferred) records = records.map((item) => item.tenantId === tenantId && item.productId === productId ? { ...item, isPreferred: false, updatedAt: timestamp } : item);
    const item: ProductSupplier = { ...data, id: id('product-supplier'), tenantId, productId, createdAt: timestamp, updatedAt: timestamp };
    productRelationshipStore.setSuppliers([item, ...records]);
    return resolveSupplier(item);
  },

  async update(tenantId: string, productId: string, relationshipId: string, values: ProductSupplierFormValues) {
    await wait(180);
    const data = normalizeSupplier(values);
    let records = productRelationshipStore.suppliers();
    const index = records.findIndex((item) => item.id === relationshipId && item.tenantId === tenantId && item.productId === productId);
    if (index < 0) throw new Error('Supplier relationship not found.');
    const supplier = await supplierService.getSupplierById(tenantId, data.supplierId);
    if (!supplier) throw new Error('Supplier not found for this tenant.');
    if (records.some((item) => item.tenantId === tenantId && item.productId === productId && item.supplierId === data.supplierId && item.id !== relationshipId)) throw new Error('This supplier is already linked to the product.');
    assertSupplierCodeUnique(tenantId, data.supplierId, data.supplierProductCode, relationshipId);
    const timestamp = now();
    if (data.isPreferred) records = records.map((item) => item.tenantId === tenantId && item.productId === productId && item.id !== relationshipId ? { ...item, isPreferred: false, updatedAt: timestamp } : item);
    const current = records.find((item) => item.id === relationshipId)!;
    const updated: ProductSupplier = { ...current, ...data, id: current.id, tenantId, productId, createdAt: current.createdAt, updatedAt: timestamp };
    productRelationshipStore.setSuppliers(records.map((item) => item.id === relationshipId ? updated : item));
    return resolveSupplier(updated);
  },

  async remove(tenantId: string, productId: string, relationshipId: string) {
    await wait(160);
    const records = productRelationshipStore.suppliers();
    if (!records.some((item) => item.id === relationshipId && item.tenantId === tenantId && item.productId === productId)) throw new Error('Supplier relationship not found.');
    productRelationshipStore.setSuppliers(records.filter((item) => !(item.id === relationshipId && item.tenantId === tenantId && item.productId === productId)));
  },
};

function productReferences(tenantId: string, excludeId: string): ProductReference[] {
  return productStore.all().filter((item) => item.tenantId === tenantId && item.id !== excludeId && item.status === 'active').sort((a, b) => a.name.localeCompare(b.name)).map(({ id: productId, name, sku, status, sellingPrice }) => ({ id: productId, name, sku, status, sellingPrice }));
}

function resolveBundle(bundle: ProductBundle): ProductBundleDetail {
  const components = bundle.components.map((component) => {
    const product = requireProduct(bundle.tenantId, component.productId);
    return { ...component, productName: product.name, sku: product.sku, unitSellingPrice: product.sellingPrice, lineTotal: product.sellingPrice * component.quantity };
  });
  return { ...bundle, components, componentTotal: components.reduce((total, item) => total + item.lineTotal, 0) };
}

function validateBundle(tenantId: string, productId: string, values: ProductBundleFormValues) {
  const parent = requireProduct(tenantId, productId);
  if (parent.type !== 'composite') throw new Error('Only Composite / Bundle products can contain bundle components.');
  const parsed = productBundleFormSchema.parse(values);
  if (parsed.components.some((component) => component.productId === productId)) throw new Error('A bundle cannot contain itself.');
  parsed.components.forEach((component) => {
    const product = requireProduct(tenantId, component.productId);
    if (product.status !== 'active') throw new Error(`Component "${product.name}" must be active.`);
    const componentBundle = productRelationshipStore.bundles().find((bundle) => bundle.tenantId === tenantId && bundle.productId === component.productId);
    if (componentBundle?.components.some((item) => item.productId === productId)) throw new Error('This component would create a circular bundle reference.');
  });
  return { ...parsed, description: parsed.description || undefined, components: parsed.components.map((component) => ({ ...component })) };
}

export const productBundleService = {
  async get(tenantId: string, productId: string) {
    await wait();
    requireProduct(tenantId, productId);
    const bundle = productRelationshipStore.bundles().find((item) => item.tenantId === tenantId && item.productId === productId);
    return bundle ? resolveBundle(bundle) : null;
  },
  async getProductOptions(tenantId: string, productId: string) { await wait(80); return productReferences(tenantId, productId); },
  /** Future sales/POS selectors should consume only active bundle configurations backed by active products. */
  async getSelectable(tenantId: string) {
    await wait(100);
    return productRelationshipStore.bundles()
      .filter((bundle) => bundle.tenantId === tenantId && bundle.status === 'active')
      .filter((bundle) => {
        const product = productStore.all().find((item) => item.tenantId === tenantId && item.id === bundle.productId);
        return product?.status === 'active' && product.isSellable;
      })
      .map(resolveBundle);
  },
  async save(tenantId: string, productId: string, values: ProductBundleFormValues) {
    await wait(200);
    const data = validateBundle(tenantId, productId, values);
    const records = productRelationshipStore.bundles();
    const current = records.find((item) => item.tenantId === tenantId && item.productId === productId);
    const timestamp = now();
    const item: ProductBundle = current
      ? { ...current, ...data, id: current.id, tenantId, productId, createdAt: current.createdAt, updatedAt: timestamp }
      : { ...data, id: id('bundle'), tenantId, productId, createdAt: timestamp, updatedAt: timestamp };
    productRelationshipStore.setBundles(current ? records.map((record) => record.id === current.id ? item : record) : [item, ...records]);
    return resolveBundle(item);
  },
  async remove(tenantId: string, productId: string) {
    await wait(160);
    const records = productRelationshipStore.bundles();
    if (!records.some((item) => item.tenantId === tenantId && item.productId === productId)) throw new Error('Bundle configuration not found.');
    productRelationshipStore.setBundles(records.filter((item) => !(item.tenantId === tenantId && item.productId === productId)));
  },
};

function resolveRelated(item: RelatedProduct): RelatedProductListItem {
  const product = requireProduct(item.tenantId, item.relatedProductId);
  return { ...item, name: product.name, sku: product.sku, status: product.status, sellingPrice: product.sellingPrice };
}

export const relatedProductService = {
  async getAll(tenantId: string, productId: string) { await wait(); requireProduct(tenantId, productId); return productRelationshipStore.related().filter((item) => item.tenantId === tenantId && item.productId === productId).map(resolveRelated); },
  async getOptions(tenantId: string, productId: string) { await wait(80); return productReferences(tenantId, productId); },
  async add(tenantId: string, productId: string, relatedProductId: string) {
    await wait(150); requireProduct(tenantId, productId); requireProduct(tenantId, relatedProductId);
    if (productId === relatedProductId) throw new Error('A product cannot be related to itself.');
    const records = productRelationshipStore.related();
    if (records.some((item) => item.tenantId === tenantId && item.productId === productId && item.relatedProductId === relatedProductId)) throw new Error('This related product is already assigned.');
    const timestamp = now(); const item: RelatedProduct = { id: id('related'), tenantId, productId, relatedProductId, createdAt: timestamp, updatedAt: timestamp };
    productRelationshipStore.setRelated([item, ...records]); return resolveRelated(item);
  },
  async remove(tenantId: string, productId: string, relationshipId: string) {
    await wait(140); const records = productRelationshipStore.related();
    if (!records.some((item) => item.id === relationshipId && item.tenantId === tenantId && item.productId === productId)) throw new Error('Related product assignment not found.');
    productRelationshipStore.setRelated(records.filter((item) => !(item.id === relationshipId && item.tenantId === tenantId && item.productId === productId)));
  },
};
