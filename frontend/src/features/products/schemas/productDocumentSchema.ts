import { z } from 'zod';

export const productDocumentCategories = ['manual', 'specification', 'certificate', 'warranty', 'other'] as const;

export const productDocumentUploadSchema = z.object({
  category: z.enum(productDocumentCategories, { message: 'Select a document category.' }),
});

export type ProductDocumentUploadValues = z.infer<typeof productDocumentUploadSchema>;
