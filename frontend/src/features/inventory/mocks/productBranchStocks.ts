import type { StockBalance } from "../types/inventory";
import { calculateAvailableQuantity } from "../utils/stockCalculations";

type BalanceSeed = Omit<
  StockBalance,
  "id" | "createdAt" | "updatedAt" | "quantityAvailable"
>;

const storageByBranch: Record<
  string,
  { warehouseId: string; locationId: string }
> = {
  "branch-001": { warehouseId: "warehouse-hq-main", locationId: "loc-hq-main" },
  "branch-002": {
    warehouseId: "warehouse-west-main",
    locationId: "loc-west-main",
  },
  "branch-003": {
    warehouseId: "warehouse-midwest-main",
    locationId: "loc-midwest-main",
  },
  "branch-201": { warehouseId: "warehouse-t2-main", locationId: "loc-t2-main" },
};

const seeds: Array<
  Omit<
    BalanceSeed,
    "warehouseId" | "locationId" | "quantityCommitted" | "quantityInTransit"
  >
> = [
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-001",
    quantityOnHand: 18,
    quantityReserved: 4,
    reorderLevel: 8,
    minStockLevel: 5,
    batchReferences: ["LAP-SEP-26"],
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-002",
    quantityOnHand: 34,
    quantityReserved: 6,
    reorderLevel: 12,
    minStockLevel: 8,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-003",
    quantityOnHand: 17,
    quantityReserved: 3,
    reorderLevel: 20,
    minStockLevel: 15,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-004",
    quantityOnHand: 22,
    quantityReserved: 0,
    reorderLevel: 15,
    minStockLevel: 10,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-005",
    variantId: "variant-chair-graphite",
    quantityOnHand: 5,
    quantityReserved: 1,
    reorderLevel: 4,
    minStockLevel: 2,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-005",
    variantId: "variant-chair-black",
    quantityOnHand: 4,
    quantityReserved: 1,
    reorderLevel: 3,
    minStockLevel: 2,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-006",
    quantityOnHand: 0,
    quantityReserved: 0,
    reorderLevel: 60,
    minStockLevel: 40,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-010",
    quantityOnHand: 13,
    quantityReserved: 2,
    reorderLevel: 10,
    minStockLevel: 6,
    serialReferences: ["DRL-261001", "DRL-261002"],
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-011",
    quantityOnHand: 86,
    quantityReserved: 12,
    reorderLevel: 40,
    minStockLevel: 25,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-013",
    quantityOnHand: 2,
    quantityReserved: 0,
    reorderLevel: 0,
    minStockLevel: 0,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-001",
    productId: "prod-014",
    quantityOnHand: 41,
    quantityReserved: 9,
    reorderLevel: 50,
    minStockLevel: 30,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    productId: "prod-001",
    quantityOnHand: 7,
    quantityReserved: 2,
    reorderLevel: 8,
    minStockLevel: 5,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    productId: "prod-002",
    quantityOnHand: 11,
    quantityReserved: 3,
    reorderLevel: 12,
    minStockLevel: 8,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    productId: "prod-003",
    quantityOnHand: 4,
    quantityReserved: 1,
    reorderLevel: 20,
    minStockLevel: 15,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    productId: "prod-005",
    quantityOnHand: 3,
    quantityReserved: 1,
    reorderLevel: 7,
    minStockLevel: 4,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    productId: "prod-006",
    quantityOnHand: 74,
    quantityReserved: 8,
    reorderLevel: 60,
    minStockLevel: 40,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    productId: "prod-010",
    quantityOnHand: 5,
    quantityReserved: 1,
    reorderLevel: 10,
    minStockLevel: 6,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    productId: "prod-011",
    quantityOnHand: 18,
    quantityReserved: 4,
    reorderLevel: 40,
    minStockLevel: 25,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-002",
    productId: "prod-014",
    quantityOnHand: 56,
    quantityReserved: 7,
    reorderLevel: 50,
    minStockLevel: 30,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-003",
    productId: "prod-001",
    quantityOnHand: 12,
    quantityReserved: 1,
    reorderLevel: 8,
    minStockLevel: 5,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-003",
    productId: "prod-006",
    quantityOnHand: 108,
    quantityReserved: 16,
    reorderLevel: 60,
    minStockLevel: 40,
  },
  {
    tenantId: "tenant-001",
    branchId: "branch-003",
    productId: "prod-011",
    quantityOnHand: 43,
    quantityReserved: 5,
    reorderLevel: 40,
    minStockLevel: 25,
  },
  {
    tenantId: "tenant-002",
    branchId: "branch-201",
    productId: "prod-201",
    quantityOnHand: 44,
    quantityReserved: 6,
    reorderLevel: 18,
    minStockLevel: 10,
    batchReferences: ["COF-SEP-26"],
  },
];

const createdAt = "2026-01-01T00:00:00Z";

export const mockStockBalances: StockBalance[] = seeds.map((seed, index) => {
  // Committed is the canonical unavailable quantity; reserved is its visible subset.
  const quantityCommitted = seed.quantityReserved + (index % 4 === 0 ? 2 : 0);
  const quantityInTransit = index % 5 === 0 ? 6 : 0;
  return {
    ...seed,
    id: `stock-balance-${String(index + 1).padStart(3, "0")}`,
    warehouseId:
      storageByBranch[seed.branchId]?.warehouseId ??
      `${seed.branchId}-warehouse`,
    locationId:
      storageByBranch[seed.branchId]?.locationId ?? `${seed.branchId}-location`,
    quantityCommitted,
    quantityInTransit,
    quantityAvailable: calculateAvailableQuantity(
      seed.quantityOnHand,
      quantityCommitted,
    ),
    lastMovementAt: `2026-09-${String((index % 18) + 1).padStart(2, "0")}T10:00:00Z`,
    createdAt,
    updatedAt: "2026-09-24T00:00:00Z",
  };
});

export const mockProductBranchStocks = mockStockBalances;
