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
  CustomerPaymentFormValues,
  DeliveryFormValues,
  RecurringInvoiceFormValues,
  SalesInvoiceFormValues,
  SalesOrderFormValues,
  SalesQuotationFormValues,
  SalesReturnFormValues,
} from "../schemas/salesSchemas";
import { salesKeys } from "../queries/salesKeys";
import { salesService, type SalesListParams } from "../services/salesService";

function useSalesContext() {
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
  params: Omit<SalesListParams, "permittedBranchIds">,
  load: (
    scope: { tenantId: string; branchId: string },
    params: SalesListParams,
  ) => Promise<{ data: T[]; total: number; page: number; pageSize: number }>,
) {
  const context = useSalesContext();
  const scoped = { ...params, permittedBranchIds: context.permitted };
  return useQuery({
    queryKey: salesKeys.list(kind, context.scope, scoped),
    queryFn: () => load(context.scope, scoped),
    enabled: context.enabled,
    placeholderData: keepPreviousData,
  });
}
export const useSalesQuotations = (
  params: Omit<SalesListParams, "permittedBranchIds">,
) => useList("quotations", params, salesService.listQuotations);
export const useSalesOrders = (
  params: Omit<SalesListParams, "permittedBranchIds">,
) => useList("orders", params, salesService.listOrders);
export const useDeliveryNotes = (
  params: Omit<SalesListParams, "permittedBranchIds">,
) => useList("deliveries", params, salesService.listDeliveries);
export const useSalesInvoices = (
  params: Omit<SalesListParams, "permittedBranchIds">,
) => useList("invoices", params, salesService.listInvoices);
export const useCustomerPayments = (
  params: Omit<SalesListParams, "permittedBranchIds">,
) => useList("payments", params, salesService.listPayments);
export const useSalesReturns = (
  params: Omit<SalesListParams, "permittedBranchIds">,
) => useList("returns", params, salesService.listReturns);
export const useCreditNotes = (
  params: Omit<SalesListParams, "permittedBranchIds">,
) => useList("creditNotes", params, salesService.listCreditNotes);
export const useRecurringInvoices = (
  params: Omit<SalesListParams, "permittedBranchIds">,
) => useList("recurring", params, salesService.listRecurring);
export function useSalesDashboard() {
  const context = useSalesContext();
  return useQuery({
    queryKey: salesKeys.dashboard(context.scope, context.permitted),
    queryFn: () => salesService.getDashboard(context.scope, context.permitted),
    enabled: context.enabled,
  });
}
export function useSalesCommissions() {
  const context = useSalesContext();
  return useQuery({
    queryKey: salesKeys.commissions(context.scope, context.permitted),
    queryFn: () =>
      salesService.getCommissions(context.scope, context.permitted),
    enabled: context.enabled,
  });
}
export function useSalesCustomerOptions() {
  const context = useSalesContext();
  return useQuery({
    queryKey: salesKeys.options(
      "customers",
      context.tenantId,
      context.permitted,
    ),
    queryFn: () =>
      salesService.customerOptions(context.tenantId, context.permitted),
    enabled: Boolean(context.tenantId),
    staleTime: 300000,
  });
}
export function useSalespersonOptions() {
  const context = useSalesContext();
  return useQuery({
    queryKey: salesKeys.options(
      "salespeople",
      context.tenantId,
      context.permitted,
    ),
    queryFn: () => salesService.salespersonOptions(context.tenantId),
    enabled: Boolean(context.tenantId),
    staleTime: 300000,
  });
}
export function useSalesProductOptions() {
  const context = useSalesContext();
  return useQuery({
    queryKey: salesKeys.options(
      "products",
      context.tenantId,
      context.permitted,
    ),
    queryFn: () => salesService.productOptions(context.tenantId),
    enabled: Boolean(context.tenantId),
    staleTime: 300000,
  });
}
export function useSalesOpportunityOptions() {
  const context = useSalesContext();
  return useQuery({
    queryKey: salesKeys.options(
      "opportunities",
      context.tenantId,
      context.permitted,
    ),
    queryFn: () =>
      salesService.opportunityOptions(context.scope, context.permitted),
    enabled: context.enabled,
    staleTime: 120000,
  });
}

