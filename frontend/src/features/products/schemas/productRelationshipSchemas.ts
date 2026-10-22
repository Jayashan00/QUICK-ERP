import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().or(z.literal(''));

export const productSupplierFormSchema = z.object({
  supplierId: z.string().min(1, 'Select a supplier.'),
  supplierProductCode: optionalText(80).refine((value) => !value || /^[A-Za-z0-9._/ -]+$/.test(value), 'Use letters, numbers, spaces, dots, slashes, underscores or hyphens.'),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative.'),
  leadTimeDays: z.number().int('Lead time must be a whole number.').min(0, 'Lead time cannot be negative.').optional(),
  isPreferred: z.boolean(),
  isActive: z.boolean(),
});

export type ProductSupplierFormValues = z.infer<typeof productSupplierFormSchema>;

export const productBundleFormSchema = z.object({
  name: z.string().trim().min(2, 'Bundle name must contain at least 2 characters.').max(150),
  type: z.enum(['fixed', 'configurable']),
  description: optionalText(1000),
  status: z.enum(['active', 'inactive']),
  sellingPrice: z.number().min(0, 'Bundle selling price cannot be negative.'),
  components: z.array(z.object({
    productId: z.string().min(1, 'Select a component product.'),
    quantity: z.number().positive('Component quantity must be greater than zero.'),
  })).min(1, 'Add at least one component product.'),
}).superRefine((value, context) => {
  const seen = new Set<string>();
  value.components.forEach((component, index) => {
    if (seen.has(component.productId)) {
      context.addIssue({ code: 'custom', path: ['components', index, 'productId'], message: 'A component product can only be added once.' });
    }
    seen.add(component.productId);
  });
});

export type ProductBundleFormValues = z.infer<typeof productBundleFormSchema>;
