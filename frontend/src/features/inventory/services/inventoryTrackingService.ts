import type { TenantBranchScope } from "@/core/tenant/dataScope";
import type { PaginatedResult } from '@/shared/types/common';
import { branchService } from "@/core/branch/branchService";
import { productStore } from "@/features/products/services/productStore";
import { productVariantStore } from "@/features/products/services/productVariantStore";
import {
  getExpiryState,
  getStockAlertStatus,
} from "../utils/stockCalculations";
import { inventoryStore } from "./inventoryStore";
import { inventoryService } from "./inventoryService";
import type {
  BatchListItem,
  BatchStatus,
  ExpiryStatus,
  ProductStockDetail,
  SerialListItem,
  SerialStatus,
  StockMovementLedgerItem,
  StockMovementType,
} from "../types/inventory";

export interface InventoryListParams {
  search?: string;
  branchId?: string;
  warehouseId?: string;
  locationId?: string;
  productId?: string;
  variantId?: string;
  permittedBranchIds?: string[];
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}
export interface BatchListParams extends InventoryListParams {
  status?: BatchStatus | "all";
  expiryStatus?: ExpiryStatus | "all";
  expiryThresholdDays?: number;
  expiryOnly?: boolean;
}
export interface SerialListParams extends InventoryListParams {
  status?: SerialStatus | "all";
}
export interface MovementLedgerParams extends InventoryListParams {
  movementType?: StockMovementType | "all";
  movementTypes?: StockMovementType[];
  dateFrom?: string;
  dateTo?: string;
}
export type { PaginatedResult } from '@/shared/types/common';
const wait = () =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 180));
function scopeBranches(scope: TenantBranchScope, params: InventoryListParams) {
  if (!scope.tenantId || !scope.branchId)
    throw new Error("Tenant and branch context are required.");
  const allowed = params.permittedBranchIds?.length
    ? params.permittedBranchIds
    : [scope.branchId];
  return params.branchId === "all"
    ? allowed
    : [params.branchId ?? scope.branchId].filter((id) => allowed.includes(id));
}
function variantName(variantId?: string) {
  const variant = variantId
    ? productVariantStore.all().find((item) => item.id === variantId)
    : undefined;
  return variant?.attributes.map((item) => item.value).join(" / ");
}
function sortAndPage<T>(
  rows: T[],
  params: InventoryListParams,
): PaginatedResult<T> {
  const field = params.sortField as keyof T | undefined;
  if (field) {
    const direction = params.sortOrder === "desc" ? -1 : 1;
    rows.sort(
      (left, right) =>
        String(left[field] ?? "").localeCompare(
          String(right[field] ?? ""),
          undefined,
          { numeric: true },
        ) * direction,
    );
  }
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}
async function context(tenantId: string) {
  const branches = await branchService.getAllBranches(tenantId);
  return {
    branches,
    branchName: (id: string) =>
      branches.find((item) => item.id === id)?.name ?? "Unknown branch",
    warehouseName: (id: string) =>
      inventoryStore
        .warehouses()
        .find((item) => item.tenantId === tenantId && item.id === id)?.name ??
      "Unknown warehouse",
    locationName: (id: string) =>
      inventoryStore
        .locations()
        .find((item) => item.tenantId === tenantId && item.id === id)?.name ??
      "Unknown location",
  };
}
function productIdentity(
  tenantId: string,
  productId: string,
  variantId?: string,
) {
  const product = productStore
    .all()
    .find((item) => item.tenantId === tenantId && item.id === productId);
  if (!product) return null;
  const variant = variantId
    ? productVariantStore
        .all()
        .find((item) => item.tenantId === tenantId && item.id === variantId)
    : undefined;
  return {
    product,
    variant,
    productName: product.name,
    sku: variant?.sku ?? product.sku,
    barcode: variant?.barcode ?? product.barcode,
    variantName: variantName(variantId),
  };
}
function matchesSearch(values: Array<string | undefined>, search?: string) {
  if (!search?.trim()) return true;
  const q = search.trim().toLocaleLowerCase();
  return values.some((value) => value?.toLocaleLowerCase().includes(q));
}

