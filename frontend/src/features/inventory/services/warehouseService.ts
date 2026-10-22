import { branchService } from "@/core/branch/branchService";
import { userService } from "@/core/auth/userService";
import {
  warehouseSchema,
  type WarehouseFormValues,
} from "../schemas/inventorySchemas";
import { inventoryStore } from "./inventoryStore";
import type { Warehouse } from "../types/inventory";

export interface WarehouseListItem extends Warehouse {
  branchName: string;
  managerName?: string;
  locationCount: number;
  stockItemCount: number;
  canDelete: boolean;
}
export interface WarehouseListParams {
  search?: string;
  branchId?: string;
  status?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
  permittedBranchIds?: string[];
}
export interface WarehouseListResult {
  data: WarehouseListItem[];
  total: number;
  page: number;
  pageSize: number;
}
const wait = () =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 180));

async function enrich(
  tenantId: string,
  warehouses: Warehouse[],
): Promise<WarehouseListItem[]> {
  const [branches, users] = await Promise.all([
    branchService.getAllBranches(tenantId),
    userService.getUserOptions(tenantId),
  ]);
  return warehouses.map((item) => {
    const locationCount = inventoryStore
      .locations()
      .filter(
        (location) =>
          location.tenantId === tenantId && location.warehouseId === item.id,
      ).length;
    const stockItemCount = inventoryStore
      .balances()
      .filter(
        (balance) =>
          balance.tenantId === tenantId && balance.warehouseId === item.id,
      ).length;
    return {
      ...item,
      branchName:
        branches.find((branch) => branch.id === item.branchId)?.name ??
        "Unknown branch",
      managerName: users.find((user) => user.id === item.managerId)?.name,
      locationCount,
      stockItemCount,
      canDelete: locationCount === 0 && stockItemCount === 0,
    };
  });
}

export const warehouseService = {
  async list(
    tenantId: string,
    params: WarehouseListParams = {},
  ): Promise<WarehouseListResult> {
    if (!tenantId) throw new Error("Tenant context is required.");
    let records = inventoryStore
      .warehouses()
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          (params.permittedBranchIds ?? []).includes(item.branchId),
      );
    if (params.search?.trim()) {
      const q = params.search.trim().toLocaleLowerCase();
      records = records.filter((item) =>
        [item.name, item.code, item.address, item.description].some((value) =>
          value?.toLocaleLowerCase().includes(q),
        ),
      );
    }
    if (params.branchId && params.branchId !== "all")
      records = records.filter((item) => item.branchId === params.branchId);
    if (params.status && params.status !== "all")
      records = records.filter(
        (item) => item.isActive === (params.status === "active"),
      );
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const total = records.length;
    return {
      data: await enrich(
        tenantId,
        records.slice((page - 1) * pageSize, page * pageSize),
      ),
      total,
      page,
      pageSize,
    };
  },
  async options(
    tenantId: string,
    permittedBranchIds: string[],
    branchId?: string,
    includeInactive = false,
  ) {
    await wait();
    return inventoryStore
      .warehouses()
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          permittedBranchIds.includes(item.branchId) &&
          (!branchId || item.branchId === branchId) &&
          (includeInactive || item.isActive),
      )
      .map((item) => ({ ...item }));
  },
  async get(tenantId: string, permittedBranchIds: string[], id: string) {
    const item = inventoryStore
      .warehouses()
      .find(
        (record) =>
          record.tenantId === tenantId &&
          permittedBranchIds.includes(record.branchId) &&
          record.id === id,
      );
    return item ? ((await enrich(tenantId, [item]))[0] ?? null) : null;
  },
  async create(
    tenantId: string,
    permittedBranchIds: string[],
    values: WarehouseFormValues,
  ) {
    await wait();
    const data = warehouseSchema.parse(values);
    const normalizedCode = data.code.toUpperCase();
    if (!permittedBranchIds.includes(data.branchId))
      throw new Error("Selected branch is outside your permitted scope.");
    if (
      inventoryStore
        .warehouses()
        .some(
          (item) =>
            item.tenantId === tenantId &&
            item.code.toUpperCase() === normalizedCode,
        )
    )
      throw new Error("A warehouse with this code already exists.");
    const branch = await branchService.getBranchById(tenantId, data.branchId);
    if (!branch) throw new Error("Selected branch is unavailable.");
    const now = new Date().toISOString();
    const item: Warehouse = {
      ...data,
      code: normalizedCode,
      managerId: data.managerId || undefined,
      description: data.description || undefined,
      id: `warehouse-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      createdAt: now,
      updatedAt: now,
    };
    inventoryStore.insertWarehouse(item);
    return { ...item };
  },
  async update(
    tenantId: string,
    permittedBranchIds: string[],
    id: string,
    values: WarehouseFormValues,
  ) {
    await wait();
    const index = inventoryStore
      .warehouses()
      .findIndex(
        (item) =>
          item.tenantId === tenantId &&
          permittedBranchIds.includes(item.branchId) &&
          item.id === id,
      );
    if (index < 0) throw new Error("Warehouse not found.");
    const data = warehouseSchema.parse(values);
    const normalizedCode = data.code.toUpperCase();
    if (!permittedBranchIds.includes(data.branchId))
      throw new Error("Selected branch is outside your permitted scope.");
    if (
      inventoryStore
        .warehouses()
        .some(
          (item) =>
            item.tenantId === tenantId &&
            item.id !== id &&
            item.code.toUpperCase() === normalizedCode,
        )
    )
      throw new Error("A warehouse with this code already exists.");
    const branch = await branchService.getBranchById(tenantId, data.branchId);
    if (!branch) throw new Error("Selected branch is unavailable.");
    const current = inventoryStore.warehouses()[index];
    const item: Warehouse = {
      ...current,
      ...data,
      code: normalizedCode,
      managerId: data.managerId || undefined,
      description: data.description || undefined,
      tenantId,
      updatedAt: new Date().toISOString(),
    };
    inventoryStore.replaceWarehouse(index, item);
    return { ...item };
  },
  async setActive(
    tenantId: string,
    permittedBranchIds: string[],
    id: string,
    isActive: boolean,
  ) {
    const item = await this.get(tenantId, permittedBranchIds, id);
    if (!item) throw new Error("Warehouse not found.");
    return this.update(tenantId, permittedBranchIds, id, {
      name: item.name,
      code: item.code,
      branchId: item.branchId,
      address: item.address,
      managerId: item.managerId,
      description: item.description,
      type: item.type,
      isDefault: item.isDefault,
      isActive,
    });
  },
  async remove(tenantId: string, permittedBranchIds: string[], id: string) {
    await wait();
    const item = await this.get(tenantId, permittedBranchIds, id);
    if (!item) throw new Error("Warehouse not found.");
    if (!item.canDelete)
      throw new Error(
        "Warehouse cannot be deleted because stock or locations are linked. Deactivate it instead.",
      );
    inventoryStore.removeWarehouse(tenantId, id);
  },
};
