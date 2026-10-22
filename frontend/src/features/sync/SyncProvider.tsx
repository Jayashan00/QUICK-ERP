import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "@/core/auth/auth-context";
import { useBranch } from "@/core/branch/branch-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { appToast } from "@/shared/utils/toast";
import { SyncContext } from "./sync-context";
import { syncService } from "./services/syncService";
import type {
  ConflictResolution,
  EnqueueSyncInput,
  SyncItemStatus,
} from "./types/sync";

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const { hasPermission } = usePermissions();
  const queue = useSyncExternalStore(
    syncService.subscribe,
    syncService.snapshot,
    syncService.snapshot,
  );
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [isProcessing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const permittedBranchIds = useMemo(
    () => branches.map((branch) => branch.id),
    [branches],
  );
  const isOnline = browserOnline && !simulatedOffline;
  const items = useMemo(
    () =>
      queue.filter(
        (item) =>
          item.tenantId === (tenantId ?? "") &&
          permittedBranchIds.includes(item.branchId),
      ),
    [queue, tenantId, permittedBranchIds],
  );

  useEffect(() => {
    const online = () => setBrowserOnline(true);
    const offline = () => setBrowserOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  const processAll = useCallback(async (includeFailed: boolean) => {
    if (!isOnline || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const statuses: SyncItemStatus[] = includeFailed
        ? ["pending_sync", "failed"]
        : ["pending_sync"];
      const candidates = items.filter(
        (item) => statuses.includes(item.status) && hasPermission(item.requiredPermission),
      );
      const access = { tenantId: tenantId ?? "", permittedBranchIds };
      for (const item of candidates) await syncService.process(item.id, access);
      const count = candidates.length;
      if (count > 0) appToast.success(`${count} queued action(s) processed.`);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [hasPermission, isOnline, items, permittedBranchIds, tenantId]);

  useEffect(() => {
    if (isOnline && items.some((item) => item.status === "pending_sync"))
      void processAll(false);
  }, [isOnline, items, processAll]);

  const enqueue = useCallback(
    (input: Omit<EnqueueSyncInput, "tenantId" | "userId" | "userName">) => {
      if (!user || !tenantId) throw new Error("An authenticated tenant user is required.");
      if (!permittedBranchIds.includes(input.branchId))
        throw new Error("The selected branch is outside your permitted scope.");
      if (!hasPermission(input.requiredPermission))
        throw new Error("You do not have permission to queue this action.");
      return syncService.enqueue({
        ...input,
        tenantId,
        userId: user.id,
        userName: user.name,
      });
    },
    [hasPermission, permittedBranchIds, tenantId, user],
  );

  const retry = useCallback(async (id: string) => {
    if (!isOnline) throw new Error("Reconnect before retrying this action.");
    const item = items.find((candidate) => candidate.id === id);
    if (!item) throw new Error("This queue item is outside your tenant or branch scope.");
    if (!hasPermission(item.requiredPermission))
      throw new Error("You no longer have permission to retry this action.");
    await syncService.process(id, { tenantId: tenantId ?? "", permittedBranchIds });
  }, [hasPermission, isOnline, items, permittedBranchIds, tenantId]);

  const resolveConflict = useCallback(
    async (id: string, resolution: ConflictResolution) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) throw new Error("This conflict is outside your tenant or branch scope.");
      if (!hasPermission(item.requiredPermission))
        throw new Error("You no longer have permission to resolve this conflict.");
      const access = { tenantId: tenantId ?? "", permittedBranchIds };
      syncService.resolveConflict(id, resolution, access);
      if (resolution === "keep_local" && isOnline) await syncService.process(id, access);
    },
    [hasPermission, isOnline, items, permittedBranchIds, tenantId],
  );

  const getRecordStatus = useCallback(
    (module: "pos" | "stock", entityId: string) =>
      items.find((item) => item.module === module && item.entityId === entityId)?.status,
    [items],
  );

  const pendingCount = items.filter((item) =>
    ["pending_sync", "syncing", "failed", "conflict"].includes(item.status),
  ).length;
  const networkState = !isOnline ? "offline" : isProcessing ? "syncing" : "online";

  return (
    <SyncContext.Provider
      value={{
        networkState,
        isOnline,
        isProcessing,
        items,
        pendingCount,
        enqueue,
        retry: async (id) => {
          await retry(id);
          appToast.success("Queue item retried.");
        },
        retryAll: async () => processAll(true),
        resolveConflict,
        clearStatuses: (statuses: SyncItemStatus[]) =>
          syncService.removeMany(
            items.filter((item) => statuses.includes(item.status)).map((item) => item.id),
            { tenantId: tenantId ?? "", permittedBranchIds },
          ),
        getRecordStatus,
        setSimulatedOffline,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
