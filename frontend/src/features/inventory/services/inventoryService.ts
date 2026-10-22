import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { branchService } from "@/core/branch/branchService";
import { masterDataStore } from "@/features/products/services/masterDataStore";
import { productStore } from "@/features/products/services/productStore";
import { productVariantStore } from "@/features/products/services/productVariantStore";
import { inventoryStore } from "./inventoryStore";
import {
  calculateAvailableQuantity,
  getExpiryState,
  getStockAlertStatus,
} from "../utils/stockCalculations";
import type {
  InventoryDashboardData,
  StockBalance,
  StockBalanceListItem,
  StockMovementListItem,
  StockStatus,
  StockAlertStatus,
  StockSummary,
  Warehouse,
} from "../types/inventory";

export interface StockBalanceFilters {
  search?: string;
  status?: StockAlertStatus | "all";
  locationId?: string;
  warehouseId?: string;
  branchId?: string;
  permittedBranchIds?: string[];
}

export type StockSortField =
  | "productName"
  | "sku"
  | "branchName"
  | "warehouseName"
  | "locationName"
  | "quantityOnHand"
  | "quantityAvailable"
  | "quantityReserved"
  | "quantityInTransit"
  | "status"
  | "stockValue";
export type StockGroupMode = "branch" | "warehouse" | "location";
export interface StockLevelsParams extends StockBalanceFilters {
  sortField?: StockSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  groupBy?: StockGroupMode;
}
export interface StockGroupSummary {
  id: string;
  label: string;
  totalSkus: number;
  onHand: number;
  available: number;
  committed: number;
  lowStock: number;
  stockValue: number;
}
export interface StockLevelsResult {
  data: StockBalanceListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: StockSummary;
  groups: StockGroupSummary[];
}

export interface StockMovementFilters {
  productId?: string;
  locationId?: string;
  limit?: number;
}

const wait = (milliseconds = 180) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

function requireScope(scope: TenantBranchScope) {
  if (!scope.tenantId.trim()) throw new Error("Tenant context is required.");
  if (!scope.branchId.trim()) throw new Error("Branch context is required.");
}

function statusFor(
  balance: Pick<StockBalance, "quantityAvailable" | "reorderLevel">,
): StockStatus {
  if (balance.quantityAvailable <= 0) return "out_of_stock";
  if (balance.quantityAvailable <= balance.reorderLevel) return "low_stock";
  return "in_stock";
}

function variantLabel(variantId?: string) {
  if (!variantId) return undefined;
  const variant = productVariantStore
    .all()
    .find((item) => item.id === variantId);
  return variant?.attributes.map((attribute) => attribute.value).join(" / ");
}

function enrichBalance(balance: StockBalance): StockBalanceListItem | null {
  const product = productStore
    .all()
    .find(
      (item) =>
        item.id === balance.productId && item.tenantId === balance.tenantId,
    );
  const warehouse = inventoryStore
    .warehouses()
    .find(
      (item) =>
        item.id === balance.warehouseId && item.tenantId === balance.tenantId,
    );
  const location = inventoryStore
    .locations()
    .find(
      (item) =>
        item.id === balance.locationId && item.tenantId === balance.tenantId,
    );
  if (!product || !warehouse || !location) return null;
  const variant = balance.variantId
    ? productVariantStore
        .all()
        .find(
          (item) =>
            item.id === balance.variantId && item.tenantId === balance.tenantId,
        )
    : undefined;
  const uom = masterDataStore.uoms.find(
    (item) => item.id === product.uomId && item.tenantId === product.tenantId,
  );
  const unitCost = variant?.costPrice ?? product.costPrice;
  const quantityAvailable = calculateAvailableQuantity(
    balance.quantityOnHand,
    balance.quantityCommitted,
  );
  return {
    ...balance,
    quantityAvailable,
    reorderLevel: product.reorderLevel ?? balance.reorderLevel,
    minStockLevel: product.minStockLevel ?? balance.minStockLevel,
    batchReferences: balance.batchReferences
      ? [...balance.batchReferences]
      : undefined,
    serialReferences: balance.serialReferences
      ? [...balance.serialReferences]
      : undefined,
    productName: product.name,
    sku: variant?.sku ?? product.sku,
    barcode: variant?.barcode ?? product.barcode,
    variantName: variantLabel(balance.variantId),
    branchName: balance.branchId,
    warehouseName: warehouse.name,
    locationName: location.name,
    uomCode: uom?.code ?? "UNIT",
    unitCost,
    stockValue: balance.quantityOnHand * unitCost,
    status: statusFor(balance),
    alertStatus: getStockAlertStatus(
      quantityAvailable,
      product.minStockLevel,
      product.reorderLevel,
    ),
  };
}

