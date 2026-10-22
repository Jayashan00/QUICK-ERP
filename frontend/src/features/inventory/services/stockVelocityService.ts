import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { masterDataStore } from "@/features/products/services/masterDataStore";
import { productStore } from "@/features/products/services/productStore";
import { productVariantStore } from "@/features/products/services/productVariantStore";
import type {
  StockVelocityClass,
  StockVelocityItem,
  StockVelocitySortField,
} from "../types/stockVelocity";
import { inventoryStore } from "./inventoryStore";

export interface StockVelocityParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  productId?: string;
  velocityClass?: StockVelocityClass | "all";
  branchId?: string;
  warehouseId?: string;
  locationId?: string;
  permittedBranchIds?: string[];
  sortField?: StockVelocitySortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface StockVelocityResult {
  data: StockVelocityItem[];
  total: number;
  page: number;
  pageSize: number;
}

const wait = () =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 180));

function allowedBranches(scope: TenantBranchScope, params: StockVelocityParams) {
  if (!scope.tenantId || !scope.branchId)
    throw new Error("Tenant and branch context are required.");
  const permitted = params.permittedBranchIds?.length
    ? params.permittedBranchIds
    : [scope.branchId];
  return params.branchId === "all"
    ? permitted
    : [params.branchId ?? scope.branchId].filter((id) => permitted.includes(id));
}

function classify(quantity: number, count: number): StockVelocityClass {
  if (count === 0) return "no_movement";
  if (count >= 6 || quantity >= 30) return "fast";
  if (count >= 3 || quantity >= 10) return "medium";
  return "slow";
}

function identityKey(productId: string, variantId?: string) {
  return `${productId}:${variantId ?? ""}`;
}

const inboundTypes = new Set(["goods_receipt", "transfer_in", "adjustment_in", "return_in"]);
const outboundTypes = new Set(["sale", "transfer_out", "adjustment_out", "return_out", "wastage"]);
const dayMs = 86_400_000;

export const stockVelocityService = {
  async list(
    scope: TenantBranchScope,
    params: StockVelocityParams = {},
  ): Promise<StockVelocityResult> {
    await wait();
    if (params.dateFrom && params.dateTo && params.dateFrom > params.dateTo) {
      return { data: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 10 };
    }
    const branches = allowedBranches(scope, params);
    const inLocationScope = (item: {
      branchId: string;
      warehouseId: string;
      locationId: string;
    }) =>
      branches.includes(item.branchId) &&
      (!params.warehouseId || item.warehouseId === params.warehouseId) &&
      (!params.locationId || item.locationId === params.locationId);

    const balances = inventoryStore
      .balances()
      .filter(
        (item) => item.tenantId === scope.tenantId && inLocationScope(item),
      );
    const movements = inventoryStore
      .movements()
      .filter(
        (item) =>
          item.tenantId === scope.tenantId &&
          inLocationScope(item) &&
          (!params.dateFrom || item.movementDate >= `${params.dateFrom}T00:00:00`) &&
          (!params.dateTo || item.movementDate <= `${params.dateTo}T23:59:59`) &&
          (inboundTypes.has(item.type) || outboundTypes.has(item.type)),
      );
    const firstDate = movements.reduce((date, item) => !date || item.movementDate < date ? item.movementDate : date, "").slice(0, 10);
    const lastDate = movements.reduce((date, item) => item.movementDate > date ? item.movementDate : date, "").slice(0, 10);
    const start = params.dateFrom ?? firstDate;
    const end = params.dateTo ?? lastDate;
    const periodDays = start && end ? Math.max(1, Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayMs) + 1) : 1;
    const keys = new Set([
      ...balances.map((item) => identityKey(item.productId, item.variantId)),
      ...movements.map((item) => identityKey(item.productId, item.variantId)),
    ]);

    let rows = [...keys]
      .map((key): StockVelocityItem | null => {
        const [productId, variantIdValue] = key.split(":");
        const variantId = variantIdValue || undefined;
        const product = productStore
          .all()
          .find(
            (item) =>
              item.tenantId === scope.tenantId && item.id === productId,
          );
        if (!product) return null;
        const variant = variantId
          ? productVariantStore
              .all()
              .find(
                (item) =>
                  item.tenantId === scope.tenantId && item.id === variantId,
              )
          : undefined;
        const category = masterDataStore.categories.find(
          (item) =>
            item.tenantId === scope.tenantId && item.id === product.categoryId,
        );
        const itemBalances = balances.filter(
          (item) => identityKey(item.productId, item.variantId) === key,
        );
        const itemMovements = movements.filter(
          (item) => identityKey(item.productId, item.variantId) === key,
        );
        const movementQuantity = itemMovements.reduce(
          (sum, item) => sum + Math.abs(item.quantity),
          0,
        );
        const inboundQuantity = itemMovements.filter((item) => inboundTypes.has(item.type)).reduce((sum, item) => sum + Math.abs(item.quantity), 0);
        const outboundQuantity = itemMovements.filter((item) => outboundTypes.has(item.type)).reduce((sum, item) => sum + Math.abs(item.quantity), 0);
        const movementCount = itemMovements.length;
        const lastMovementAt = itemMovements
          .map((item) => item.movementDate)
          .sort((left, right) => right.localeCompare(left))[0];
        return {
          id: key,
          tenantId: scope.tenantId,
          productId,
          ...(variantId ? { variantId } : {}),
          productName: variant
            ? `${product.name} - ${variant.attributes.map((item) => item.value).join(" / ")}`
            : product.name,
          sku: variant?.sku ?? product.sku,
          categoryId: product.categoryId,
          categoryName: category?.name ?? "Uncategorized",
          stockOnHand: itemBalances.reduce(
            (sum, item) => sum + item.quantityOnHand,
            0,
          ),
          movementQuantity,
          inboundQuantity,
          outboundQuantity,
          inboundPerDay: inboundQuantity / periodDays,
          outboundPerDay: outboundQuantity / periodDays,
          movementCount,
          ...(lastMovementAt ? { lastMovementAt } : {}),
          velocityClass: classify(movementQuantity, movementCount),
        };
      })
      .filter((item): item is StockVelocityItem => Boolean(item));

    if (params.search?.trim()) {
      const search = params.search.trim().toLocaleLowerCase();
      rows = rows.filter((item) =>
        [item.productName, item.sku, item.categoryName].some((value) =>
          value.toLocaleLowerCase().includes(search),
        ),
      );
    }
    if (params.categoryId && params.categoryId !== "all")
      rows = rows.filter((item) => item.categoryId === params.categoryId);
    if (params.productId)
      rows = rows.filter((item) => item.productId === params.productId);
    if (params.velocityClass && params.velocityClass !== "all")
      rows = rows.filter((item) => item.velocityClass === params.velocityClass);

    const field = params.sortField ?? "movementQuantity";
    const direction = params.sortOrder === "asc" ? 1 : -1;
    const rank: Record<StockVelocityClass, number> = {
      no_movement: 0,
      slow: 1,
      medium: 2,
      fast: 3,
    };
    rows.sort((left, right) => {
      const a = field === "velocityClass" ? rank[left.velocityClass] : left[field];
      const b = field === "velocityClass" ? rank[right.velocityClass] : right[field];
      if (typeof a === "number" && typeof b === "number")
        return (a - b) * direction;
      return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
        numeric: true,
      }) * direction;
    });

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    return {
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  },
};
