import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/auth-context";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { useSync } from "@/features/sync";
import type { ApprovalStatus } from "@/shared/types/approval";
import type {
  BranchStockRequestFormValues,
  StockAdjustmentFormValues,
  StockCountFormValues,
  StockReturnWastageFormValues,
  StockTransferFormValues,
} from "../schemas/inventorySchemas";
import { inventoryKeys } from "../queries/inventoryKeys";
import {
  stockWorkflowService,
  type StockWorkflowKind,
  type WorkflowListParams,
  type WorkflowListResult,
} from "../services/stockWorkflowService";
import type {
  BranchStockRequest,
  StockAdjustment,
  StockCount,
  StockReturnWastage,
  StockTransfer,
} from "../types/stockWorkflows";

function useWorkflowContext() {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { user } = useAuth();
  const permittedBranchIds = branches.map((branch) => branch.id);
  return {
    scope: { tenantId: tenantId ?? "", branchId: branchId ?? "" },
    permittedBranchIds,
    actor: { id: user?.id ?? "unknown", name: user?.name ?? "Unknown user" },
    enabled: Boolean(tenantId && branchId && user),
  };
}

function useWorkflowQuery<T>(
  kind: StockWorkflowKind,
  params: Omit<WorkflowListParams, "permittedBranchIds">,
  load: (scope: { tenantId: string; branchId: string }, params: WorkflowListParams) => Promise<WorkflowListResult<T>>,
) {
  const context = useWorkflowContext();
  const scopedParams: WorkflowListParams = { ...params, permittedBranchIds: context.permittedBranchIds };
  return useQuery<WorkflowListResult<T>>({
    queryKey: inventoryKeys.workflowList(kind, context.scope, scopedParams),
    queryFn: () => load(context.scope, scopedParams),
    enabled: context.enabled,
    placeholderData: keepPreviousData,
  });
}

export const useStockAdjustments = (params: Omit<WorkflowListParams, "permittedBranchIds">) => useWorkflowQuery<StockAdjustment>("adjustment", params, stockWorkflowService.listAdjustments);
export const useStockTransfers = (params: Omit<WorkflowListParams, "permittedBranchIds">) => useWorkflowQuery<StockTransfer>("transfer", params, stockWorkflowService.listTransfers);
export const useBranchStockRequests = (params: Omit<WorkflowListParams, "permittedBranchIds">) => useWorkflowQuery<BranchStockRequest>("request", params, stockWorkflowService.listRequests);
export const useStockCounts = (params: Omit<WorkflowListParams, "permittedBranchIds">) => useWorkflowQuery<StockCount>("count", params, stockWorkflowService.listCounts);
export const useStockReturnsWastage = (params: Omit<WorkflowListParams, "permittedBranchIds">) => useWorkflowQuery<StockReturnWastage>("return_wastage", params, stockWorkflowService.listReturnsWastage);

