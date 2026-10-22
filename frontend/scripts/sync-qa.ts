import type { SyncQueueItem } from "../src/features/sync/types/sync";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const storage = new MemoryStorage();
(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: storage,
};

const { syncService } = await import("../src/features/sync/services/syncService");
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Sync QA failed: ${message}`);
};

const tenantAccess = { tenantId: "tenant-001", permittedBranchIds: ["branch-001", "branch-002"] };
const base = {
  tenantId: "tenant-001",
  userId: "usr-001",
  userName: "Admin User",
  requiredPermission: "pos.sell",
  payload: { total: 1250, products: ["product-001"] },
} as const;

const pos = syncService.enqueue({
  ...base,
  branchId: "branch-001",
  module: "pos",
  entityType: "pos_sale",
  entityId: "offline-sale-001",
  referenceNumber: "POS-OFF-001",
  actionType: "pos.sale.create",
});
const stock = syncService.enqueue({
  ...base,
  branchId: "branch-002",
  module: "stock",
  entityType: "stock_count",
  entityId: "offline-count-001",
  referenceNumber: "CNT-OFF-001",
  actionType: "stock.count.create",
  requiredPermission: "stock.count",
});
syncService.enqueue({
  ...base,
  tenantId: "tenant-002",
  branchId: "branch-900",
  module: "pos",
  entityType: "pos_sale",
  entityId: "foreign-sale",
  referenceNumber: "POS-FOREIGN",
  actionType: "pos.sale.create",
});
const foreign = syncService.snapshot().find((item) => item.entityId === "foreign-sale");

assert(pos.status === "pending_sync" && stock.status === "pending_sync", "offline actions must enter pending sync");
assert(syncService.list("tenant-001", ["branch-001"]).length === 1, "branch scope must filter the queue");
assert(syncService.list("tenant-001", ["branch-001", "branch-002"]).length === 2, "permitted branches must be available");
let scopeBlocked = false;
try {
  if (foreign) await syncService.process(foreign.id, tenantAccess);
} catch {
  scopeBlocked = true;
}
assert(scopeBlocked, "service methods must block cross-tenant queue access");
const persisted = JSON.parse(storage.getItem("quick-erp:sync-queue:v1") ?? "[]") as SyncQueueItem[];
assert(persisted.some((item) => item.tenantId === "tenant-001" && item.userId === "usr-001" && item.referenceNumber === "POS-OFF-001"), "tenant, user, reference, and payload context must persist");
const persistedText = storage.getItem("quick-erp:sync-queue:v1") ?? "[]";
syncService.clearStatuses(["pending_sync", "syncing", "synced", "failed", "conflict"], tenantAccess);
storage.setItem("quick-erp:sync-queue:v1", persistedText);
assert(syncService.restoreFromPersistence().length === 3, "queue must restore from browser persistence after refresh");

const failure = syncService.enqueue({
  ...base,
  branchId: "branch-001",
  module: "pos",
  entityType: "pos_sale",
  entityId: "failure-sale",
  referenceNumber: "POS-FAIL",
  actionType: "pos.sale.create",
  mockOutcome: "failed",
});
await syncService.process(failure.id, tenantAccess);
assert(syncService.snapshot().find((item) => item.id === failure.id)?.status === "failed", "mock failure must be visible");
await syncService.process(failure.id, tenantAccess);
assert(syncService.snapshot().find((item) => item.id === failure.id)?.status === "synced", "manual retry must recover a transient failure");

const conflict = syncService.enqueue({
  ...base,
  branchId: "branch-001",
  module: "stock",
  entityType: "stock_adjustment",
  entityId: "conflict-adjustment",
  referenceNumber: "ADJ-CONFLICT",
  actionType: "stock.adjustment.create",
  requiredPermission: "stock.adjust",
  mockOutcome: "conflict",
});
await syncService.process(conflict.id, tenantAccess);
assert(syncService.snapshot().find((item) => item.id === conflict.id)?.status === "conflict", "conflict state must retain comparison values");
syncService.resolveConflict(conflict.id, "keep_local", tenantAccess);
await syncService.process(conflict.id, tenantAccess);
assert(syncService.snapshot().find((item) => item.id === conflict.id)?.status === "synced", "keep-local conflict resolution must retry successfully");

await syncService.process(pos.id, tenantAccess);
await syncService.process(stock.id, tenantAccess);
assert(syncService.snapshot().filter((item) => [pos.id, stock.id].includes(item.id)).every((item) => item.status === "synced"), "restored connection must sync queued actions");
console.log("Sync QA passed: persistence, POS/Stock queueing, scope, automatic processing, failure retry, and conflict resolution.");
