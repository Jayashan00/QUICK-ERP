import type {
  ConflictResolution,
  EnqueueSyncInput,
  SyncAccessScope,
  SyncItemStatus,
  SyncQueueFilters,
  SyncQueueItem,
} from "../types/sync";

const STORAGE_KEY = "quick-erp:sync-queue:v1";
const listeners = new Set<() => void>();

function readQueue(): SyncQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? (value as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

let queue = readQueue();

function publish(next: SyncQueueItem[]) {
  queue = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // The in-memory queue remains usable if browser persistence is unavailable.
    }
  }
  listeners.forEach((listener) => listener());
}

function update(id: string, changes: Partial<SyncQueueItem>) {
  publish(
    queue.map((item) =>
      item.id === id
        ? { ...item, ...changes, updatedAt: new Date().toISOString() }
        : item,
    ),
  );
}

function requireScopedItem(id: string, access: SyncAccessScope) {
  const item = queue.find(
    (candidate) =>
      candidate.id === id &&
      candidate.tenantId === access.tenantId &&
      access.permittedBranchIds.includes(candidate.branchId),
  );
  if (!item) throw new Error("This queue item is outside the permitted tenant or branch scope.");
  return item;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

export const syncService = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot() {
    return queue;
  },
  restoreFromPersistence() {
    publish(readQueue());
    return queue;
  },
  list(
    tenantId: string,
    permittedBranchIds: string[],
    filters: SyncQueueFilters = {},
  ) {
    return queue.filter(
      (item) =>
        item.tenantId === tenantId &&
        permittedBranchIds.includes(item.branchId) &&
        (!filters.status || filters.status === "all" || item.status === filters.status) &&
        (!filters.module || filters.module === "all" || item.module === filters.module) &&
        (!filters.branchId || filters.branchId === "all" || item.branchId === filters.branchId),
    );
  },
  enqueue(input: EnqueueSyncInput) {
    const now = new Date().toISOString();
    const existing = queue.find(
      (item) =>
        item.tenantId === input.tenantId &&
        item.module === input.module &&
        item.entityId === input.entityId &&
        item.actionType === input.actionType,
    );
    if (existing) return existing;
    const item: SyncQueueItem = {
      ...input,
      id: crypto.randomUUID(),
      status: "pending_sync",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    publish([item, ...queue]);
    return item;
  },
  async process(id: string, access: SyncAccessScope) {
    const item = requireScopedItem(id, access);
    if (!["pending_sync", "failed"].includes(item.status)) return item;
    update(id, {
      status: "syncing",
      attempts: item.attempts + 1,
      errorMessage: undefined,
      conflict: undefined,
    });
    await wait(350);
    if (item.mockOutcome === "failed" && item.attempts === 0) {
      update(id, {
        status: "failed",
        errorMessage: "Mock server rejected this action. Review it and retry.",
      });
    } else if (item.mockOutcome === "conflict") {
      update(id, {
        status: "conflict",
        errorMessage: "The mock server contains a newer version of this record.",
        conflict: {
          reason: "A newer mock server version was detected.",
          localValue: item.payload,
          serverValue: { referenceNumber: item.referenceNumber, version: "server-newer" },
        },
      });
    } else {
      update(id, {
        status: "synced",
        syncedAt: new Date().toISOString(),
        errorMessage: undefined,
      });
    }
    return queue.find((candidate) => candidate.id === id);
  },
  async processAll(access: SyncAccessScope, statuses: SyncItemStatus[] = ["pending_sync", "failed"]) {
    const ids = queue
      .filter((item) => item.tenantId === access.tenantId && access.permittedBranchIds.includes(item.branchId) && statuses.includes(item.status))
      .map((item) => item.id);
    for (const id of ids) await this.process(id, access);
    return ids.length;
  },
  resolveConflict(id: string, resolution: ConflictResolution, access: SyncAccessScope) {
    const item = requireScopedItem(id, access);
    if (item.status !== "conflict")
      throw new Error("This queue item no longer has a conflict.");
    update(id, {
      status: resolution === "keep_local" ? "pending_sync" : "synced",
      syncedAt: resolution === "use_server" ? new Date().toISOString() : undefined,
      mockOutcome: "success",
      conflict: undefined,
      errorMessage: undefined,
    });
  },
  remove(id: string, access: SyncAccessScope) {
    requireScopedItem(id, access);
    publish(queue.filter((item) => item.id !== id));
  },
  removeMany(ids: string[], access: SyncAccessScope) {
    ids.forEach((id) => requireScopedItem(id, access));
    const selected = new Set(ids);
    publish(queue.filter((item) => !selected.has(item.id)));
  },
  clearStatuses(statuses: SyncItemStatus[], access: SyncAccessScope) {
    publish(queue.filter((item) => item.tenantId !== access.tenantId || !access.permittedBranchIds.includes(item.branchId) || !statuses.includes(item.status)));
  },
};
