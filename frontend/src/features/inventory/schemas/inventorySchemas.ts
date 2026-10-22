import { z } from "zod";

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
const code = z
  .string()
  .trim()
  .min(2, "Code must be at least 2 characters.")
  .max(30)
  .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, and hyphens only.");

export const warehouseSchema = z.object({
  name: requiredText("Warehouse name"),
  code,
  branchId: requiredText("Branch"),
  address: requiredText("Address", 240),
  managerId: z.string().optional(),
  description: z.string().trim().max(500).optional(),
  type: z.enum(["warehouse", "store", "transit"]),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export const stockLocationSchema = z.object({
  name: requiredText("Location name"),
  code,
  warehouseId: requiredText("Warehouse"),
  type: z
    .enum(["storage", "receiving", "dispatch", "shelf", "returns", "other"])
    .optional(),
  zone: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean(),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;
export type StockLocationFormValues = z.infer<typeof stockLocationSchema>;

const workflowLineSchema = z.object({
  productId: requiredText("Product"),
  variantId: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero."),
  batchReference: z.string().trim().optional(),
  serialReferences: z.array(z.string().trim().min(1)),
});
const workflowLinesSchema = z
  .array(workflowLineSchema)
  .min(1, "Add at least one product.")
  .superRefine((lines, context) => {
    const seen = new Set<string>();
    lines.forEach((line, index) => {
      const key = `${line.productId}:${line.variantId ?? ""}`;
      if (seen.has(key))
        context.addIssue({ code: "custom", path: [index, "productId"], message: "Each product or variant can only be added once." });
      seen.add(key);
    });
  });

const locationFields = {
  branchId: requiredText("Branch"),
  warehouseId: requiredText("Warehouse"),
  locationId: requiredText("Location"),
};

export const stockAdjustmentSchema = z.object({
  ...locationFields,
  direction: z.enum(["increase", "decrease"]),
  reason: requiredText("Reason", 240),
  notes: z.string().trim().max(1000).optional(),
  lines: workflowLinesSchema,
});

export const stockTransferSchema = z
  .object({
    sourceBranchId: requiredText("Source branch"),
    sourceWarehouseId: requiredText("Source warehouse"),
    sourceLocationId: requiredText("Source location"),
    destinationBranchId: requiredText("Destination branch"),
    destinationWarehouseId: requiredText("Destination warehouse"),
    destinationLocationId: requiredText("Destination location"),
    notes: z.string().trim().max(1000).optional(),
    lines: workflowLinesSchema,
  })
  .superRefine((value, context) => {
    if (value.sourceLocationId === value.destinationLocationId)
      context.addIssue({
        code: "custom",
        path: ["destinationLocationId"],
        message: "Source and destination locations must be different.",
      });
  });

export const branchStockRequestSchema = z
  .object({
    requestingBranchId: requiredText("Requesting branch"),
    requestedFromBranchId: requiredText("Source branch"),
    destinationWarehouseId: requiredText("Destination warehouse"),
    destinationLocationId: requiredText("Destination location"),
    reason: requiredText("Reason", 240),
    notes: z.string().trim().max(1000).optional(),
    lines: workflowLinesSchema,
  })
  .superRefine((value, context) => {
    if (value.requestingBranchId === value.requestedFromBranchId)
      context.addIssue({
        code: "custom",
        path: ["requestedFromBranchId"],
        message: "Requesting and source branches must be different.",
      });
  });

export const stockCountSchema = z.object({
  ...locationFields,
  reason: requiredText("Reason", 240),
  notes: z.string().trim().max(1000).optional(),
    lines: z
    .array(
      workflowLineSchema.extend({
        systemQuantity: z.number().nonnegative(),
        physicalQuantity: z.number().nonnegative("Physical quantity cannot be negative."),
      }),
    )
    .min(1, "Add at least one product."),
});

export const stockReturnWastageSchema = z
  .object({
    ...locationFields,
    workflowType: z.enum(["return", "wastage"]),
    condition: z.enum(["usable", "damaged", "wastage"]),
    reason: requiredText("Reason", 240),
    notes: z.string().trim().max(1000).optional(),
    lines: workflowLinesSchema,
  })
  .superRefine((value, context) => {
    if (value.workflowType === "wastage" && value.condition !== "wastage")
      context.addIssue({ code: "custom", path: ["condition"], message: "Wastage must use the wastage condition." });
    if (value.workflowType === "return" && value.condition === "wastage")
      context.addIssue({ code: "custom", path: ["condition"], message: "Returns must be marked usable or damaged." });
  });

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>;
export type StockTransferFormValues = z.infer<typeof stockTransferSchema>;
export type BranchStockRequestFormValues = z.infer<
  typeof branchStockRequestSchema
>;
export type StockCountFormValues = z.infer<typeof stockCountSchema>;
export type StockReturnWastageFormValues = z.infer<
  typeof stockReturnWastageSchema
>;

export const inventorySettingsSchema = z
  .object({
    branchId: requiredText("Branch"),
    defaultWarehouseId: requiredText("Default warehouse"),
    defaultLocationId: requiredText("Default location"),
    negativeStockBehavior: z.enum(["block", "warn", "allow"]),
    reorderAlertsEnabled: z.boolean(),
    expiryWarningDays: z
      .number()
      .int("Expiry warning days must be a whole number.")
      .min(1, "Use at least 1 day.")
      .max(365, "Use 365 days or fewer."),
    defaultBatchTracking: z.boolean(),
    defaultSerialTracking: z.boolean(),
    stockCountFrequency: z.enum(["daily", "weekly", "monthly", "quarterly"]),
    showSystemQuantityDuringCount: z.boolean(),
    requireCountReason: z.boolean(),
    requireAdjustmentApproval: z.boolean(),
    requireTransferApproval: z.boolean(),
    requireCountApproval: z.boolean(),
  })
  .refine(
    (value) => !(value.defaultBatchTracking && value.defaultSerialTracking),
    {
      path: ["defaultSerialTracking"],
      message: "Batch and serial tracking cannot both be the default.",
    },
  );

export type InventorySettingsFormValues = z.infer<
  typeof inventorySettingsSchema
>;