export const inventoryTrackingService = {
  async getProductOptions(
    tenantId: string,
    mode: "batch" | "serial" | "expiry" | "all",
  ) {
    await wait();
    return productStore
      .all()
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          (mode === "all" ||
            (mode === "batch" && item.trackByBatch) ||
            (mode === "serial" && item.trackBySerialNumber) ||
            (mode === "expiry" && item.trackByBatch && item.trackExpiry)),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        trackByBatch: item.trackByBatch,
        trackBySerialNumber: item.trackBySerialNumber,
      }));
  },
  async listBatches(
    scope: TenantBranchScope,
    params: BatchListParams = {},
  ): Promise<PaginatedResult<BatchListItem>> {
    await wait();
    const allowed = scopeBranches(scope, params);
    const labels = await context(scope.tenantId);
    let rows = inventoryStore
      .batches()
      .filter(
        (item) =>
          item.tenantId === scope.tenantId && allowed.includes(item.branchId),
      )
      .map((item): BatchListItem | null => {
        const identity = productIdentity(
          scope.tenantId,
          item.productId,
          item.variantId,
        );
        if (!identity?.product.trackByBatch) return null;
        const expiry =
          item.expiryDate && identity.product.trackExpiry
            ? getExpiryState(item.expiryDate, params.expiryThresholdDays ?? 30)
            : undefined;
        return {
          ...item,
          productName: identity.productName,
          sku: identity.sku,
          ...(identity.barcode ? { barcode: identity.barcode } : {}),
          ...(identity.variantName
            ? { variantName: identity.variantName }
            : {}),
          branchName: labels.branchName(item.branchId),
          warehouseName: labels.warehouseName(item.warehouseId),
          locationName: labels.locationName(item.locationId),
          ...(expiry
            ? {
                expiryStatus: expiry.status,
                daysRemaining: expiry.daysRemaining,
              }
            : {}),
        };
      })
      .filter((item): item is BatchListItem => Boolean(item));
    rows = rows.filter(
      (item) =>
        matchesSearch(
          [item.productName, item.sku, item.barcode, item.batchNumber],
          params.search,
        ) &&
        (!params.warehouseId || item.warehouseId === params.warehouseId) &&
        (!params.locationId || item.locationId === params.locationId) &&
        (!params.productId || item.productId === params.productId) &&
        (!params.variantId || item.variantId === params.variantId) &&
        (!params.status ||
          params.status === "all" ||
          item.status === params.status) &&
        (!params.expiryStatus ||
          params.expiryStatus === "all" ||
          item.expiryStatus === params.expiryStatus) &&
        (!params.expiryOnly || Boolean(item.expiryStatus)),
    );
    return sortAndPage(rows, params);
  },
  async listSerialNumbers(
    scope: TenantBranchScope,
    params: SerialListParams = {},
  ): Promise<PaginatedResult<SerialListItem>> {
    await wait();
    const allowed = scopeBranches(scope, params);
    const labels = await context(scope.tenantId);
    let rows = inventoryStore
      .serialNumbers()
      .filter(
        (item) =>
          item.tenantId === scope.tenantId && allowed.includes(item.branchId),
      )
      .map((item): SerialListItem | null => {
        const identity = productIdentity(
          scope.tenantId,
          item.productId,
          item.variantId,
        );
        if (!identity?.product.trackBySerialNumber) return null;
        return {
          ...item,
          productName: identity.productName,
          sku: identity.sku,
          ...(identity.barcode ? { barcode: identity.barcode } : {}),
          ...(identity.variantName
            ? { variantName: identity.variantName }
            : {}),
          branchName: labels.branchName(item.branchId),
          warehouseName: labels.warehouseName(item.warehouseId),
          locationName: labels.locationName(item.locationId),
        };
      })
      .filter((item): item is SerialListItem => Boolean(item));
    rows = rows.filter(
      (item) =>
        matchesSearch(
          [
            item.productName,
            item.sku,
            item.barcode,
            item.serialNumber,
            item.referenceNumber,
          ],
          params.search,
        ) &&
        (!params.warehouseId || item.warehouseId === params.warehouseId) &&
        (!params.locationId || item.locationId === params.locationId) &&
        (!params.productId || item.productId === params.productId) &&
        (!params.variantId || item.variantId === params.variantId) &&
        (!params.status ||
          params.status === "all" ||
          item.status === params.status),
    );
    return sortAndPage(rows, params);
  },
  async listMovements(
    scope: TenantBranchScope,
    params: MovementLedgerParams = {},
  ): Promise<PaginatedResult<StockMovementLedgerItem>> {
    await wait();
    const allowed = scopeBranches(scope, params);
    const labels = await context(scope.tenantId);
    let rows = inventoryStore
      .movements()
      .filter(
        (item) =>
          item.tenantId === scope.tenantId && allowed.includes(item.branchId),
      )
      .map((item): StockMovementLedgerItem | null => {
        const identity = productIdentity(
          scope.tenantId,
          item.productId,
          item.variantId,
        );
        if (!identity) return null;
        const sourceLocationId =
          item.sourceLocationId ??
          (item.quantity < 0 ? item.locationId : undefined);
        const destinationLocationId =
          item.destinationLocationId ??
          (item.quantity > 0 ? item.locationId : undefined);
        const sourceLocation = sourceLocationId
          ? inventoryStore
              .locations()
              .find(
                (location) =>
                  location.id === sourceLocationId &&
                  location.tenantId === scope.tenantId,
              )
          : undefined;
        const destinationLocation = destinationLocationId
          ? inventoryStore
              .locations()
              .find(
                (location) =>
                  location.id === destinationLocationId &&
                  location.tenantId === scope.tenantId,
              )
          : undefined;
        return {
          ...item,
          productName: identity.productName,
          sku: identity.sku,
          ...(identity.variantName
            ? { variantName: identity.variantName }
            : {}),
          branchName: labels.branchName(item.branchId),
          warehouseName: labels.warehouseName(item.warehouseId),
          locationName: labels.locationName(item.locationId),
          ...(sourceLocation
            ? {
                sourceLocationName: labels.locationName(sourceLocation.id),
                sourceBranchName: labels.branchName(sourceLocation.branchId),
              }
            : {}),
          ...(destinationLocation
            ? {
                destinationLocationName: labels.locationName(
                  destinationLocation.id,
                ),
                destinationBranchName: labels.branchName(
                  destinationLocation.branchId,
                ),
              }
            : {}),
        };
      })
      .filter((item): item is StockMovementLedgerItem => Boolean(item));
    rows = rows.filter(
      (item) =>
        matchesSearch(
          [
            item.productName,
            item.sku,
            item.referenceNumber,
            item.batchReference,
            ...(item.serialReferences ?? []),
          ],
          params.search,
        ) &&
        (!params.warehouseId || item.warehouseId === params.warehouseId) &&
        (!params.locationId || item.locationId === params.locationId) &&
        (!params.productId || item.productId === params.productId) &&
        (!params.variantId || item.variantId === params.variantId) &&
        (!params.movementType ||
          params.movementType === "all" ||
          item.type === params.movementType) &&
        (!params.movementTypes?.length ||
          params.movementTypes.includes(item.type)) &&
        (!params.dateFrom ||
          item.movementDate >= `${params.dateFrom}T00:00:00`) &&
        (!params.dateTo || item.movementDate <= `${params.dateTo}T23:59:59`),
    );
    return sortAndPage(rows, {
      ...params,
      sortField: params.sortField ?? "movementDate",
      sortOrder: params.sortOrder ?? "desc",
    });
  },
  async getProductStockDetail(
    scope: TenantBranchScope,
    productId: string,
    variantId: string | undefined,
    permittedBranchIds: string[],
  ): Promise<ProductStockDetail> {
    const identity = productIdentity(scope.tenantId, productId, variantId);
    if (!identity) throw new Error("Product not found.");
    const balances = (
      await inventoryService.listStockBalances(scope, {
        branchId: "all",
        permittedBranchIds,
      })
    ).filter(
      (item) =>
        item.productId === productId &&
        (!variantId || item.variantId === variantId),
    );
    const movementResult = await this.listMovements(scope, {
      branchId: "all",
      permittedBranchIds,
      productId,
      variantId,
      pageSize: 8,
    });
    const onHand = balances.reduce((sum, item) => sum + item.quantityOnHand, 0);
    const committed = balances.reduce(
      (sum, item) => sum + item.quantityCommitted,
      0,
    );
    const reserved = balances.reduce(
      (sum, item) => sum + item.quantityReserved,
      0,
    );
    const available = balances.reduce(
      (sum, item) => sum + item.quantityAvailable,
      0,
    );
    const inTransit = balances.reduce(
      (sum, item) => sum + item.quantityInTransit,
      0,
    );
    return {
      product: {
        id: identity.product.id,
        name: identity.product.name,
        sku: identity.product.sku,
        barcode: identity.product.barcode,
        trackByBatch: identity.product.trackByBatch,
        trackBySerialNumber: identity.product.trackBySerialNumber,
        trackExpiry: identity.product.trackExpiry,
        minStockLevel: identity.product.minStockLevel,
        reorderLevel: identity.product.reorderLevel,
        maxStockLevel: identity.product.maxStockLevel,
      },
      variant: identity.variant
        ? {
            id: identity.variant.id,
            sku: identity.variant.sku,
            name: identity.variantName ?? identity.variant.sku,
          }
        : undefined,
      totals: { onHand, available, committed, reserved, inTransit },
      alertStatus: getStockAlertStatus(
        available,
        identity.product.minStockLevel,
        identity.product.reorderLevel,
      ),
      balances,
      recentMovements: movementResult.data,
    };
  },
};