function scopedBalances(scope: TenantBranchScope): StockBalanceListItem[] {
  requireScope(scope);
  return inventoryStore
    .balances()
    .filter(
      (item) =>
        item.tenantId === scope.tenantId && item.branchId === scope.branchId,
    )
    .map(enrichBalance)
    .filter((item): item is StockBalanceListItem => Boolean(item));
}

function buildSummary(balances: StockBalanceListItem[]): StockSummary {
  const productStatuses = new Map<string, StockAlertStatus>();
  const rank: Record<StockAlertStatus, number> = {
    healthy: 0,
    low_stock: 1,
    reorder_required: 2,
    out_of_stock: 3,
  };
  for (const balance of balances) {
    const current = productStatuses.get(balance.productId);
    if (!current || rank[balance.alertStatus] > rank[current]) {
      productStatuses.set(balance.productId, balance.alertStatus);
    }
  }
  const tenantIds = new Set(balances.map((item) => item.tenantId));
  const branchIds = new Set(balances.map((item) => item.branchId));
  const expiryStates = inventoryStore
    .batches()
    .filter(
      (item) =>
        tenantIds.has(item.tenantId) &&
        branchIds.has(item.branchId) &&
        Boolean(item.expiryDate) &&
        Boolean(
          productStore
            .all()
            .find(
              (product) =>
                product.tenantId === item.tenantId &&
                product.id === item.productId,
            )?.trackExpiry,
        ),
    )
    .map((item) => getExpiryState(item.expiryDate!, 30).status);
  return {
    trackedProducts: productStatuses.size,
    totalStockItems: balances.length,
    totalOnHandQuantity: balances.reduce(
      (total, item) => total + item.quantityOnHand,
      0,
    ),
    totalAvailableQuantity: balances.reduce(
      (total, item) => total + item.quantityAvailable,
      0,
    ),
    totalCommittedQuantity: balances.reduce(
      (total, item) => total + item.quantityCommitted,
      0,
    ),
    totalReservedQuantity: balances.reduce(
      (total, item) => total + item.quantityReserved,
      0,
    ),
    totalInTransitQuantity: balances.reduce(
      (total, item) => total + item.quantityInTransit,
      0,
    ),
    lowStockProducts: [...productStatuses.values()].filter(
      (status) => status === "low_stock" || status === "reorder_required",
    ).length,
    outOfStockProducts: [...productStatuses.values()].filter(
      (status) => status === "out_of_stock",
    ).length,
    reorderAlerts: balances.filter(
      (item) =>
        item.alertStatus === "reorder_required" ||
        item.alertStatus === "out_of_stock",
    ).length,
    expiringSoonBatches: expiryStates.filter(
      (status) => status === "expiring_soon",
    ).length,
    expiredBatches: expiryStates.filter((status) => status === "expired")
      .length,
    totalStockValue: balances.reduce(
      (total, item) => total + item.stockValue,
      0,
    ),
  };
}

function enrichMovements(
  scope: TenantBranchScope,
  filters: StockMovementFilters = {},
): StockMovementListItem[] {
  let movements = inventoryStore
    .movements()
    .filter(
      (item) =>
        item.tenantId === scope.tenantId && item.branchId === scope.branchId,
    );
  if (filters.productId)
    movements = movements.filter(
      (item) => item.productId === filters.productId,
    );
  if (filters.locationId)
    movements = movements.filter(
      (item) => item.locationId === filters.locationId,
    );
  const enriched = movements
    .map((movement) => {
      const product = productStore
        .all()
        .find(
          (item) =>
            item.id === movement.productId && item.tenantId === scope.tenantId,
        );
      const variant = movement.variantId
        ? productVariantStore
            .all()
            .find(
              (item) =>
                item.id === movement.variantId &&
                item.tenantId === scope.tenantId,
            )
        : undefined;
      const warehouse = inventoryStore
        .warehouses()
        .find(
          (item) =>
            item.id === movement.warehouseId &&
            item.tenantId === scope.tenantId,
        );
      const location = inventoryStore
        .locations()
        .find(
          (item) =>
            item.id === movement.locationId && item.tenantId === scope.tenantId,
        );
      if (!product || !warehouse || !location) return null;
      const item: StockMovementListItem = {
        ...movement,
        ...(movement.serialReferences
          ? { serialReferences: [...movement.serialReferences] }
          : {}),
        productName: product.name,
        sku: variant?.sku ?? product.sku,
        variantName: variantLabel(movement.variantId),
        warehouseName: warehouse.name,
        locationName: location.name,
      };
      return item;
    })
    .filter((item): item is StockMovementListItem => Boolean(item));
  return enriched
    .sort((left, right) => right.movementDate.localeCompare(left.movementDate))
    .slice(0, filters.limit);
}

