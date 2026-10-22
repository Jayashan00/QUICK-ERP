import type { ProductVariant } from '../types/product';

const createdAt = '2026-07-15T08:00:00Z';

export const mockProductVariants: ProductVariant[] = [
  {
    id: 'variant-chair-graphite', tenantId: 'tenant-001', productId: 'prod-005',
    sku: 'FUR-CHR-ERG-GR', barcode: 'FURCHRERGGR', barcodeType: 'CODE128', status: 'active',
    attributes: [
      { attributeId: 'attr-color', attributeCode: 'COLOR', attributeName: 'Color', optionId: 'attr-color-graphite', value: 'Graphite' },
      { attributeId: 'attr-material', attributeCode: 'MATERIAL', attributeName: 'Material', optionId: 'attr-material-mesh', value: 'Mesh' },
    ],
    createdAt, updatedAt: createdAt,
  },
  {
    id: 'variant-chair-black', tenantId: 'tenant-001', productId: 'prod-005',
    sku: 'FUR-CHR-ERG-BLK', barcode: 'FURCHRERGBLK', barcodeType: 'CODE128', status: 'active',
    attributes: [
      { attributeId: 'attr-color', attributeCode: 'COLOR', attributeName: 'Color', optionId: 'attr-color-black', value: 'Black' },
      { attributeId: 'attr-material', attributeCode: 'MATERIAL', attributeName: 'Material', optionId: 'attr-material-leather', value: 'Leather' },
    ],
    sellingPrice: 379, costPrice: 248,
    createdAt, updatedAt: createdAt,
  },
  {
    id: 'variant-glove-large', tenantId: 'tenant-001', productId: 'prod-011',
    sku: 'SAF-GLV-L-BLK', barcode: 'SAFGLVLBLK', barcodeType: 'CODE128', status: 'inactive',
    attributes: [
      { attributeId: 'attr-size', attributeCode: 'SIZE', attributeName: 'Size', optionId: 'attr-size-large', value: 'Large' },
      { attributeId: 'attr-color', attributeCode: 'COLOR', attributeName: 'Color', optionId: 'attr-color-black', value: 'Black' },
    ],
    createdAt, updatedAt: createdAt,
  },
];
