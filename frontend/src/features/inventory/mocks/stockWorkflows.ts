import type { ApprovalRecord } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import type {
  BranchStockRequest,
  StockAdjustment,
  StockCount,
  StockReturnWastage,
  StockTransfer,
} from "../types/stockWorkflows";

const createdAt = "2026-09-25T08:00:00Z";
const pendingApproval = (reference: string): ApprovalRecord => ({
  status: "pending",
  submittedAt: createdAt,
  submittedBy: "Inventory Manager",
  history: [
    {
      id: `approval-${reference}`,
      status: "pending",
      actorId: "usr-002",
      actorName: "Inventory Manager",
      timestamp: createdAt,
      remarks: "Submitted for inventory approval.",
    },
  ],
});
const audit = (entityType: string, reference: string): AuditEntry[] => [
  {
    id: `audit-${reference}`,
    actorId: "usr-002",
    actorName: "Inventory Manager",
    action: "Submitted",
    entityType,
    entityId: reference,
    reference,
    timestamp: createdAt,
    tenantId: "tenant-001",
    branchId: "branch-001",
  },
];

export const mockStockAdjustments: StockAdjustment[] = [
  {
    id: "adjustment-workflow-001",
    tenantId: "tenant-001",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    referenceNumber: "ADJ-2026-0042",
    direction: "increase",
    reason: "Receiving count correction",
    notes: "One monitor was omitted from the receiving count.",
    status: "pending_approval",
    lines: [
      { id: "adjustment-line-001", productId: "prod-002", quantity: 1 },
    ],
    createdBy: "usr-002",
    createdByName: "Inventory Manager",
    approval: pendingApproval("ADJ-2026-0042"),
    auditEntries: audit("Stock Adjustment", "ADJ-2026-0042"),
    createdAt,
    updatedAt: createdAt,
  },
];

export const mockStockTransfers: StockTransfer[] = [
  {
    id: "transfer-workflow-001",
    tenantId: "tenant-001",
    referenceNumber: "TRF-2026-0078",
    sourceBranchId: "branch-001",
    sourceWarehouseId: "warehouse-hq-main",
    sourceLocationId: "loc-hq-main",
    destinationBranchId: "branch-002",
    destinationWarehouseId: "warehouse-west-main",
    destinationLocationId: "loc-west-main",
    status: "draft",
    notes: "Weekly replenishment for West Branch.",
    lines: [
      { id: "transfer-line-001", productId: "prod-002", quantity: 3 },
    ],
    createdBy: "usr-002",
    createdByName: "Inventory Manager",
    approval: { status: "pending", history: [] },
    auditEntries: audit("Stock Transfer", "TRF-2026-0078"),
    createdAt,
    updatedAt: createdAt,
  },
];

export const mockBranchStockRequests: BranchStockRequest[] = [
  {
    id: "stock-request-001",
    tenantId: "tenant-001",
    referenceNumber: "SRQ-2026-0012",
    requestingBranchId: "branch-002",
    requestedFromBranchId: "branch-001",
    destinationWarehouseId: "warehouse-west-main",
    destinationLocationId: "loc-west-main",
    reason: "Replenish fast-moving monitor stock",
    status: "pending_review",
    lines: [
      { id: "request-line-001", productId: "prod-002", quantity: 5 },
    ],
    createdBy: "usr-002",
    createdByName: "Inventory Manager",
    approval: pendingApproval("SRQ-2026-0012"),
    auditEntries: audit("Branch Stock Request", "SRQ-2026-0012"),
    createdAt,
    updatedAt: createdAt,
  },
];

export const mockStockCounts: StockCount[] = [
  {
    id: "stock-count-draft-001",
    tenantId: "tenant-001",
    referenceNumber: "CNT-2026-0020",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    reason: "Mobile cycle count",
    notes: "Draft started on the stockroom floor.",
    status: "draft",
    lines: [
      {
        id: "count-draft-line-001",
        productId: "prod-002",
        quantity: 0,
        systemQuantity: 18,
        physicalQuantity: 18,
        variance: 0,
      },
    ],
    createdBy: "usr-002",
    createdByName: "Inventory Manager",
    approval: { status: "pending", history: [] },
    auditEntries: audit("Stock Count", "CNT-2026-0020"),
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "stock-count-001",
    tenantId: "tenant-001",
    referenceNumber: "CNT-2026-0019",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    reason: "Weekly cycle count",
    status: "pending_review",
    lines: [
      {
        id: "count-line-001",
        productId: "prod-014",
        quantity: 1,
        systemQuantity: 41,
        physicalQuantity: 40,
        variance: -1,
      },
    ],
    createdBy: "usr-002",
    createdByName: "Inventory Manager",
    approval: pendingApproval("CNT-2026-0019"),
    auditEntries: audit("Stock Count", "CNT-2026-0019"),
    createdAt,
    updatedAt: createdAt,
  },
];

export const mockStockReturnsWastage: StockReturnWastage[] = [
  {
    id: "return-workflow-001",
    tenantId: "tenant-001",
    referenceNumber: "RET-2026-0013",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    workflowType: "return",
    condition: "usable",
    reason: "Customer return in resalable condition",
    status: "pending_approval",
    lines: [
      {
        id: "return-line-001",
        productId: "prod-010",
        quantity: 1,
        serialReferences: ["DRL-260944"],
      },
    ],
    createdBy: "usr-002",
    createdByName: "Inventory Manager",
    approval: pendingApproval("RET-2026-0013"),
    auditEntries: audit("Stock Return", "RET-2026-0013"),
    createdAt,
    updatedAt: createdAt,
  },
];