export function useSalesMutations() {
  const context = useSalesContext();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: () => client.invalidateQueries({ queryKey: salesKeys.all }),
  });
  const run = <T>(task: () => Promise<T>) =>
    mutation.mutateAsync(task) as Promise<T>;
  return {
    isPending: mutation.isPending,
    createQuotation: (values: SalesQuotationFormValues) =>
      run(() =>
        salesService.createQuotation(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    updateQuotation: (id: string, values: SalesQuotationFormValues) =>
      run(() =>
        salesService.updateQuotation(
          context.scope,
          context.permitted,
          id,
          values,
          context.actor,
        ),
      ),
    transitionQuotation: (
      id: string,
      action:
        | "submit"
        | "approve"
        | "reject"
        | "send"
        | "accept"
        | "expire"
        | "cancel",
      remarks?: string,
    ) =>
      run(() =>
        salesService.transitionQuotation(
          context.scope,
          context.permitted,
          id,
          action,
          context.actor,
          remarks,
        ),
      ),
    createOrder: (values: SalesOrderFormValues) =>
      run(() =>
        salesService.createOrder(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    createOrderFromQuotation: (id: string, warehouseId: string) =>
      run(() =>
        salesService.createOrderFromQuotation(
          context.scope,
          context.permitted,
          id,
          warehouseId,
          context.actor,
        ),
      ),
    updateOrder: (id: string, values: SalesOrderFormValues) =>
      run(() =>
        salesService.updateOrder(
          context.scope,
          context.permitted,
          id,
          values,
          context.actor,
        ),
      ),
    transitionOrder: (id: string, action: "confirm" | "process" | "cancel") =>
      run(() =>
        salesService.transitionOrder(
          context.scope,
          context.permitted,
          id,
          action,
          context.actor,
        ),
      ),
    completeDelivery: (values: DeliveryFormValues) =>
      run(() =>
        salesService.completeDelivery(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    createInvoice: (values: SalesInvoiceFormValues) =>
      run(() =>
        salesService.createInvoice(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    transitionInvoice: (
      id: string,
      action: "approve" | "send" | "void",
      remarks?: string,
    ) =>
      run(() =>
        salesService.transitionInvoice(
          context.scope,
          context.permitted,
          id,
          action,
          context.actor,
          remarks,
        ),
      ),
    receivePayment: (values: CustomerPaymentFormValues) =>
      run(() =>
        salesService.receivePayment(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    completeReturn: (values: SalesReturnFormValues) =>
      run(() =>
        salesService.completeReturn(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    createRecurring: (values: RecurringInvoiceFormValues) =>
      run(() =>
        salesService.createRecurring(
          context.scope,
          context.permitted,
          values,
          context.actor,
        ),
      ),
    toggleRecurring: (id: string) =>
      run(() =>
        salesService.toggleRecurring(
          context.scope,
          context.permitted,
          id,
          context.actor,
        ),
      ),
    documentAction: (
      kind: "print" | "share" | "email",
      document: Parameters<typeof salesService.documentAction>[1],
    ) => run(() => salesService.documentAction(kind, document)),
    addAttachment: (
      kind: Parameters<typeof salesService.addAttachment>[0],
      id: string,
      file: File,
    ) =>
      run(() =>
        salesService.addAttachment(
          kind,
          context.scope,
          context.permitted,
          id,
          file,
          context.actor.name,
          context.permissions,
        ),
      ),
    export: (
      kind: Parameters<typeof salesService.export>[0],
      params: Omit<SalesListParams, "permittedBranchIds">,
    ) =>
      run(() =>
        salesService.export(kind, context.scope, {
          ...params,
          permittedBranchIds: context.permitted,
        }),
      ),
  };
}
