import { z } from "zod";

const required = (label: string) => z.string().trim().min(1, `${label} is required. Please enter or select a valid value.`);
const date = (label: string) => required(label).refine((value) => !Number.isNaN(Date.parse(value)), `${label} must be a valid date. Please enter or select a date in YYYY-MM-DD format.`);
const productLine = z.object({
  productId: required("Product"),
  variantId: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero. Please enter a positive amount."),
  unitPrice: z.number().nonnegative("Price cannot be negative. Please enter an amount of 0.00 or higher."),
  discountPercent: z.number().min(0, "Discount cannot be negative.").max(100, "Discount percentage cannot exceed 100%. Please enter a value from 0 to 100."),
  taxCode: z.string().optional(),
  taxPercent: z.number().min(0, "Tax cannot be negative.").max(100, "Tax percentage cannot exceed 100%. Please enter a value from 0 to 100."),
});
const uniqueLines = z.array(productLine).min(1, "Please add at least one item to proceed.").superRefine((items, context) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const key = `${item.productId}:${item.variantId ?? ""}`;
    if (seen.has(key)) context.addIssue({ code: "custom", path: [index, "productId"], message: "Each product or variant can only be added once. Please adjust the quantity on the existing line instead." });
    seen.add(key);
  });
});

export const purchaseRequestSchema = z.object({
  branchId: required("Branch"),
  warehouseId: required("Receiving warehouse"),
  departmentId: z.string().trim().optional(),
  costCenterId: z.string().trim().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  budgetReference: z.string().trim().max(100).optional(),
  requiredDate: date("Required date"),
  reason: required("Business reason").max(240),
  notes: z.string().trim().max(1000).optional(),
  items: uniqueLines,
  sourceReorder: z.object({
    balanceId: required("Stock balance"),
    branchId: required("Branch"),
    warehouseId: required("Warehouse"),
    locationId: required("Location"),
    available: z.number().nonnegative(),
    lowStockLevel: z.number().nonnegative(),
    suggestedQuantity: z.number().positive(),
  }).optional(),
});
export const rfqSchema = z.object({ purchaseRequestId: required("Purchase request"), supplierIds: z.array(z.string()).min(1, "Please select at least one supplier from the list."), requiredDeliveryDate: date("Required delivery date"), notes: z.string().trim().max(1000).optional() });
export const supplierQuotationSchema = z.object({ rfqId: required("RFQ"), supplierId: required("Supplier"), quotationNumber: required("Supplier quotation number"), quotationDate: date("Quotation date"), validityDate: date("Validity date"), deliveryDays: z.number().int("Delivery days must be a whole number.").positive("Delivery days must be greater than zero. Please enter 1 or more."), paymentTerms: required("Payment terms"), currency: required("Currency"), notes: z.string().trim().max(1000).optional(), items: uniqueLines }).refine((value) => Date.parse(value.validityDate) >= Date.parse(value.quotationDate), { path: ["validityDate"], message: "Validity date cannot be before quotation date. Please select a validity date on or after the quotation date." });
export const purchaseOrderSchema = z.object({ supplierId: required("Supplier"), branchId: required("Branch"), warehouseId: required("Warehouse"), orderDate: date("Order date"), expectedDeliveryDate: date("Expected delivery date"), paymentTerms: required("Payment terms"), currency: required("Currency"), directPurchaseReason: z.string().trim().max(500).optional(), notes: z.string().trim().max(1000).optional(), items: uniqueLines }).refine((value) => Date.parse(value.expectedDeliveryDate) >= Date.parse(value.orderDate), { path: ["expectedDeliveryDate"], message: "Delivery date cannot be before order date. Please select a delivery date on or after the order date." });
const receiptLine = z.object({ purchaseOrderLineId: required("PO line"), productId: required("Product"), variantId: z.string().optional(), receivedQuantity: z.number().nonnegative("Received quantity cannot be negative."), damagedQuantity: z.number().nonnegative("Damaged quantity cannot be negative."), rejectedQuantity: z.number().nonnegative("Rejected quantity cannot be negative."), batchNumber: z.string().trim().optional(), serialNumbers: z.array(z.string()), manufacturedDate: z.string().optional(), expiryDate: z.string().optional() }).refine((line) => line.receivedQuantity + line.damagedQuantity + line.rejectedQuantity > 0, { message: "Enter a received, damaged, or rejected quantity. At least one must be greater than zero." });
export const grnSchema = z.object({ purchaseOrderId: required("Purchase order"), warehouseId: required("Warehouse"), locationId: required("Location"), receivedDate: date("Received date"), notes: z.string().trim().max(1000).optional(), items: z.array(receiptLine).min(1, "Please add at least one received line item.") });
export const purchaseInvoiceSchema = z.object({ purchaseOrderId: required("Purchase order"), grnId: z.string().optional(), supplierInvoiceNumber: required("Supplier invoice number"), invoiceDate: date("Invoice date"), dueDate: date("Due date"), paymentTerms: required("Payment terms"), currency: z.string().trim().optional(), notes: z.string().trim().max(1000).optional(), items: uniqueLines }).refine((value) => Date.parse(value.dueDate) >= Date.parse(value.invoiceDate), { path: ["dueDate"], message: "Due date cannot be before invoice date. Please select a due date on or after the invoice date." });
export const purchaseReturnSchema = z.object({ purchaseOrderId: required("Purchase order"), grnId: required("GRN"), warehouseId: required("Warehouse"), locationId: required("Location"), reason: required("Reason").max(240), notes: z.string().trim().max(1000).optional(), items: z.array(z.object({ productId: required("Product"), variantId: z.string().optional(), quantity: z.number().positive("Return quantity must be greater than zero."), batchReference: z.string().optional(), serialReferences: z.array(z.string()) })).min(1, "Please add at least one item to return.") });

export type PurchaseRequestFormValues = z.infer<typeof purchaseRequestSchema>;
export type RfqFormValues = z.infer<typeof rfqSchema>;
export type SupplierQuotationFormValues = z.infer<typeof supplierQuotationSchema>;
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
export type GrnFormValues = z.infer<typeof grnSchema>;
export type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;
export type PurchaseReturnFormValues = z.infer<typeof purchaseReturnSchema>;
