export type NetworkSyncState = "online" | "offline" | "syncing";
export type SyncItemStatus =
  | "pending_sync"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";
export type SyncModule = "pos" | "stock";
export type MockSyncOutcome = "success" | "failed" | "conflict";

export interface SyncConflict {
  reason: string;
  localValue: Record<string, unknown>;
  serverValue: Record<string, unknown>;
}

export interface SyncQueueItem {
  id: string;
  tenantId: string;
  branchId: string;
  userId: string;
  userName: string;
  module: SyncModule;
  entityType: string;
  entityId: string;
  referenceNumber: string;
  actionType: string;
  requiredPermission: string;
  payload: Record<string, unknown>;
  status: SyncItemStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  attempts: number;
  errorMessage?: string;
  conflict?: SyncConflict;
  mockOutcome?: MockSyncOutcome;
}

export interface EnqueueSyncInput {
  tenantId: string;
  branchId: string;
  userId: string;
  userName: string;
  module: SyncModule;
  entityType: string;
  entityId: string;
  referenceNumber: string;
  actionType: string;
  requiredPermission: string;
  payload: Record<string, unknown>;
  mockOutcome?: MockSyncOutcome;
}

export interface SyncQueueFilters {
  status?: SyncItemStatus | "all";
  module?: SyncModule | "all";
  branchId?: string | "all";
}

export interface SyncAccessScope {
  tenantId: string;
  permittedBranchIds: string[];
}

export type ConflictResolution = "keep_local" | "use_server";
