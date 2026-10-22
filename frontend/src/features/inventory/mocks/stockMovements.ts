import type { StockMovement, StockMovementType } from "../types/inventory";

interface MovementSeed {
  tenantId: string;
  branchId: string;
  warehouseId: string;
  locationId: string;
  productId: string;
  variantId?: string;
  type: StockMovementType;
  quantity: number;
  quantityBefore: number;
  referenceNumber: string;
  movementDate: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
  batchReference?: string;
  notes?: string;
}

const seeds: MovementSeed[] = [
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    productId: "prod-001",
    type: "goods_receipt",
    quantity: 10,
    quantityBefore: 8,
    referenceNumber: "GRN-2026-0194",
    movementDate: "2026-09-24T14:20:00Z",
    batchReference: "LAP-SEP-26",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    productId: "prod-014",
    type: "reservation",
    quantity: -6,
    quantityBefore: 47,
    referenceNumber: "SO-2026-0831",
    movementDate: "2026-09-24T11:05:00Z",
    notes: "Reserved for confirmed sales order.",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    productId: "prod-006",
    type: "sale",
    quantity: -12,
    quantityBefore: 12,
    referenceNumber: "INV-2026-1048",
    movementDate: "2026-09-23T16:42:00Z",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    productId: "prod-010",
    type: "adjustment_in",
    quantity: 1,
    quantityBefore: 12,
    referenceNumber: "ADJ-2026-0041",
    movementDate: "2026-09-23T09:18:00Z",
    notes: "Count variance recorded.",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    productId: "prod-011",
    type: "transfer_in",
    quantity: 8,
    quantityBefore: 35,
    referenceNumber: "TRF-2026-0077",
    movementDate: "2026-09-22T13:30:00Z",
    sourceLocationId: "loc-west-main",
    destinationLocationId: "loc-hq-main",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    warehouseId: "warehouse-west-main",
    locationId: "loc-west-main",
    productId: "prod-002",
    type: "adjustment_out",
    quantity: -2,
    quantityBefore: 13,
    referenceNumber: "ADJ-2026-0040",
    movementDate: "2026-09-22T15:25:00Z",
    notes: "Damaged units moved to write-off review.",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    productId: "prod-014",
    type: "stock_count",
    quantity: -1,
    quantityBefore: 42,
    referenceNumber: "CNT-2026-0018",
    movementDate: "2026-09-21T17:10:00Z",
    notes: "Cycle count correction approved by Inventory Manager.",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    warehouseId: "warehouse-west-main",
    locationId: "loc-west-main",
    productId: "prod-006",
    type: "goods_receipt",
    quantity: 50,
    quantityBefore: 24,
    referenceNumber: "GRN-2026-0189",
    movementDate: "2026-09-24T10:10:00Z",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    warehouseId: "warehouse-west-main",
    locationId: "loc-west-main",
    productId: "prod-003",
    type: "sale",
    quantity: -3,
    quantityBefore: 7,
    referenceNumber: "INV-2026-1039",
    movementDate: "2026-09-23T12:00:00Z",
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-003",
    warehouseId: "warehouse-midwest-main",
    locationId: "loc-midwest-main",
    productId: "prod-011",
    type: "transfer_out",
    quantity: -8,
    quantityBefore: 51,
    referenceNumber: "TRF-2026-0077",
    movementDate: "2026-09-22T09:00:00Z",
    destinationLocationId: "loc-hq-main",
  },
  {
    tenantId: "tenant-002",
    branchId: "branch-201",
    warehouseId: "warehouse-t2-main",
    locationId: "loc-t2-main",
    productId: "prod-201",
    type: "goods_receipt",
    quantity: 20,
    quantityBefore: 24,
    referenceNumber: "GRN-T2-0021",
    movementDate: "2026-09-24T08:30:00Z",
    batchReference: "COF-SEP-26",
  },
];

export const mockStockMovements: StockMovement[] = seeds.map((seed, index) => ({
  ...seed,
  id: `stock-movement-${String(index + 1).padStart(3, "0")}`,
  quantityAfter: seed.quantityBefore + seed.quantity,
  createdByName: index % 2 === 0 ? "Admin User" : "Inventory Manager",
  createdAt: seed.movementDate,
  updatedAt: seed.movementDate,
}));
