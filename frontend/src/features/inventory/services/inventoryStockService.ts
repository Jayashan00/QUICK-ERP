import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { inventoryStore } from "./inventoryStore";
import { calculateAvailableQuantity } from "../utils/stockCalculations";
import type {
  ProductStockStatus,
  ProductStockSummary,
  StockBalance,
} from "../types/inventory";

function requireScope(scope: TenantBranchScope) {
  if (!scope.tenantId.trim()) throw new Error("Tenant context is required.");
  if (!scope.branchId.trim()) throw new Error("Branch context is required.");
}

function stockStatus(
  trackInventory: boolean,
  quantityAvailable: number,
  reorderLevel?: number,
): ProductStockStatus {
  if (!trackInventory) return "not_tracked";
  if (quantityAvailable <= 0) return "out_of_stock";
  if (reorderLevel !== undefined && quantityAvailable <= reorderLevel)
    return "low_stock";
  return "in_stock";
}

function productBalances(
  scope: TenantBranchScope,
  productId: string,
): StockBalance[] {
  return inventoryStore
    .balances()
    .filter(
      (item) =>
        item.tenantId === scope.tenantId &&
        item.branchId === scope.branchId &&
        item.productId === productId,
    );
}

export const inventoryStockService = {
  getProductSummary(
    scope: TenantBranchScope,
    productId: string,
    options: { trackInventory: boolean; reorderLevel?: number },
  ): ProductStockSummary {
    requireScope(scope);
    const balances = productBalances(scope, productId);
    const quantityOnHand = balances.reduce(
      (total, item) => total + item.quantityOnHand,
      0,
    );
    const quantityReserved = balances.reduce(
      (total, item) => total + item.quantityReserved,
      0,
    );
    const quantityCommitted = balances.reduce(
      (total, item) => total + item.quantityCommitted,
      0,
    );
    const quantityAvailable = calculateAvailableQuantity(
      quantityOnHand,
      quantityCommitted,
    );
    const reorderLevel =
      balances.length > 0
        ? balances.reduce((total, item) => total + item.reorderLevel, 0)
        : options.reorderLevel;
    return {
      branchId: scope.branchId,
      quantityOnHand,
      quantityReserved,
      quantityAvailable,
      reorderLevel,
      status: stockStatus(
        options.trackInventory,
        quantityAvailable,
        reorderLevel,
      ),
    };
  },

  hasProductRecords(tenantId: string, productId: string) {
    if (!tenantId.trim()) throw new Error("Tenant context is required.");
    return inventoryStore
      .balances()
      .some(
        (item) => item.tenantId === tenantId && item.productId === productId,
      );
  },
};