export function useStockWorkflowMutations() {
  const context = useWorkflowContext();
  const { hasPermission } = usePermissions();
  const sync = useSync();
  const client = useQueryClient();
  const invalidate = async () => client.invalidateQueries({ queryKey: inventoryKeys.all });
  const mutation = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => task(),
    onSuccess: invalidate,
  });
  const run = <T,>(task: () => Promise<T>) => mutation.mutateAsync(task) as Promise<T>;
  const createOfflineCapable = async <T extends { id: string; referenceNumber: string }>(
    permission: string,
    branchId: string,
    entityType: string,
    actionType: string,
    payload: Record<string, unknown>,
    task: () => Promise<T>,
  ) => {
    if (!hasPermission(permission))
      throw new Error("You do not have permission to create this Stock workflow.");
    const record = await task();
    if (!sync.isOnline) {
      sync.enqueue({
        branchId,
        module: "stock",
        entityType,
        entityId: record.id,
        referenceNumber: record.referenceNumber,
        actionType,
        requiredPermission: permission,
        payload,
      });
    }
    return record;
  };
  const decision = (status: Extract<ApprovalStatus, "approved" | "rejected">, remarks?: string) => ({ status, remarks });
  return {
    isPending: mutation.isPending,
    createAdjustment: (values: StockAdjustmentFormValues) => run(() => createOfflineCapable("stock.adjust", values.branchId, "stock_adjustment", "stock.adjustment.create", { values }, () => stockWorkflowService.createAdjustment(context.scope, context.permittedBranchIds, values, context.actor))),
    decideAdjustment: (id: string, status: Extract<ApprovalStatus, "approved" | "rejected">, remarks?: string) => run(() => stockWorkflowService.decideAdjustment(context.scope, context.permittedBranchIds, id, decision(status, remarks).status, context.actor, remarks)),
    createTransfer: (values: StockTransferFormValues) => run(() => createOfflineCapable("stock.transfer", values.sourceBranchId, "stock_transfer", "stock.transfer.create", { values }, () => stockWorkflowService.createTransfer(context.scope, context.permittedBranchIds, values, context.actor))),
    advanceTransfer: (id: string, action: "approve" | "dispatch" | "mark_in_transit" | "receive" | "complete", remarks?: string) => run(() => stockWorkflowService.advanceTransfer(context.scope, context.permittedBranchIds, id, action, context.actor, remarks)),
    createRequest: (values: BranchStockRequestFormValues) => run(() => createOfflineCapable("stock.request", values.requestingBranchId, "branch_stock_request", "stock.request.create", { values }, () => stockWorkflowService.createRequest(context.scope, context.permittedBranchIds, values, context.actor))),
    decideRequest: (id: string, status: Extract<ApprovalStatus, "approved" | "rejected">, remarks?: string) => run(() => stockWorkflowService.decideRequest(context.scope, context.permittedBranchIds, id, status, context.actor, remarks)),
    convertRequest: (id: string) => run(() => stockWorkflowService.convertRequest(context.scope, context.permittedBranchIds, id, context.actor)),
    createCount: (values: StockCountFormValues) => run(() => createOfflineCapable("stock.count", values.branchId, "stock_count", "stock.count.create", { values }, () => stockWorkflowService.createCount(context.scope, context.permittedBranchIds, values, context.actor))),
    saveCountDraft: (values: StockCountFormValues, id?: string) => run(() => createOfflineCapable("stock.count", values.branchId, "stock_count", id ? "stock.count.draft.update" : "stock.count.draft.create", { values, id }, () => stockWorkflowService.saveCountDraft(context.scope, context.permittedBranchIds, values, context.actor, id))),
    completeCount: (id: string) => run(() => stockWorkflowService.completeCount(context.scope, context.permittedBranchIds, id, context.actor)),
    decideCount: (id: string, status: Extract<ApprovalStatus, "approved" | "rejected">, remarks?: string) => run(() => stockWorkflowService.decideCount(context.scope, context.permittedBranchIds, id, status, context.actor, remarks)),
    createReturnWastage: (values: StockReturnWastageFormValues) => run(() => createOfflineCapable("stock.adjust", values.branchId, "stock_return_wastage", "stock.return_wastage.create", { values }, () => stockWorkflowService.createReturnWastage(context.scope, context.permittedBranchIds, values, context.actor))),
    decideReturnWastage: (id: string, status: Extract<ApprovalStatus, "approved" | "rejected">, remarks?: string) => run(() => stockWorkflowService.decideReturnWastage(context.scope, context.permittedBranchIds, id, status, context.actor, remarks)),
    prepareReorder: (balanceId: string) => run(() => stockWorkflowService.prepareReorderHandoff(context.scope, context.permittedBranchIds, balanceId)),
  };
}

export function useReorderWorkflow() {
  const context = useWorkflowContext();
  return useQuery({
    queryKey: inventoryKeys.reorder(context.scope, context.permittedBranchIds),
    queryFn: () => stockWorkflowService.listReorderItems(context.scope, context.permittedBranchIds),
    enabled: context.enabled,
  });
}
