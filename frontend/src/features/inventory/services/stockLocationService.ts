import {
  stockLocationSchema,
  type StockLocationFormValues,
} from "../schemas/inventorySchemas";
import { inventoryStore } from "./inventoryStore";
import type { StockLocation } from "../types/inventory";

export interface StockLocationListItem extends StockLocation {
  warehouseName: string;
  stockItemCount: number;
  canDelete: boolean;
}
export interface StockLocationListParams {
  search?: string;
  warehouseId?: string;
  status?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
  branchId?: string;
  permittedBranchIds?: string[];
}
const wait = () =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 180));
const enrich = (
  tenantId: string,
  item: StockLocation,
): StockLocationListItem => {
  const stockItemCount = inventoryStore
    .balances()
    .filter(
      (balance) =>
        balance.tenantId === tenantId && balance.locationId === item.id,
    ).length;
  return {
    ...item,
    warehouseName:
      inventoryStore
        .warehouses()
        .find(
          (warehouse) =>
            warehouse.tenantId === tenantId &&
            warehouse.id === item.warehouseId,
        )?.name ?? "Unknown warehouse",
    stockItemCount,
    canDelete: stockItemCount === 0,
  };
};

export const stockLocationService = {
  async list(tenantId: string, params: StockLocationListParams = {}) {
    await wait();
    let records = inventoryStore
      .locations()
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          (params.permittedBranchIds ?? []).includes(item.branchId),
      );
    if (params.branchId && params.branchId !== "all")
      records = records.filter((item) => item.branchId === params.branchId);
    if (params.search?.trim()) {
      const q = params.search.trim().toLocaleLowerCase();
      records = records.filter((item) =>
        [item.name, item.code, item.zone, item.description].some((value) =>
          value?.toLocaleLowerCase().includes(q),
        ),
      );
    }
    if (params.warehouseId && params.warehouseId !== "all")
      records = records.filter(
        (item) => item.warehouseId === params.warehouseId,
      );
    if (params.status && params.status !== "all")
      records = records.filter(
        (item) => item.isActive === (params.status === "active"),
      );
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    return {
      data: records
        .slice((page - 1) * pageSize, page * pageSize)
        .map((item) => enrich(tenantId, item)),
      total: records.length,
      page,
      pageSize,
    };
  },
  async options(
    tenantId: string,
    permittedBranchIds: string[],
    warehouseId?: string,
    includeInactive = false,
  ) {
    await wait();
    return inventoryStore
      .locations()
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          permittedBranchIds.includes(item.branchId) &&
          (!warehouseId || item.warehouseId === warehouseId) &&
          (includeInactive || item.isActive),
      )
      .map((item) => ({ ...item }));
  },
  async get(tenantId: string, permittedBranchIds: string[], id: string) {
    await wait();
    const item = inventoryStore
      .locations()
      .find(
        (record) =>
          record.tenantId === tenantId &&
          permittedBranchIds.includes(record.branchId) &&
          record.id === id,
      );
    return item ? enrich(tenantId, item) : null;
  },
  async create(
    tenantId: string,
    permittedBranchIds: string[],
    values: StockLocationFormValues,
  ) {
    await wait();
    const data = stockLocationSchema.parse(values);
    const warehouse = inventoryStore
      .warehouses()
      .find(
        (item) => item.tenantId === tenantId && item.id === data.warehouseId,
      );
    if (!warehouse) throw new Error("Selected warehouse is unavailable.");
    if (!permittedBranchIds.includes(warehouse.branchId))
      throw new Error("Selected warehouse is outside your permitted scope.");
    const normalizedCode = data.code.toUpperCase();
    if (
      inventoryStore
        .locations()
        .some(
          (item) =>
            item.tenantId === tenantId &&
            item.warehouseId === data.warehouseId &&
            item.code.toUpperCase() === normalizedCode,
        )
    )
      throw new Error(
        "This location code already exists in the selected warehouse.",
      );
    const now = new Date().toISOString();
    const item: StockLocation = {
      ...data,
      code: normalizedCode,
      type: data.type || undefined,
      zone: data.zone || undefined,
      description: data.description || undefined,
      id: `location-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      branchId: warehouse.branchId,
      createdAt: now,
      updatedAt: now,
    };
    inventoryStore.insertLocation(item);
    return { ...item };
  },
  async update(
    tenantId: string,
    permittedBranchIds: string[],
    id: string,
    values: StockLocationFormValues,
  ) {
    await wait();
    const index = inventoryStore
      .locations()
      .findIndex(
        (item) =>
          item.tenantId === tenantId &&
          permittedBranchIds.includes(item.branchId) &&
          item.id === id,
      );
    if (index < 0) throw new Error("Stock location not found.");
    const data = stockLocationSchema.parse(values);
    const warehouse = inventoryStore
      .warehouses()
      .find(
        (item) => item.tenantId === tenantId && item.id === data.warehouseId,
      );
    if (!warehouse) throw new Error("Selected warehouse is unavailable.");
    if (!permittedBranchIds.includes(warehouse.branchId))
      throw new Error("Selected warehouse is outside your permitted scope.");
    const normalizedCode = data.code.toUpperCase();
    if (
      inventoryStore
        .locations()
        .some(
          (item) =>
            item.tenantId === tenantId &&
            item.id !== id &&
            item.warehouseId === data.warehouseId &&
            item.code.toUpperCase() === normalizedCode,
        )
    )
      throw new Error(
        "This location code already exists in the selected warehouse.",
      );
    const current = inventoryStore.locations()[index];
    const item: StockLocation = {
      ...current,
      ...data,
      code: normalizedCode,
      type: data.type || undefined,
      zone: data.zone || undefined,
      description: data.description || undefined,
      tenantId,
      branchId: warehouse.branchId,
      updatedAt: new Date().toISOString(),
    };
    inventoryStore.replaceLocation(index, item);
    return { ...item };
  },
  async setActive(
    tenantId: string,
    permittedBranchIds: string[],
    id: string,
    isActive: boolean,
  ) {
    const item = await this.get(tenantId, permittedBranchIds, id);
    if (!item) throw new Error("Stock location not found.");
    return this.update(tenantId, permittedBranchIds, id, {
      name: item.name,
      code: item.code,
      warehouseId: item.warehouseId,
      type: item.type,
      zone: item.zone,
      description: item.description,
      isActive,
    });
  },
  async remove(tenantId: string, permittedBranchIds: string[], id: string) {
    const item = await this.get(tenantId, permittedBranchIds, id);
    if (!item) throw new Error("Stock location not found.");
    if (!item.canDelete)
      throw new Error(
        "Location cannot be deleted because stock balances are linked. Deactivate it instead.",
      );
    inventoryStore.removeLocation(tenantId, id);
  },
};
