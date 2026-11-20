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
import { accountingService } from "@/features/accounting/accountingService";
import { useTenantCurrency } from "@/features/settings/finance/currency";
import type {
  DeliveryFormValues,
  RecurringInvoiceFormValues,
  SalesInvoiceFormValues,
  SalesOrderFormValues,
  SalesQuotationFormValues,
  SalesReturnFormValues,
} from "../schemas/salesSchemas";
import { salesKeys } from "../queries/salesKeys";
import { salesService, type InvoiceWorkflowAction, type PdfCurrencyOptions, type SalesListParams } from "../services/salesService";

function useSalesContext() {
  const { tenantId, currentTenant } = useTenant();
  const tenantCurrency = useTenantCurrency();
  const { branchId, branches } = useBranch();
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const baseCurrency = tenantCurrency.currencyCode || currentTenant?.currency || "USD";
  const sourceCurrency = currentTenant?.currency || baseCurrency;

  let multiplier: number | null = null;
  if (sourceCurrency.toUpperCase() === baseCurrency.toUpperCase()) {
    multiplier = 1;
  } else {
    multiplier = tenantCurrency.convertToBaseAmount(1, sourceCurrency);
    if (multiplier === null || !Number.isFinite(multiplier) || multiplier <= 0) {
      multiplier = 1;
    }
  }

  const pdfCurrency: PdfCurrencyOptions = {
    currency: baseCurrency,
    multiplier: multiplier && multiplier > 0 ? multiplier : 1,
  };

  return {
    scope: { tenantId: tenantId ?? "", branchId: branchId ?? "" },
    tenantId: tenantId ?? "",
    permitted: branches.map((branch) => branch.id),
    actor: {
      id: user?.id ?? "unknown",
      name: user?.name ?? "Unknown user",
      roleId: user?.roleId,
      roleName: user?.roleName,
    },
    permissions,
    pdfCurrency,
    enabled: Boolean(tenantId && branchId && user),
  };
}
function requirePdfCurrency(value: PdfCurrencyOptions | null): PdfCurrencyOptions {
  if (value && /^[A-Z]{3}$/.test(value.currency) && Number.isFinite(value.multiplier) && value.multiplier > 0) {
    return value;
  }
  return { currency: "USD", multiplier: 1 };
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
export function useSalesInvoicePdf(invoiceId?: string) {
  const context = useSalesContext();
  return useQuery({
    queryKey: ["sales", "invoice-pdf", context.scope, invoiceId, context.pdfCurrency],
    queryFn: () => salesService.invoicePdf(context.scope, context.permitted, invoiceId ?? "", requirePdfCurrency(context.pdfCurrency)),
    enabled: context.enabled && Boolean(invoiceId) && Boolean(context.pdfCurrency),
    staleTime: 60_000,
  });
}
export function useCreditNotePdf(creditNoteId?: string) {
  const context = useSalesContext();
  return useQuery({
    queryKey: ["sales", "credit-note-pdf", context.scope, creditNoteId, context.pdfCurrency],
    queryFn: () => salesService.creditNotePdf(context.scope, context.permitted, creditNoteId ?? "", requirePdfCurrency(context.pdfCurrency)),
    enabled: context.enabled && Boolean(creditNoteId) && Boolean(context.pdfCurrency),
    staleTime: 60_000,
  });
}
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
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: salesKeys.all }),
        client.invalidateQueries({ queryKey: ["accounting"] }),
      ]);
    },
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
    emailQuotation: (id: string) =>
      run(() =>
        salesService.emailQuotation(context.scope, context.permitted, id, requirePdfCurrency(context.pdfCurrency)),
      ),
    quotationPdf: (id: string) =>
      salesService.quotationPdf(context.scope, context.permitted, id, requirePdfCurrency(context.pdfCurrency)),
    orderPdf: (id: string) =>
      salesService.orderPdf(context.scope, context.permitted, id, requirePdfCurrency(context.pdfCurrency)),
    deliveryPdf: (id: string) =>
      salesService.deliveryPdf(context.scope, context.permitted, id),
    invoicePdf: (id: string) =>
      salesService.invoicePdf(context.scope, context.permitted, id, requirePdfCurrency(context.pdfCurrency)),
    emailInvoice: (id: string) =>
      run(() => salesService.emailInvoice(context.scope, context.permitted, id, context.actor, requirePdfCurrency(context.pdfCurrency))),
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
    transitionOrder: (
      id: string,
      action: "confirm" | "process" | "return_to_sales" | "resubmit" | "cancel",
      remarks?: string,
    ) =>
      run(() =>
        salesService.transitionOrder(
          context.scope,
          context.permitted,
          id,
          action,
          context.actor,
          context.permissions,
          remarks,
        ),
      ),
    completeDelivery: (values: DeliveryFormValues) =>
      run(() =>
        salesService.completeDelivery(
          context.scope,
          context.permitted,
          values,
          context.actor,
          context.permissions,
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
    updateInvoice: (id: string, values: SalesInvoiceFormValues) =>
      run(() =>
        salesService.updateInvoice(
          context.scope,
          context.permitted,
          id,
          values,
          context.actor,
          context.permissions,
        ),
      ),
    createInvoiceFromOrder: (orderId: string) =>
      run(() =>
        salesService.createInvoiceFromOrder(
          context.scope,
          context.permitted,
          orderId,
          context.actor,
        ),
      ),
    transitionInvoice: (
      id: string,
      action: InvoiceWorkflowAction,
      remarks?: string,
    ) =>
      run(() =>
        salesService.transitionInvoice(
          context.scope,
          context.permitted,
          id,
          action,
          context.actor,
          context.permissions,
          remarks,
        ),
      ),
    postInvoice: (id: string) =>
      run(() =>
        Promise.resolve(accountingService.postSalesInvoice(
          {
            tenantId: context.scope.tenantId,
            branchId: context.scope.branchId,
            permittedBranchIds: context.permitted,
          },
          context.actor,
          id,
          context.permissions,
        )),
      ),
    transitionCreditNote: (id: string, action: "approve" | "return" | "resubmit" | "void", remarks?: string) =>
      run(() => salesService.transitionCreditNote(
        context.scope, context.permitted, id, action, context.actor, context.permissions, remarks,
      )),
    postCreditNote: (id: string) =>
      run(() => Promise.resolve(accountingService.postCreditNote({
        tenantId: context.scope.tenantId,
        branchId: context.scope.branchId,
        permittedBranchIds: context.permitted,
      }, context.actor, id, context.permissions))),
    refundCustomerCredit: (id: string, accountId: string) =>
      run(() => Promise.resolve(accountingService.refundCustomerCredit({
        tenantId: context.scope.tenantId,
        branchId: context.scope.branchId,
        permittedBranchIds: context.permitted,
      }, context.actor, id, accountId, context.permissions))),
    reverseCreditNote: (id: string, reason: string) =>
      run(() => Promise.resolve(accountingService.reverseCreditNote({
        tenantId: context.scope.tenantId,
        branchId: context.scope.branchId,
        permittedBranchIds: context.permitted,
      }, context.actor, id, reason, context.permissions))),
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
