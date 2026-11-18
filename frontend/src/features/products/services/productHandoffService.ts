import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { getTenantTaxRates, isSalesTaxApplicable } from '@/features/settings/finance/tax';
import type { PosProductOption, ProductTaxReference, PurchaseProductOption, StorefrontProductItem } from '../types/productHandoffs';
import { productService } from './productService';
import { productBundleService, productSupplierService, relatedProductService } from './productRelationshipService';

async function taxMap(tenantId: string) {
  const taxes = await getTenantTaxRates(tenantId);
  return new Map<string, ProductTaxReference>(taxes.filter((tax) => isSalesTaxApplicable(tax)).map((tax) => [tax.code, {
    code: tax.code,
    name: tax.name,
    percentage: tax.percentage,
  }]));
}

export const productHandoffService = {
  /** Purchase Requests, Purchase Orders and GRNs can consume this without duplicating product or supplier data. */
  async getPurchaseOptions(scope: TenantBranchScope, search = ''): Promise<PurchaseProductOption[]> {
    const products = await productService.getSelectableProducts(scope, 'purchase', search);
    return Promise.all(products.map(async (product) => {
      const suppliers = (await productSupplierService.getAll(scope.tenantId, product.id))
        .filter((supplier) => supplier.isActive && supplier.supplierStatus === 'active');
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        uomId: product.uomId,
        defaultCostPrice: product.costPrice,
        trackInventory: product.trackInventory,
        suppliers,
        preferredSupplier: suppliers.find((supplier) => supplier.isPreferred),
      };
    }));
  },

  /** Active goods shaped for the POS product picker. Services and legacy variants are excluded. */
  async getPosOptions(scope: TenantBranchScope, search = ''): Promise<PosProductOption[]> {
    const [selectableProducts, taxes] = await Promise.all([
      productService.getSelectableProducts(scope, 'sale'),
      taxMap(scope.tenantId),
    ]);
    const products = selectableProducts.filter((product) => product.type !== 'service');
    const options = products.map((product) => ({
        productId: product.id,
        selectionId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        sellingPrice: product.sellingPrice,
        tax: product.taxCode ? taxes.get(product.taxCode) ?? null : null,
        status: 'active' as const,
        trackInventory: product.trackInventory,
        trackByBatch: product.trackByBatch,
        trackBySerialNumber: product.trackBySerialNumber,
        trackExpiry: product.trackExpiry,
      }));
    const query = search.trim().toLocaleLowerCase();
    return options.filter((option) => !query || [
      option.name,
      option.sku,
      option.barcode,
    ]
      .some((value) => value?.toLocaleLowerCase().includes(query)));
  },

  /** Read-only catalog projection for a future web store; no storefront state is stored on Product. */
  async getStorefrontCatalog(scope: TenantBranchScope, search = ''): Promise<StorefrontProductItem[]> {
    const [products, taxes] = await Promise.all([
      productService.getSelectableProducts(scope, 'sale', search),
      taxMap(scope.tenantId),
    ]);
    return Promise.all(products.map(async (product) => {
      const [relatedProducts, bundle] = await Promise.all([
        relatedProductService.getAll(scope.tenantId, product.id),
        product.type === 'composite' ? productBundleService.get(scope.tenantId, product.id) : Promise.resolve(null),
      ]);
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        sellingPrice: bundle?.status === 'active' ? bundle.sellingPrice : product.sellingPrice,
        tax: product.taxCode ? taxes.get(product.taxCode) ?? null : null,
        primaryImage: product.primaryImage,
        variants: [],
        relatedProducts: relatedProducts.filter((related) => related.status === 'active'),
        bundle: bundle?.status === 'active' ? bundle : null,
      };
    }));
  },
};
