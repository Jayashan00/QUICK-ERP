import { createContext, useContext } from "react";
import type {
  ConflictResolution,
  EnqueueSyncInput,
  NetworkSyncState,
  SyncItemStatus,
  SyncQueueItem,
} from "./types/sync";

export interface SyncContextValue {
  networkState: NetworkSyncState;
  isOnline: boolean;
  isProcessing: boolean;
  items: SyncQueueItem[];
  pendingCount: number;
  enqueue: (input: Omit<EnqueueSyncInput, "tenantId" | "userId" | "userName">) => SyncQueueItem;
  retry: (id: string) => Promise<void>;
  retryAll: () => Promise<void>;
  resolveConflict: (id: string, resolution: ConflictResolution) => Promise<void>;
  clearStatuses: (statuses: SyncItemStatus[]) => void;
  getRecordStatus: (module: "pos" | "stock", entityId: string) => SyncItemStatus | undefined;
  setSimulatedOffline: (offline: boolean) => void;
}

export const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used within SyncProvider");
  return context;
}
