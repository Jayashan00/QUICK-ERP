import { z } from "zod";

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const date = (label: string) => required(label).refine((value) => !Number.isNaN(Date.parse(value)), `${label} must be valid.`);
const productLine = z.object({
  productId: required("Product"),
  variantId: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero."),
  unitPrice: z.number().nonnegative("Price cannot be negative."),
  discountPercent: z.number().min(0).max(100),
  taxPercent: z.number().min(0).max(100),
});
const uniqueLines = z.array(productLine).min(1, "Add at least one item.").superRefine((items, context) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const key = `${item.productId}:${item.variantId ?? ""}`;
    if (seen.has(key)) context.addIssue({ code: "custom", path: [index, "productId"], message: "Each product or variant can only be added once." });
    seen.add(key);
  });
});

export const purchaseRequestSchema = z.object({ branchId: required("Branch"), requiredDate: date("Required date"), reason: required("Reason").max(240), notes: z.string().trim().max(1000).optional(), items: uniqueLines });
export const rfqSchema = z.object({ purchaseRequestId: required("Purchase request"), supplierIds: z.array(z.string()).min(1, "Select at least one supplier."), requiredDeliveryDate: date("Required delivery date"), notes: z.string().trim().max(1000).optional() });
export const supplierQuotationSchema = z.object({ rfqId: required("RFQ"), supplierId: required("Supplier"), quotationNumber: required("Supplier quotation number"), quotationDate: date("Quotation date"), validityDate: date("Validity date"), deliveryDays: z.number().int().positive(), paymentTerms: required("Payment terms"), currency: required("Currency"), notes: z.string().trim().max(1000).optional(), items: uniqueLines }).refine((value) => Date.parse(value.validityDate) >= Date.parse(value.quotationDate), { path: ["validityDate"], message: "Validity date cannot be before quotation date." });
export const purchaseOrderSchema = z.object({ supplierId: required("Supplier"), branchId: required("Branch"), warehouseId: required("Warehouse"), orderDate: date("Order date"), expectedDeliveryDate: date("Expected delivery date"), paymentTerms: required("Payment terms"), currency: required("Currency"), notes: z.string().trim().max(1000).optional(), items: uniqueLines }).refine((value) => Date.parse(value.expectedDeliveryDate) >= Date.parse(value.orderDate), { path: ["expectedDeliveryDate"], message: "Delivery date cannot be before order date." });
const receiptLine = z.object({ purchaseOrderLineId: required("PO line"), productId: required("Product"), variantId: z.string().optional(), receivedQuantity: z.number().nonnegative(), damagedQuantity: z.number().nonnegative(), rejectedQuantity: z.number().nonnegative(), batchNumber: z.string().trim().optional(), serialNumbers: z.array(z.string()), manufacturedDate: z.string().optional(), expiryDate: z.string().optional() }).refine((line) => line.receivedQuantity + line.damagedQuantity + line.rejectedQuantity > 0, { message: "Enter a received, damaged, or rejected quantity." });
export const grnSchema = z.object({ purchaseOrderId: required("Purchase order"), warehouseId: required("Warehouse"), locationId: required("Location"), receivedDate: date("Received date"), notes: z.string().trim().max(1000).optional(), items: z.array(receiptLine).min(1) });
export const purchaseInvoiceSchema = z.object({ purchaseOrderId: required("Purchase order"), grnId: z.string().optional(), supplierInvoiceNumber: required("Supplier invoice number"), invoiceDate: date("Invoice date"), dueDate: date("Due date"), paymentTerms: required("Payment terms"), notes: z.string().trim().max(1000).optional(), items: uniqueLines }).refine((value) => Date.parse(value.dueDate) >= Date.parse(value.invoiceDate), { path: ["dueDate"], message: "Due date cannot be before invoice date." });
export const purchaseReturnSchema = z.object({ purchaseOrderId: required("Purchase order"), grnId: required("GRN"), warehouseId: required("Warehouse"), locationId: required("Location"), reason: required("Reason").max(240), notes: z.string().trim().max(1000).optional(), items: z.array(z.object({ productId: required("Product"), variantId: z.string().optional(), quantity: z.number().positive(), batchReference: z.string().optional(), serialReferences: z.array(z.string()) })).min(1) });

export type PurchaseRequestFormValues = z.infer<typeof purchaseRequestSchema>;
export type RfqFormValues = z.infer<typeof rfqSchema>;
export type SupplierQuotationFormValues = z.infer<typeof supplierQuotationSchema>;
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
export type GrnFormValues = z.infer<typeof grnSchema>;
export type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;
export type PurchaseReturnFormValues = z.infer<typeof purchaseReturnSchema>;
