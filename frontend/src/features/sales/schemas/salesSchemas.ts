import { z } from "zod";

const required = (label: string) =>
  z.string().trim().min(1, `${label} is required.`);
const date = (label: string) =>
  required(label).refine(
    (value) => !Number.isNaN(Date.parse(value)),
    `${label} must be valid.`,
  );
const salesLine = z.object({
  productId: required("Product"),
  variantId: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero."),
  unitPrice: z.number().nonnegative("Price cannot be negative."),
  discountPercent: z.number().min(0).max(100),
  taxPercent: z.number().min(0).max(100),
});
const uniqueLines = z
  .array(salesLine)
  .min(1, "Add at least one item.")
  .superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const key = `${item.productId}:${item.variantId ?? ""}`;
      if (seen.has(key))
        context.addIssue({
          code: "custom",
          path: [index, "productId"],
          message: "Each product or variant can only be added once.",
        });
      seen.add(key);
    });
  });
const common = {
  customerId: required("Customer"),
  branchId: required("Branch"),
  salespersonId: required("Salesperson"),
  notes: z.string().trim().max(1000).optional(),
  items: uniqueLines,
};
export const salesQuotationSchema = z
  .object({
    ...common,
    opportunityId: z.string().optional(),
    quotationDate: date("Quotation date"),
    expiryDate: date("Expiry date"),
    terms: required("Terms"),
    currency: required("Currency"),
  })
  .refine(
    (value) => Date.parse(value.expiryDate) >= Date.parse(value.quotationDate),
    {
      path: ["expiryDate"],
      message: "Expiry date cannot be before quotation date.",
    },
  );
export const salesOrderSchema = z
  .object({
    ...common,
    warehouseId: required("Warehouse"),
    orderDate: date("Order date"),
    expectedDeliveryDate: date("Expected delivery date"),
    deliveryAddress: required("Delivery address"),
    paymentTerms: required("Payment terms"),
    currency: required("Currency"),
  })
  .refine(
    (value) =>
      Date.parse(value.expectedDeliveryDate) >= Date.parse(value.orderDate),
    {
      path: ["expectedDeliveryDate"],
      message: "Delivery date cannot be before order date.",
    },
  );
const deliveryLine = z.object({
  salesOrderLineId: required("Order line"),
  productId: required("Product"),
  variantId: z.string().optional(),
  deliveredQuantity: z.number().positive(),
  batchReference: z.string().trim().optional(),
  serialReferences: z.array(z.string()),
});
export const deliverySchema = z.object({
  salesOrderId: required("Sales order"),
  warehouseId: required("Warehouse"),
  locationId: required("Location"),
  deliveryDate: date("Delivery date"),
  deliveryAddress: required("Delivery address"),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(deliveryLine).min(1),
});
export const salesInvoiceSchema = z
  .object({
    customerId: required("Customer"),
    branchId: required("Branch"),
    salespersonId: required("Salesperson"),
    salesOrderId: z.string().optional(),
    deliveryNoteId: z.string().optional(),
    invoiceDate: date("Invoice date"),
    dueDate: date("Due date"),
    paymentTerms: required("Payment terms"),
    currency: required("Currency"),
    notes: z.string().trim().max(1000).optional(),
    items: uniqueLines,
  })
  .refine(
    (value) => Date.parse(value.dueDate) >= Date.parse(value.invoiceDate),
    { path: ["dueDate"], message: "Due date cannot be before invoice date." },
  );
export const customerPaymentSchema = z.object({
  invoiceId: required("Invoice"),
  amount: z.number().positive(),
  paymentMethod: z.enum([
    "cash",
    "bank_transfer",
    "card",
    "cheque",
    "mobile_payment",
  ]),
  paymentDate: date("Payment date"),
  externalReference: z.string().trim().max(120).optional(),
});
export const salesReturnSchema = z.object({
  salesOrderId: required("Sales order"),
  deliveryNoteId: required("Delivery note"),
  invoiceId: z.string().optional(),
  warehouseId: required("Warehouse"),
  locationId: required("Location"),
  reason: required("Reason").max(240),
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: required("Product"),
        variantId: z.string().optional(),
        quantity: z.number().positive(),
        condition: z.enum(["usable", "damaged"]),
        batchReference: z.string().optional(),
        serialReferences: z.array(z.string()),
      }),
    )
    .min(1),
});
export const recurringInvoiceSchema = z
  .object({
    customerId: required("Customer"),
    branchId: required("Branch"),
    salespersonId: required("Salesperson"),
    frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    startDate: date("Start date"),
    endDate: z.string().optional(),
    paymentTerms: required("Payment terms"),
    currency: required("Currency"),
    notes: z.string().trim().max(1000).optional(),
    items: uniqueLines,
  })
  .refine(
    (value) =>
      !value.endDate ||
      Date.parse(value.endDate) >= Date.parse(value.startDate),
    { path: ["endDate"], message: "End date cannot be before start date." },
  );
export type SalesQuotationFormValues = z.infer<typeof salesQuotationSchema>;
export type SalesOrderFormValues = z.infer<typeof salesOrderSchema>;
export type DeliveryFormValues = z.infer<typeof deliverySchema>;
export type SalesInvoiceFormValues = z.infer<typeof salesInvoiceSchema>;
export type CustomerPaymentFormValues = z.infer<typeof customerPaymentSchema>;
export type SalesReturnFormValues = z.infer<typeof salesReturnSchema>;
export type RecurringInvoiceFormValues = z.infer<typeof recurringInvoiceSchema>;