export const inventoryService = {
  async listWarehouses(scope: TenantBranchScope): Promise<Warehouse[]> {
    requireScope(scope);
    await wait();
    return inventoryStore
      .warehouses()
      .filter(
        (item) =>
          item.tenantId === scope.tenantId && item.branchId === scope.branchId,
      )
      .map((item) => ({ ...item }));
  },

  async listStockBalances(
    scope: TenantBranchScope,
    filters: StockBalanceFilters = {},
  ) {
    await wait();
    const branches = await branchService.getAllBranches(scope.tenantId);
    const allowedBranchIds = filters.permittedBranchIds?.length
      ? filters.permittedBranchIds
      : [scope.branchId];
    const requestedBranchIds =
      filters.branchId === "all"
        ? allowedBranchIds
        : [filters.branchId ?? scope.branchId];
    let balances = inventoryStore
      .balances()
      .filter(
        (item) =>
          item.tenantId === scope.tenantId &&
          requestedBranchIds.includes(item.branchId) &&
          allowedBranchIds.includes(item.branchId),
      )
      .map(enrichBalance)
      .filter((item): item is StockBalanceListItem => Boolean(item))
      .map((item) => ({
        ...item,
        branchName:
          branches.find((branch) => branch.id === item.branchId)?.name ??
          "Unknown branch",
      }));
    if (filters.search?.trim()) {
      const search = filters.search.trim().toLocaleLowerCase();
      balances = balances.filter((item) =>
        [
          item.productName,
          item.sku,
          item.barcode,
          item.variantName,
          item.warehouseName,
          item.locationName,
        ].some((value) => value?.toLocaleLowerCase().includes(search)),
      );
    }
    if (filters.status && filters.status !== "all") {
      balances = balances.filter((item) => item.alertStatus === filters.status);
    }
    if (filters.locationId)
      balances = balances.filter(
        (item) => item.locationId === filters.locationId,
      );
    if (filters.warehouseId)
      balances = balances.filter(
        (item) => item.warehouseId === filters.warehouseId,
      );
    return balances;
  },

  async getStockSummary(scope: TenantBranchScope): Promise<StockSummary> {
    await wait();
    return buildSummary(scopedBalances(scope));
  },

  async getStockLevels(
    scope: TenantBranchScope,
    params: StockLevelsParams = {},
  ): Promise<StockLevelsResult> {
    const balances = await this.listStockBalances(scope, params);
    const field = params.sortField ?? "productName";
    const direction = params.sortOrder === "desc" ? -1 : 1;
    balances.sort((left, right) => {
      const a = left[field];
      const b = right[field];
      return (
        (typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b))) * direction
      );
    });
    const groupBy = params.groupBy ?? "branch";
    const groups = new Map<string, StockBalanceListItem[]>();
    for (const balance of balances) {
      const id =
        groupBy === "branch"
          ? balance.branchId
          : groupBy === "warehouse"
            ? balance.warehouseId
            : balance.locationId;
      groups.set(id, [...(groups.get(id) ?? []), balance]);
    }
    const groupRows: StockGroupSummary[] = [...groups.entries()].map(
      ([id, items]) => ({
        id,
        label:
          groupBy === "branch"
            ? (items[0]?.branchName ?? id)
            : groupBy === "warehouse"
              ? (items[0]?.warehouseName ?? id)
              : (items[0]?.locationName ?? id),
        totalSkus: new Set(
          items.map((item) => `${item.productId}:${item.variantId ?? ""}`),
        ).size,
        onHand: items.reduce((sum, item) => sum + item.quantityOnHand, 0),
        available: items.reduce((sum, item) => sum + item.quantityAvailable, 0),
        committed: items.reduce(
          (sum, item) => sum + item.quantityCommitted,
          0,
        ),
        lowStock: items.filter((item) => item.alertStatus !== "healthy").length,
        stockValue: items.reduce((sum, item) => sum + item.stockValue, 0),
      }),
    );
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    return {
      data: balances.slice((page - 1) * pageSize, page * pageSize),
      total: balances.length,
      page,
      pageSize,
      summary: buildSummary(balances),
      groups: groupRows,
    };
  },

  async listStockMovements(
    scope: TenantBranchScope,
    filters: StockMovementFilters = {},
  ) {
    requireScope(scope);
    await wait();
    return enrichMovements(scope, filters);
  },

  async getDashboard(
    scope: TenantBranchScope,
  ): Promise<InventoryDashboardData> {
    await wait();
    const balances = scopedBalances(scope);
    return {
      summary: buildSummary(balances),
      recentMovements: enrichMovements(scope, { limit: 6 }),
      attentionItems: balances
        .filter((item) => item.alertStatus !== "healthy")
        .sort((left, right) => left.quantityAvailable - right.quantityAvailable)
        .slice(0, 8)
        .map((item) => ({
          balanceId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          locationName: item.locationName,
          quantityAvailable: item.quantityAvailable,
          reorderLevel: item.reorderLevel,
          status: item.alertStatus,
        })),
    };
  },
};
