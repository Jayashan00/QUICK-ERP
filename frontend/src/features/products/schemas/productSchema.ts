import { z } from 'zod';

export const productStatuses = ['draft', 'active', 'inactive', 'archived'] as const;
export const productTypes = ['goods', 'service', 'composite'] as const;
export const barcodeTypes = ['EAN13', 'UPC_A', 'CODE128', 'OTHER'] as const;
export const productSortFields = ['name', 'sku', 'sellingPrice', 'createdAt', 'status'] as const;

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().or(z.literal(''));

const priceTierInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Tier name is required.').max(60, 'Tier name cannot exceed 60 characters.'),
  minimumQuantity: z.number().int('Minimum quantity must be a whole number.').positive('Minimum quantity must be greater than zero.'),
  price: z.number().positive('Tier price must be greater than zero.'),
});

const priceTierSchema = priceTierInputSchema.extend({ id: z.string().min(1) });

const productEditableFields = {
  name: z.string().trim().min(2, 'Product name must contain at least 2 characters.').max(150),
  shortName: optionalText(60),
  sku: z
    .string()
    .trim()
    .min(2, 'SKU must contain at least 2 characters.')
    .max(50, 'SKU cannot exceed 50 characters.')
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Use letters, numbers, dots, underscores, slashes or hyphens.'),
  internalCode: optionalText(50),
  barcode: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .min(4, 'Barcode must contain at least 4 characters.')
      .max(64, 'Barcode cannot exceed 64 characters.')
      .regex(/^[A-Za-z0-9-]+$/, 'Barcode may contain only letters, numbers and hyphens.'),
  ]).optional(),
  barcodeType: z.enum(barcodeTypes).optional(),
  qrValue: optionalText(250),
  brandId: optionalText(100),
  brand: optionalText(80),
  description: optionalText(1000),
  type: z.enum(productTypes, { message: 'Select a product type.' }),
  status: z.enum(productStatuses, { message: 'Select a product status.' }),
  categoryId: z.string().trim().min(1, 'Select a category.'),
  uomId: z.string().trim().min(1, 'Select a unit of measure.'),
  purchaseUomId: optionalText(100),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative.'),
  costPrice: z.number().min(0, 'Cost price cannot be negative.'),
  priceTiers: z.array(priceTierInputSchema).max(20, 'A product can have at most 20 price tiers.'),
  taxCode: optionalText(40),
  pricesIncludeTax: z.boolean(),
  isSellable: z.boolean(),
  isPurchasable: z.boolean(),
  trackInventory: z.boolean(),
  trackByBatch: z.boolean(),
  trackBySerialNumber: z.boolean(),
  trackExpiry: z.boolean(),
  allowNegativeStock: z.boolean(),
  minStockLevel: z.number().min(0, 'Minimum stock cannot be negative.').optional(),
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative.').optional(),
  maxStockLevel: z.number().min(0, 'Maximum stock cannot be negative.').optional(),
};

function validateStockLimits(
  value: {
    barcode?: string;
    barcodeType?: (typeof barcodeTypes)[number];
    minStockLevel?: number;
    reorderLevel?: number;
    maxStockLevel?: number;
    trackInventory: boolean;
    trackByBatch: boolean;
    trackBySerialNumber: boolean;
    trackExpiry: boolean;
    priceTiers: Array<{ name: string; minimumQuantity: number; price: number }>;
  },
  context: z.RefinementCtx,
) {
  if (value.barcode && !value.barcodeType) {
    context.addIssue({ code: 'custom', path: ['barcodeType'], message: 'Select the barcode format.' });
  }
  if (value.barcodeType === 'EAN13' && value.barcode && !/^\d{13}$/.test(value.barcode)) {
    context.addIssue({ code: 'custom', path: ['barcode'], message: 'EAN-13 barcodes must contain exactly 13 digits.' });
  }
  if (value.barcodeType === 'UPC_A' && value.barcode && !/^\d{12}$/.test(value.barcode)) {
    context.addIssue({ code: 'custom', path: ['barcode'], message: 'UPC-A barcodes must contain exactly 12 digits.' });
  }
  if (!value.trackInventory) {
    if (value.trackByBatch) {
      context.addIssue({ code: 'custom', path: ['trackByBatch'], message: 'Batch tracking requires inventory tracking.' });
    }
    if (value.trackBySerialNumber) {
      context.addIssue({ code: 'custom', path: ['trackBySerialNumber'], message: 'Serial number tracking requires inventory tracking.' });
    }
    if (value.trackExpiry) {
      context.addIssue({ code: 'custom', path: ['trackExpiry'], message: 'Expiry tracking requires inventory tracking.' });
    }
  }
  if (value.trackExpiry && !value.trackByBatch) {
    context.addIssue({ code: 'custom', path: ['trackExpiry'], message: 'Expiry tracking requires batch tracking.' });
  }
  if (
    value.trackInventory &&
    value.minStockLevel !== undefined &&
    value.maxStockLevel !== undefined &&
    value.minStockLevel > value.maxStockLevel
  ) {
    context.addIssue({
      code: 'custom',
      path: ['minStockLevel'],
      message: 'Minimum stock cannot exceed maximum stock.',
    });
  }
  if (
    value.trackInventory &&
    value.reorderLevel !== undefined &&
    value.maxStockLevel !== undefined &&
    value.reorderLevel > value.maxStockLevel
  ) {
    context.addIssue({
      code: 'custom',
      path: ['reorderLevel'],
      message: 'Reorder level cannot exceed maximum stock.',
    });
  }
  if (
    value.trackInventory &&
    value.minStockLevel !== undefined &&
    value.reorderLevel !== undefined &&
    value.reorderLevel < value.minStockLevel
  ) {
    context.addIssue({
      code: 'custom',
      path: ['reorderLevel'],
      message: 'Reorder level cannot be below minimum stock.',
    });
  }

  const tierNames = new Set<string>();
  const tierQuantities = new Set<number>();
  value.priceTiers.forEach((tier, index) => {
    const normalizedName = tier.name.trim().toLocaleLowerCase();
    if (tierNames.has(normalizedName)) {
      context.addIssue({ code: 'custom', path: ['priceTiers', index, 'name'], message: 'Tier names must be unique.' });
    }
    tierNames.add(normalizedName);
    if (tierQuantities.has(tier.minimumQuantity)) {
      context.addIssue({ code: 'custom', path: ['priceTiers', index, 'minimumQuantity'], message: 'Minimum quantities cannot overlap.' });
    }
    tierQuantities.add(tier.minimumQuantity);
  });
}

export const productFormSchema = z.object(productEditableFields).superRefine(validateStockLimits);
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const productSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  ...productEditableFields,
  priceTiers: z.array(priceTierSchema),
  alternateBarcodes: z.array(z.string()).optional(),
  hasVariants: z.boolean(),
  parentProductId: z.string().optional(),
  variantAttributes: z.record(z.string(), z.string()).optional(),
  imageUrl: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}).superRefine(validateStockLimits);

export const productArraySchema = z.array(productSchema);

export const getProductsParamsSchema = z.object({
  search: z.string().trim().max(120).default(''),
  status: z.union([z.enum(productStatuses), z.literal('all')]).default('all'),
  categoryId: z.string().default('all'),
  type: z.union([z.enum(productTypes), z.literal('all')]).default('all'),
  inventoryTracking: z.enum(['all', 'tracked', 'not_tracked']).default('all'),
  sortField: z.enum(productSortFields).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(10),
});
