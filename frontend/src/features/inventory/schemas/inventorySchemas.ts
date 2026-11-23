import { z } from "zod";

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required. Please enter a valid ${label.toLowerCase()} to continue.`)
    .max(max, `${label} cannot exceed ${max} characters. Please shorten it to proceed.`);
const code = z
  .string()
  .trim()
  .min(2, "Code must be at least 2 characters. Please enter a longer code.")
  .max(30, "Code cannot exceed 30 characters. Please shorten the code.")
  .regex(/^[A-Za-z0-9-]+$/, "Code contains invalid characters. Please use only letters, numbers, and hyphens.");

export const warehouseSchema = z.object({
  name: requiredText("Warehouse name"),
  code: code.optional(),
  branchId: requiredText("Branch"),
  address: requiredText("Address", 240),
  managerId: z.string().optional(),
  description: z.string().trim().max(500).optional(),
  type: z.enum(["warehouse", "store", "transit"], { error: "Please select a warehouse type from the options." }),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export const stockLocationSchema = z.object({
  name: requiredText("Location name").refine(
    (value) => /[a-zA-Z\p{L}]/u.test(value),
    "Location name cannot consist only of numbers or special characters. Please include letters in the name.",
  ),
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
  quantity: z.number().positive("Quantity must be greater than zero. Please enter a positive amount."),
  batchReference: z.string().trim().optional(),
  serialReferences: z.array(z.string().trim().min(1)),
});
const workflowLinesSchema = z
  .array(workflowLineSchema)
  .min(1, "Please add at least one product line to proceed.")
  .superRefine((lines, context) => {
    const seen = new Set<string>();
    lines.forEach((line, index) => {
      const key = `${line.productId}:${line.variantId ?? ""}`;
      if (seen.has(key))
        context.addIssue({ code: "custom", path: [index, "productId"], message: "Each product or variant can only be added once. Please adjust the quantity on the existing line instead." });
      seen.add(key);
    });
  });

const locationFields = {
  branchId: requiredText("Branch"),
  warehouseId: requiredText("Warehouse"),
  locationId: requiredText("Location"),
};

export const openingStockSchema = z.object({
  ...locationFields,
  quantity: z.number().positive("Opening quantity must be greater than zero. Please enter a positive amount."),
  batchReference: z.string().trim().max(80).optional(),
  expiryDate: z.string().trim().optional(),
  serialReferences: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().trim().max(500).optional(),
});

export type OpeningStockFormValues = z.infer<typeof openingStockSchema>;

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
    if (value.sourceBranchId && value.destinationBranchId && value.sourceBranchId === value.destinationBranchId) {
      context.addIssue({
        code: "custom",
        path: ["destinationBranchId"],
        message: "Source and destination branches must be different. Please select a different destination branch.",
      });
    }
    if (value.sourceWarehouseId && value.destinationWarehouseId && value.sourceWarehouseId === value.destinationWarehouseId) {
      context.addIssue({
        code: "custom",
        path: ["destinationWarehouseId"],
        message: "Source and destination warehouses must be different. Please select a different destination warehouse.",
      });
    }
    if (value.sourceLocationId && value.destinationLocationId && value.sourceLocationId === value.destinationLocationId) {
      context.addIssue({
        code: "custom",
        path: ["destinationLocationId"],
        message: "Source and destination locations must be different. Please select a different destination location.",
      });
    }
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
        message: "Requesting and source branches must be different. Please select a different source branch.",
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
        physicalQuantity: z.number().nonnegative("Physical quantity cannot be negative. Please enter 0 or a positive count."),
      }),
    )
    .min(1, "Please add at least one product to the stock count."),
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
      context.addIssue({ code: "custom", path: ["condition"], message: "Wastage workflow requires the condition to be marked as wastage. Please select 'wastage'." });
    if (value.workflowType === "return" && value.condition === "wastage")
      context.addIssue({ code: "custom", path: ["condition"], message: "Returns cannot be marked as wastage. Please select 'usable' or 'damaged'." });
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
      .int("Expiry warning days must be a whole number. Please enter an integer between 1 and 365.")
      .min(1, "Expiry warning must be at least 1 day. Please enter a value between 1 and 365.")
      .max(365, "Expiry warning cannot exceed 365 days. Please enter a value between 1 and 365."),
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
      message: "Batch and serial tracking cannot both be enabled as default. Please choose either batch or serial tracking.",
    },
  );

export type InventorySettingsFormValues = z.infer<
  typeof inventorySettingsSchema
>;
