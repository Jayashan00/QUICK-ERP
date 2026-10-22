import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/core/auth/auth-context";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { usePermissions } from "@/core/permissions/permission-context";
import type {
  GrnFormValues,
  PurchaseInvoiceFormValues,
  PurchaseOrderFormValues,
  PurchaseRequestFormValues,
  PurchaseReturnFormValues,
  RfqFormValues,
  SupplierQuotationFormValues,
} from "../schemas/purchasingSchemas";
import { purchasingKeys } from "../queries/purchasingKeys";
import {
  purchasingService,
  type PurchasingListParams,
} from "../services/purchasingService";

function useContext() {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { user } = useAuth();
  const { permissions } = usePermissions();
  return {
    scope: { tenantId: tenantId ?? "", branchId: branchId ?? "" },
    tenantId: tenantId ?? "",
    permitted: branches.map((branch) => branch.id),
    actor: { id: user?.id ?? "unknown", name: user?.name ?? "Unknown user" },
    permissions,
    enabled: Boolean(tenantId && branchId && user),
  };
}
function useList<T>(
  kind: string,
  params: Omit<PurchasingListParams, "permittedBranchIds">,
  load: (
    scope: { tenantId: string; branchId: string },
    params: PurchasingListParams,
  ) => Promise<{ data: T[]; total: number; page: number; pageSize: number }>,
) {
  const context = useContext();
  const scoped = { ...params, permittedBranchIds: context.permitted };
  return useQuery({
    queryKey: purchasingKeys.list(kind, context.scope, scoped),
    queryFn: () => load(context.scope, scoped),
    enabled: context.enabled,
    placeholderData: keepPreviousData,
  });
}
export const usePurchaseRequests = (
  params: Omit<PurchasingListParams, "permittedBranchIds">,
) => useList("requests", params, purchasingService.listRequests);
export const useRfqs = (
  params: Omit<PurchasingListParams, "permittedBranchIds">,
) => useList("rfqs", params, purchasingService.listRfqs);
export const useSupplierQuotations = (
  params: Omit<PurchasingListParams, "permittedBranchIds">,
) => useList("quotations", params, purchasingService.listQuotations);
export const usePurchaseOrders = (
  params: Omit<PurchasingListParams, "permittedBranchIds">,
) => useList("orders", params, purchasingService.listOrders);
export const useGoodsReceipts = (
  params: Omit<PurchasingListParams, "permittedBranchIds">,
) => useList("grns", params, purchasingService.listGrns);
export const usePurchaseInvoices = (
  params: Omit<PurchasingListParams, "permittedBranchIds">,
) => useList("invoices", params, purchasingService.listInvoices);
export const usePurchaseReturns = (
  params: Omit<PurchasingListParams, "permittedBranchIds">,
) => useList("returns", params, purchasingService.listReturns);
export function usePurchasingDashboard() {
  const context = useContext();
  return useQuery({
    queryKey: purchasingKeys.dashboard(context.scope, context.permitted),
    queryFn: () =>
      purchasingService.getDashboard(context.scope, context.permitted),
    enabled: context.enabled,
  });
}
export function usePurchasingMatches() {
  const context = useContext();
  return useQuery({
    queryKey: purchasingKeys.matches(context.scope, context.permitted),
    queryFn: () =>
      purchasingService.getMatches(context.scope, context.permitted),
    enabled: context.enabled,
  });
}
export function usePurchasingSupplierOptions() {
  const context = useContext();
  return useQuery({
    queryKey: purchasingKeys.options("suppliers", context.tenantId),
    queryFn: () => purchasingService.supplierOptions(context.tenantId),
    enabled: Boolean(context.tenantId),
    staleTime: 300000,
  });
}
export function usePurchasingProductOptions() {
  const context = useContext();
  return useQuery({
    queryKey: purchasingKeys.options("products", context.tenantId),
    queryFn: () => purchasingService.productOptions(context.tenantId),
    enabled: Boolean(context.tenantId),
    staleTime: 300000,
  });
}
export function usePurchasingMutations() {
  const context = useContext();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: () => client.invalidateQueries({ queryKey: purchasingKeys.all }),
  });
  const run = <T>(task: () => Promise<T>) =>
    mutation.mutateAsync(task) as Promise<T>;
  return {
    isPending: mutation.isPending,
    createRequest: (values: PurchaseRequestFormValues) =>
      run(() =>
        purchasingService.createRequest(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    updateRequest: (id: string, values: PurchaseRequestFormValues) =>
      run(() =>
        purchasingService.updateRequest(
          context.scope,
          context.permitted,
          id,
          values,
          context.actor,
        ),
      ),
    transitionRequest: (
      id: string,
      action: "submit" | "approve" | "reject" | "cancel",
      remarks?: string,
    ) =>
      run(() =>
        purchasingService.transitionRequest(
          context.scope,
          context.permitted,
          id,
          action,
          context.actor,
          remarks,
        ),
      ),
    createRfq: (values: RfqFormValues) =>
      run(() =>
        purchasingService.createRfq(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    createQuotation: (values: SupplierQuotationFormValues) =>
      run(() =>
        purchasingService.createQuotation(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    selectQuotation: (id: string) =>
      run(() =>
        purchasingService.selectQuotation(
          context.scope,
          context.permitted,
          id,
          context.actor,
        ),
      ),
    createOrder: (values: PurchaseOrderFormValues) =>
      run(() =>
        purchasingService.createOrder(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    updateOrder: (id: string, values: PurchaseOrderFormValues) =>
      run(() =>
        purchasingService.updateOrder(
          context.scope,
          context.permitted,
          id,
          values,
          context.actor,
        ),
      ),
    createOrderFromQuotation: (id: string, warehouseId: string) =>
      run(() =>
        purchasingService.createOrderFromQuotation(
          context.scope,
          context.permitted,
          id,
          warehouseId,
          context.actor,
        ),
      ),
    transitionOrder: (
      id: string,
      action: "submit" | "approve" | "send" | "cancel",
      remarks?: string,
    ) =>
      run(() =>
        purchasingService.transitionOrder(
          context.scope,
          context.permitted,
          id,
          action,
          context.actor,
          remarks,
        ),
      ),
    completeGrn: (values: GrnFormValues) =>
      run(() =>
        purchasingService.completeGrn(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    createInvoice: (values: PurchaseInvoiceFormValues) =>
      run(() =>
        purchasingService.createInvoice(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    completeReturn: (values: PurchaseReturnFormValues) =>
      run(() =>
        purchasingService.completeReturn(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    export: (
      kind: Parameters<typeof purchasingService.export>[0],
      params: Omit<PurchasingListParams, "permittedBranchIds">,
    ) =>
      run(() =>
        purchasingService.export(kind, context.scope, {
          ...params,
          permittedBranchIds: context.permitted,
        }),
      ),
    addAttachment: (
      kind: Parameters<typeof purchasingService.addAttachment>[0],
      id: string,
      file: File,
    ) =>
      run(() =>
        purchasingService.addAttachment(
          kind,
          context.scope,
          context.permitted,
          id,
          file,
          context.actor.name,
          context.permissions,
        ),
      ),
    preparePayment: (invoiceId: string) =>
      run(() =>
        purchasingService.preparePaymentHandoff(
          context.scope,
          context.permitted,
          invoiceId,
        ),
      ),
  };
}
