import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { getTenantTaxRates } from '@/features/settings/finance/tax';
import type { ProductVariantListItem } from '../types/product';
import type { PosProductOption, ProductTaxReference, PurchaseProductOption, StorefrontProductItem } from '../types/productHandoffs';
import { productService } from './productService';
import { productVariantService } from './productVariantService';
import { productBundleService, productSupplierService, relatedProductService } from './productRelationshipService';

function variantLabel(variant: ProductVariantListItem) {
  return variant.attributes.map((attribute) => `${attribute.attributeName}: ${attribute.value}`).join(' / ');
}

async function taxMap(tenantId: string) {
  const taxes = await getTenantTaxRates(tenantId);
  return new Map<string, ProductTaxReference>(taxes.map((tax) => [tax.code, {
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
        purchaseUomId: product.purchaseUomId,
        defaultCostPrice: product.costPrice,
        trackInventory: product.trackInventory,
        suppliers,
        preferredSupplier: suppliers.find((supplier) => supplier.isPreferred),
      };
    }));
  },

  /** Active sale items and active variants shaped for a future POS product picker. */
  async getPosOptions(scope: TenantBranchScope, search = ''): Promise<PosProductOption[]> {
    const [products, taxes] = await Promise.all([
      productService.getSelectableProducts(scope, 'sale'),
      taxMap(scope.tenantId),
    ]);
    const options = await Promise.all(products.map(async (product) => {
      const base = {
        productId: product.id,
        name: product.name,
        tax: product.taxCode ? taxes.get(product.taxCode) ?? null : null,
        status: 'active' as const,
        trackInventory: product.trackInventory,
        trackByBatch: product.trackByBatch,
        trackBySerialNumber: product.trackBySerialNumber,
        trackExpiry: product.trackExpiry,
      };
      const variants = await productVariantService.getSelectable(scope.tenantId, product.id);
      if (variants.length) {
        return variants.map((variant) => ({
          ...base,
          selectionId: variant.id,
          variantId: variant.id,
          variantLabel: variantLabel(variant),
          sku: variant.sku,
          barcode: variant.barcode,
          sellingPrice: variant.effectiveSellingPrice,
        }));
      }
      if (product.hasVariants) return [];
      return [{ ...base, selectionId: product.id, sku: product.sku, barcode: product.barcode, sellingPrice: product.sellingPrice }];
    }));
    const query = search.trim().toLocaleLowerCase();
    return options.flat().filter((option) => !query || [
      option.name,
      option.sku,
      option.barcode,
      'variantLabel' in option ? option.variantLabel : undefined,
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
      const [variants, relatedProducts, bundle] = await Promise.all([
        productVariantService.getSelectable(scope.tenantId, product.id),
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
        variants,
        relatedProducts: relatedProducts.filter((related) => related.status === 'active'),
        bundle: bundle?.status === 'active' ? bundle : null,
      };
    }));
  },
};
