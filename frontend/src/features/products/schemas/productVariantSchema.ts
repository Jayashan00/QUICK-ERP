import { z } from 'zod';
import { barcodeTypes } from './productSchema';

const optionalPrice = z.number().min(0, 'Price cannot be negative.').optional();

export const productVariantFormSchema = z.object({
  sku: z.string().trim().min(2, 'Variant SKU must contain at least 2 characters.').max(50)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Use letters, numbers, dots, underscores, slashes or hyphens.'),
  barcode: z.union([
    z.literal(''),
    z.string().trim().min(4, 'Barcode must contain at least 4 characters.').max(64)
      .regex(/^[A-Za-z0-9-]+$/, 'Barcode may contain only letters, numbers and hyphens.'),
  ]).optional(),
  barcodeType: z.enum(barcodeTypes).optional(),
  status: z.enum(['active', 'inactive']),
  attributes: z.array(z.object({
    attributeId: z.string().min(1, 'Select an attribute.'),
    optionId: z.string().min(1, 'Select an allowed value.'),
  })).min(1, 'Select at least one attribute value.'),
  sellingPrice: optionalPrice,
  costPrice: optionalPrice,
}).superRefine((values, context) => {
  const attributeIds = new Set<string>();
  values.attributes.forEach((attribute, index) => {
    if (attributeIds.has(attribute.attributeId)) {
      context.addIssue({ code: 'custom', path: ['attributes', index, 'attributeId'], message: 'Each attribute can be selected only once.' });
    }
    attributeIds.add(attribute.attributeId);
  });
  if (values.barcode && !values.barcodeType) {
    context.addIssue({ code: 'custom', path: ['barcodeType'], message: 'Select the barcode format.' });
  }
  if (values.barcodeType === 'EAN13' && values.barcode && !/^\d{13}$/.test(values.barcode)) {
    context.addIssue({ code: 'custom', path: ['barcode'], message: 'EAN-13 barcodes must contain exactly 13 digits.' });
  }
  if (values.barcodeType === 'UPC_A' && values.barcode && !/^\d{12}$/.test(values.barcode)) {
    context.addIssue({ code: 'custom', path: ['barcode'], message: 'UPC-A barcodes must contain exactly 12 digits.' });
  }
});

export type ProductVariantFormValues = z.infer<typeof productVariantFormSchema>;
