import { useEffect } from "react";
import { Controller } from "react-hook-form";
import { useAppForm } from "@/shared/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { flashSaleService } from "../services/flashSaleService";
import { useWarehouseOptions } from "@/features/inventory/hooks/useWarehouseManagement";
import { useStockLocationOptions } from "@/features/inventory/hooks/useStockLocationManagement";
import {
  useInventoryBatches,
  useInventorySerialNumbers,
} from "@/features/inventory/hooks/useInventoryTracking";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { DatePicker } from "@/shared/components/forms/DatePicker";
import { FormField } from "@/shared/components/forms/FormField";
import { Select } from "@/shared/components/forms/Select";
import { Textarea } from "@/shared/components/forms/Textarea";
import { TextInput } from "@/shared/components/forms/TextInput";
import { getErrorMessage } from "@/shared/utils/errors";
import { appToast } from "@/shared/utils/toast";
import { usePaymentTerms, useTaxRates } from '@/features/settings/finance/hooks/useTenantSettings';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { PaymentTermSelect } from '@/features/settings/finance/components/PaymentTermSelect';
import { addPaymentTermDays, matchPaymentTerm } from '@/features/settings/finance/paymentTerms';
import { isSalesTaxApplicable } from '@/features/settings/finance/tax';
import {
  deliverySchema,
  recurringInvoiceSchema,
  salesInvoiceSchema,
  salesOrderSchema,
  salesQuotationSchema,
  salesReturnSchema,
  type DeliveryFormValues,
  type RecurringInvoiceFormValues,
  type SalesInvoiceFormValues,
  type SalesOrderFormValues,
  type SalesQuotationFormValues,
  type SalesReturnFormValues,
} from "../schemas/salesSchemas";
import {
  useDeliveryNotes,
  useSalesCustomerOptions,
  useSalesInvoices,
  useSalesMutations,
  useSalesOpportunityOptions,
  useSalesOrders,
  useSalesProductOptions,
  useSalespersonOptions,
} from "../hooks/useSales";
import type { SalesInvoice, SalesOrder, SalesQuotation } from "../types/sales";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}
interface QuotationProps extends Props {
  quotation?: SalesQuotation | null;
  initialOpportunityId?: string;
}
interface OrderProps extends Props {
  order?: SalesOrder | null;
}
interface EditableLine {
  productId: string;
  itemType?: "product" | "service";
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxCode?: string;
  taxPercent: number;
  pricesIncludeTax?: boolean;
}
const today = () => new Date().toISOString().slice(0, 10);
const future = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const blankLine = (): EditableLine => ({
  productId: "",
  variantId: "",
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  taxCode: "",
  taxPercent: 0,
  pricesIncludeTax: false,
});
const option = (
  rows: Array<{
    id: string;
    name?: string;
    referenceNumber?: string;
    code?: string;
  }>,
) =>
  rows.map((row) => ({
    value: row.id,
    label:
      row.referenceNumber ??
      `${row.name ?? row.id}${row.code ? ` (${row.code})` : ""}`,
  }));

function Footer({
  formId,
  busy,
  onClose,
  label = "Save",
}: {
  formId: string;
  busy: boolean;
  onClose: () => void;
  label?: string;
}) {
  return (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" form={formId} isLoading={busy}>
        {label}
      </Button>
    </>
  );
}
function SalesLineEditor({
  value,
  onChange,
  taxDate,
  currencyCode = "",
  formatMoney = (amount) => amount.toFixed(2),
  lockMasterData = false,
  separateProductService = false,
  branchId = "",
}: {
  value: EditableLine[];
  onChange: (value: EditableLine[]) => void;
  taxDate: string;
  currencyCode?: string;
  formatMoney?: (amount: number) => string;
  lockMasterData?: boolean;
  separateProductService?: boolean;
  branchId?: string;
}) {
  const { tenantId } = useTenant();
  const products = useSalesProductOptions();
  const taxQuery = useTaxRates();
  const taxes = taxQuery.taxes.filter((tax) => isSalesTaxApplicable(tax, taxDate));
  const update = (index: number, patch: Partial<EditableLine>) =>
    onChange(
      value.map((line, itemIndex) =>
        itemIndex === index ? { ...line, ...patch } : line,
      ),
    );
  const pricedLines = value.map((line) => {
    if (!lockMasterData) return line;
    const product = products.data?.find((item) => item.id === line.productId);
    if (!product) return line;
    const tax = taxes.find((item) => item.code === product.taxCode);
    const promotion = product.type === 'goods' && tenantId && branchId ? flashSaleService.active({ tenantId, branchId }, product.id, new Date(), 'sales_documents', line.quantity) : undefined;
    return {
      ...line,
      unitPrice: promotion?.salePrice ?? product.sellingPrice,
      taxCode: tax?.code ?? "",
      taxPercent: tax?.percentage ?? 0,
      pricesIncludeTax: product.pricesIncludeTax,
    };
  });
  const amounts = pricedLines.map((line) => {
    const subtotal = line.quantity * line.unitPrice;
    const discountAmount = subtotal * line.discountPercent / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = line.pricesIncludeTax
      ? taxableAmount - taxableAmount / (1 + line.taxPercent / 100)
      : taxableAmount * line.taxPercent / 100;
    return {
      subtotal,
      discountAmount,
      taxAmount,
      total: line.pricesIncludeTax ? taxableAmount : taxableAmount + taxAmount,
    };
  });
  const summary = amounts.reduce((total, amount) => ({
    subtotal: total.subtotal + amount.subtotal,
    discountAmount: total.discountAmount + amount.discountAmount,
    taxAmount: total.taxAmount + amount.taxAmount,
    total: total.total + amount.total,
  }), { subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 });
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">
          Products and services
        </h3>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={<Plus size={14} />}
          onClick={() => onChange([...value, blankLine()])}
        >
          Add Item
        </Button>
      </div>
      {value.map((line, index) => {
        const selectedProduct = products.data?.find((item) => item.id === line.productId);
        const selectionType = separateProductService
          ? line.itemType ?? (selectedProduct?.type === "service" ? "service" : selectedProduct ? "product" : "")
          : "";
        const pricedLine = pricedLines[index];
        const selectedPromotion = selectedProduct?.type === 'goods' && tenantId && branchId ? flashSaleService.active({ tenantId, branchId }, selectedProduct.id, new Date(), 'sales_documents', line.quantity) : undefined;
        const decimalPlaces = selectedProduct?.quantityDecimalPlaces ?? 2;
        const quantityStep = 10 ** -decimalPlaces;
        return (
          <div
            key={index}
            className={`grid gap-3 rounded-lg bg-white p-3 sm:grid-cols-2 ${lockMasterData ? "lg:grid-cols-12" : "lg:grid-cols-6"}`}
          >
          {separateProductService && (
            <FormField label="Item type" className={lockMasterData ? "lg:col-span-2" : "lg:col-span-2"}>
              <Select
                value={selectionType}
                onChange={(event) => {
                  update(index, {
                    itemType: event.target.value as "product" | "service",
                    productId: "",
                    quantity: 1,
                    unitPrice: 0,
                    taxCode: "",
                    taxPercent: 0,
                    pricesIncludeTax: false,
                  });
                }}
                placeholder="Select type"
                options={[
                  { value: "product", label: "Product" },
                  { value: "service", label: "Service" },
                ]}
              />
            </FormField>
          )}
          {(!separateProductService || selectionType) && (
          <FormField label={separateProductService ? selectionType === "service" ? "Service" : "Product" : "Product / service"} className={lockMasterData ? (separateProductService ? "lg:col-span-3" : "lg:col-span-3") : "lg:col-span-2"}>
            <Select
              value={line.productId}
              onChange={(event) => {
                const product = products.data?.find(
                  (item) => item.id === event.target.value,
                );
                const tax = taxes.find((item) => item.code === product?.taxCode);
                update(index, {
                  productId: event.target.value,
                  itemType: separateProductService ? selectionType as "product" | "service" : undefined,
                   unitPrice: product && product.type === 'goods' && tenantId && branchId ? flashSaleService.active({ tenantId, branchId }, product.id, new Date(), 'sales_documents', line.quantity)?.salePrice ?? product.sellingPrice : product?.sellingPrice ?? 0,
                  taxCode: tax?.code ?? "",
                  taxPercent: tax?.percentage ?? 0,
                  pricesIncludeTax: product?.pricesIncludeTax ?? false,
                  quantity:
                    product?.quantityDecimalPlaces === 0 && !Number.isInteger(line.quantity)
                      ? 1
                      : line.quantity,
                });
              }}
              placeholder={selectionType === "service" ? "Select service" : "Select product"}
              options={(products.data ?? []).filter((item) => separateProductService ? (selectionType === "service" ? item.type === "service" : item.type !== "service") : true).map((item) => ({
                value: item.id,
                label: `${item.name} (${item.sku})`,
              }))}
            />
          </FormField>
          )}
          {(!separateProductService || selectedProduct?.type !== "service") && (
            <FormField className={lockMasterData ? "lg:col-span-2" : undefined} label={selectedProduct ? `Quantity (${selectedProduct.uomName})` : "Quantity"}>
              <TextInput
                type="number"
                min={quantityStep}
                step={quantityStep}
                value={line.quantity}
                onChange={(event) => {
                  const quantity = Number(event.target.value);
                  if (decimalPlaces === 0 && !Number.isInteger(quantity)) return;
                  update(index, { quantity });
                }}
              />
            </FormField>
          )}
          <FormField
            className={lockMasterData ? "lg:col-span-2" : undefined}
            label={`${selectedProduct?.type === "service" ? "Service price" : "Unit price"}${currencyCode ? ` (${currencyCode})` : lockMasterData ? " (base currency)" : ""}`}
          >
            {lockMasterData ? (
              <TextInput type="number" value={pricedLine.unitPrice} readOnly className="bg-slate-100" />
            ) : (
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={line.unitPrice}
                onChange={(event) => update(index, { unitPrice: Number(event.target.value) })}
              />
            )}
          </FormField>
          <FormField className={lockMasterData ? "lg:col-span-1" : undefined} label="Discount %">
            <TextInput
              type="number"
              min="0"
              max="100"
              disabled={Boolean(selectedPromotion && !selectedPromotion.allowAdditionalDiscounts)}
              value={line.discountPercent}
              onChange={(event) =>
                update(index, { discountPercent: Number(event.target.value) })
              }
            />
            {selectedPromotion && <p className="mt-1 text-xs text-violet-700">{selectedPromotion.name} applied{selectedPromotion.allowAdditionalDiscounts ? '' : ' · additional discount disabled'}</p>}
          </FormField>
          <FormField className={lockMasterData ? "lg:col-span-2" : undefined} label="Sales tax">
            {lockMasterData ? (
              <TextInput
                value={pricedLine.taxCode ? `${pricedLine.taxCode} (${pricedLine.taxPercent}%)${pricedLine.pricesIncludeTax ? " · Included" : ""}` : "No tax / Exempt"}
                readOnly
                className="bg-slate-100"
              />
            ) : (
              <Select
                value={line.taxCode ?? ""}
                onChange={(event) => {
                  const tax = taxes.find((item) => item.code === event.target.value);
                  update(index, { taxCode: tax?.code ?? "", taxPercent: tax?.percentage ?? 0 });
                }}
                options={[{ value: "", label: "No tax / Exempt" }, ...taxes.map((tax) => ({ value: tax.code, label: `${tax.name} (${tax.percentage}%)` }))]}
              />
            )}
          </FormField>
          {lockMasterData && <FormField className="lg:col-span-2" label="Line total">
              <TextInput value={formatMoney(amounts[index].total)} readOnly className="bg-slate-100 font-semibold" />
            </FormField>}
          {value.length > 1 && (
            <div className={`flex justify-end sm:col-span-2 ${lockMasterData ? "lg:col-span-12" : "lg:col-span-6"}`}>
              <Button
                type="button"
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={14} />}
                onClick={() =>
                  onChange(value.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                Remove
              </Button>
            </div>
          )}
          </div>
        );
      })}
      {lockMasterData && <div className="grid gap-3 border-t border-slate-200 pt-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-slate-500">Subtotal</p><p className="font-semibold text-slate-900">{formatMoney(summary.subtotal)}</p></div>
        <div><p className="text-slate-500">Discount</p><p className="font-semibold text-slate-900">{formatMoney(summary.discountAmount)}</p></div>
        <div><p className="text-slate-500">Sales tax</p><p className="font-semibold text-slate-900">{formatMoney(summary.taxAmount)}</p></div>
        <div className="rounded-lg bg-violet-50 px-3 py-2"><p className="text-violet-700">Quotation total</p><p className="text-base font-bold text-violet-900">{formatMoney(summary.total)}</p></div>
      </div>}
    </div>
  );
}

export function SalesQuotationFormModal({
  isOpen,
  onClose,
  quotation,
  initialOpportunityId = "",
}: QuotationProps) {
  const { branches, branchId } = useBranch();
  const customers = useSalesCustomerOptions(),
    people = useSalespersonOptions(),
    opportunities = useSalesOpportunityOptions(),
    mutations = useSalesMutations();
  const tenantCurrency = useTenantCurrency();
  const form = useAppForm<SalesQuotationFormValues>({
    resolver: zodResolver(salesQuotationSchema),
    defaultValues: {
      customerId: "",
      branchId: branchId ?? "",
      salespersonId: "",
      opportunityId: "",
      quotationDate: today(),
      expiryDate: future(30),
      terms: "Prices valid until the expiry date.",
      notes: "",
      items: [blankLine()],
    },
  });
  useEffect(() => {
    if (!isOpen) return;
    form.reset(
      quotation
        ? {
            customerId: quotation.customerId,
            branchId: quotation.branchId,
            salespersonId: quotation.salespersonId,
            opportunityId: quotation.opportunityId ?? "",
            quotationDate: quotation.quotationDate,
            expiryDate: quotation.expiryDate,
            terms: quotation.terms,
            notes: quotation.notes ?? "",
            items: quotation.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              taxCode: item.taxCode,
              taxPercent: item.taxPercent,
              pricesIncludeTax: item.pricesIncludeTax,
            })),
          }
        : {
            customerId: "",
            branchId: branchId ?? "",
            salespersonId: "",
            opportunityId: initialOpportunityId,
            quotationDate: today(),
            expiryDate: future(30),
            terms: "Prices valid until the expiry date.",
            notes: "",
            items: [blankLine()],
          },
    );
  }, [branchId, form, initialOpportunityId, isOpen, quotation]);
  useEffect(() => {
    if (!isOpen || quotation || !initialOpportunityId) return;
    const opportunity = opportunities.data?.find(
      (item) => item.id === initialOpportunityId,
    );
    if (!opportunity) return;
    form.setValue("opportunityId", opportunity.id, { shouldValidate: true });
    form.setValue("customerId", opportunity.customerId, { shouldValidate: true });
    form.setValue("branchId", opportunity.branchId, { shouldValidate: true });
    if (opportunity.salespersonId) {
      form.setValue("salespersonId", opportunity.salespersonId, {
        shouldValidate: true,
      });
    }
  }, [form, initialOpportunityId, isOpen, opportunities.data, quotation]);
  const submit = form.handleSubmit(async (values) => {
    try {
      if (quotation) await mutations.updateQuotation(quotation.id, values);
      else await mutations.createQuotation(values);
      appToast.success(
        quotation ? "Quotation updated." : "Quotation saved as draft.",
      );
      onClose();
    } catch (error) {
      const message = getErrorMessage(error, "Unable to save quotation.");
      if (message.toLowerCase().includes("credit limit")) {
        form.setError("root.creditLimit", { type: "validate", message });
      }
      appToast.error(message);
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        quotation ? `Edit ${quotation.referenceNumber}` : "New Sales Quotation"
      }
      maxWidth="1050px"
      footer={
        <Footer
          formId="sales-quotation-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Save Draft"
        />
      }
    >
      <form
        id="sales-quotation-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        {form.formState.errors.root?.creditLimit?.message && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {form.formState.errors.root.creditLimit.message}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Opportunity">
            <Select
              {...form.register("opportunityId", {
                onChange: (event) => {
                  const opportunity = opportunities.data?.find(
                    (item) => item.id === event.target.value,
                  );
                  if (opportunity) {
                    form.setValue("customerId", opportunity.customerId);
                    form.setValue("branchId", opportunity.branchId);
                    if (opportunity.salespersonId)
                      form.setValue("salespersonId", opportunity.salespersonId);
                  }
                },
              })}
              placeholder="Optional opportunity"
              options={option(opportunities.data ?? [])}
            />
          </FormField>
          <FormField
            label="Customer"
            required
            error={form.formState.errors.customerId?.message}
          >
            <Select
              {...form.register("customerId", {
                onChange: (event) => {
                  const customer = customers.data?.find(
                    (item) => item.id === event.target.value,
                  );
                  if (customer) {
                    form.setValue("branchId", customer.branchId);
                  }
                },
              })}
              placeholder="Select customer"
              options={option(customers.data ?? [])}
            />
          </FormField>
          <FormField
            label="Branch"
            required
            error={form.formState.errors.branchId?.message}
          >
            <Select {...form.register("branchId")} options={option(branches)} />
          </FormField>
          <FormField
            label="Salesperson"
            required
            error={form.formState.errors.salespersonId?.message}
          >
            <Select
              {...form.register("salespersonId")}
              placeholder="Select salesperson"
              options={option(people.data ?? [])}
            />
          </FormField>
          <FormField label="Quotation date">
            <DatePicker {...form.register("quotationDate")} />
          </FormField>
          <FormField
            label="Expiry date"
            error={form.formState.errors.expiryDate?.message}
          >
            <DatePicker {...form.register("expiryDate")} />
          </FormField>
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <SalesLineEditor
              value={field.value}
              onChange={field.onChange}
              taxDate={form.watch("quotationDate")}
              currencyCode={tenantCurrency.currencyCode ?? ""}
              formatMoney={(amount) => tenantCurrency.formatMoneyInCurrency(amount, tenantCurrency.currencyCode)}
              lockMasterData
              separateProductService
              branchId={form.watch("branchId")}
            />
          )}
        />
        <FormField
          label="Terms"
          required
          error={form.formState.errors.terms?.message}
        >
          <Textarea rows={2} {...form.register("terms")} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function SalesOrderFormModal({ isOpen, onClose, order }: OrderProps) {
  const { branches, branchId } = useBranch();
  const customers = useSalesCustomerOptions(),
    people = useSalespersonOptions(),
    products = useSalesProductOptions(),
    mutations = useSalesMutations();
  const tenantCurrency = useTenantCurrency();
  const form = useAppForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues: {
      customerId: "",
      branchId: branchId ?? "",
      salespersonId: "",
      warehouseId: "",
      orderDate: today(),
      expectedDeliveryDate: future(7),
      deliveryAddress: "",
      paymentTerms: "",
      currency: tenantCurrency.currencyCode ?? "USD",
      notes: "",
      items: [blankLine()],
    },
  });
  const selectedBranch = form.watch("branchId");
  const orderItems = form.watch("items");
  const requiresWarehouse = orderItems.some((item) => {
    const product = products.data?.find((option) => option.id === item.productId);
    return !product || product.type !== "service";
  });
  const warehouses = useWarehouseOptions(selectedBranch);
  useEffect(() => {
    if (!isOpen) return;
    form.reset(
      order
        ? {
            customerId: order.customerId,
            branchId: order.branchId,
            salespersonId: order.salespersonId,
            warehouseId: order.warehouseId,
            orderDate: order.orderDate,
            expectedDeliveryDate: order.expectedDeliveryDate,
            deliveryAddress: order.deliveryAddress,
            paymentTerms: order.paymentTerms,
            currency: order.currency,
            notes: order.notes ?? "",
            items: order.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              taxCode: item.taxCode,
              taxPercent: item.taxPercent,
            })),
          }
        : {
            customerId: "",
            branchId: branchId ?? "",
            salespersonId: "",
            warehouseId: "",
            orderDate: today(),
            expectedDeliveryDate: future(7),
            deliveryAddress: "",
            paymentTerms: "",
            currency: tenantCurrency.currencyCode ?? "USD",
            notes: "",
            items: [blankLine()],
          },
    );
  }, [branchId, form, isOpen, order, tenantCurrency.currencyCode]);
  const submit = form.handleSubmit(async (values) => {
    try {
      if (order) await mutations.updateOrder(order.id, values);
      else await mutations.createOrder(values);
      appToast.success(
        order ? "Sales order updated." : "Direct sales order saved as draft.",
      );
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to save sales order."));
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={order ? `Edit ${order.referenceNumber}` : "New Direct Sales Order"}
      maxWidth="1050px"
      footer={
        <Footer
          formId="sales-order-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label={order?.status === "returned_to_sales" ? "Save Corrections" : "Save Draft"}
        />
      }
    >
      <form
        id="sales-order-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Customer" required>
            <Select
              {...form.register("customerId", {
                onChange: (event) => {
                  const customer = customers.data?.find(
                    (item) => item.id === event.target.value,
                  );
                  if (customer) {
                    form.setValue("branchId", customer.branchId);
                    form.setValue("paymentTerms", customer.paymentTerms);
                    form.setValue("deliveryAddress", customer.deliveryAddress);
                    form.setValue("warehouseId", "");
                  }
                },
              })}
              placeholder="Select customer"
              options={option(customers.data ?? [])}
            />
          </FormField>
          <FormField label="Branch" required>
            <Select
              {...form.register("branchId", {
                onChange: () => form.setValue("warehouseId", ""),
              })}
              options={option(branches)}
            />
          </FormField>
          <FormField label="Warehouse" required={requiresWarehouse}>
            <Select
              {...form.register("warehouseId")}
              placeholder="Select warehouse"
              options={option(warehouses.data ?? [])}
            />
          </FormField>
          <FormField label="Salesperson" required>
            <Select
              {...form.register("salespersonId")}
              options={option(people.data ?? [])}
            />
          </FormField>
          <FormField label="Order date">
            <DatePicker {...form.register("orderDate")} />
          </FormField>
          <FormField label="Expected delivery">
            <DatePicker {...form.register("expectedDeliveryDate")} />
          </FormField>
          <FormField label="Payment terms">
            <Controller control={form.control} name="paymentTerms" render={({ field }) => <PaymentTermSelect value={field.value} onChange={(code) => field.onChange(code)} />} />
          </FormField>
          <FormField label="Currency">
            <TextInput {...form.register("currency")} readOnly />
          </FormField>
        </div>
        <FormField label="Delivery address" required>
          <Textarea rows={2} {...form.register("deliveryAddress")} />
        </FormField>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <SalesLineEditor
              value={field.value}
              onChange={field.onChange}
              taxDate={form.watch("orderDate")}
              currencyCode={form.watch("currency")}
              formatMoney={(amount) => tenantCurrency.formatMoneyInCurrency(amount, form.watch("currency"))}
              lockMasterData
              separateProductService
              branchId={form.watch("branchId")}
            />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

interface DeliveryProps extends Props {
  initialOrderId?: string;
}
export function DeliveryFormModal({
  isOpen,
  onClose,
  initialOrderId = "",
}: DeliveryProps) {
  const orders = useSalesOrders({ branchId: "all", pageSize: 100 }),
    deliveries = useDeliveryNotes({ branchId: "all", pageSize: 100 }),
    products = useSalesProductOptions(),
    mutations = useSalesMutations();
  const { branches } = useBranch();
  const form = useAppForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      salesOrderId: initialOrderId,
      warehouseId: "",
      locationId: "",
      deliveryDate: today(),
      deliveryAddress: "",
      notes: "",
      items: [],
    },
  });
  const orderId = form.watch("salesOrderId"),
    warehouseId = form.watch("warehouseId"),
    locationId = form.watch("locationId");
  const locations = useStockLocationOptions(warehouseId),
    warehouses = useWarehouseOptions(undefined, true),
    batches = useInventoryBatches({
      branchId: "all",
      warehouseId: warehouseId || "__none__",
      locationId: locationId || "__none__",
      permittedBranchIds: branches.map((branch) => branch.id),
      status: "available",
      pageSize: 100,
    }),
    serials = useInventorySerialNumbers({
      branchId: "all",
      warehouseId: warehouseId || "__none__",
      locationId: locationId || "__none__",
      permittedBranchIds: branches.map((branch) => branch.id),
      status: "available",
      pageSize: 100,
    });
  useEffect(() => {
    if (isOpen && initialOrderId) form.setValue("salesOrderId", initialOrderId);
  }, [form, initialOrderId, isOpen]);
  useEffect(() => {
    const order = orders.data?.data.find((item) => item.id === orderId);
    if (!order) return;
    const previous = (deliveries.data?.data ?? []).filter(
      (item) => item.salesOrderId === order.id,
    );
    form.setValue("warehouseId", order.warehouseId ?? "");
    form.setValue("deliveryAddress", order.deliveryAddress);
    form.setValue(
      "items",
      order.items
        .filter(
          (line) =>
            products.data?.find((item) => item.id === line.productId)
              ?.trackInventory,
        )
        .map((line) => {
          const deliveredQuantity = Math.max(
            0,
            line.quantity -
                previous
                  .flatMap((item) => item.items)
                  .filter((item) => item.salesOrderLineId === line.id)
                  .reduce((sum, item) => sum + item.deliveredQuantity, 0),
          );
          const batch = batches.data?.data.find(
            (item) =>
                item.productId === line.productId &&
                (item.variantId ?? "") === (line.variantId ?? "") &&
                item.remainingQuantity >= deliveredQuantity,
          );
          return {
            salesOrderLineId: line.id,
            productId: line.productId,
            variantId: line.variantId,
            deliveredQuantity,
            batchReference: batch?.batchNumber ?? "",
            expiryDate: batch?.expiryDate ?? "",
            serialReferences: serials.data?.data
                .filter(
                  (item) =>
                    item.productId === line.productId &&
                    (item.variantId ?? "") === (line.variantId ?? ""),
                )
                .slice(0, deliveredQuantity)
                .map((item) => item.serialNumber) ?? [],
          };
        }),
    );
  }, [
    batches.data?.data,
    deliveries.data?.data,
    form,
    orderId,
    orders.data?.data,
    products.data,
    serials.data?.data,
  ]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.completeDelivery(values);
      appToast.success("Delivery completed and stock deducted.");
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to complete delivery."));
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete Delivery"
      maxWidth="1000px"
      footer={
        <Footer
          formId="delivery-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Complete Delivery"
        />
      }
    >
      <form
        id="delivery-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Sales order" required>
            <Select
              {...form.register("salesOrderId")}
              placeholder="Select order"
              disabled={Boolean(initialOrderId)}
              options={option(
                (orders.data?.data ?? []).filter((item) =>
                  ["confirmed", "processing", "partially_delivered"].includes(
                    item.status,
                  ),
                ),
              )}
            />
          </FormField>
          <FormField label="Warehouse">
            <Select
              {...form.register("warehouseId")}
              options={option(warehouses.data ?? [])}
              disabled
            />
          </FormField>
          <FormField label="Stock location" required>
            <Select
              {...form.register("locationId")}
              placeholder="Select location"
              options={option(locations.data ?? [])}
            />
          </FormField>
          <FormField label="Delivery date">
            <DatePicker {...form.register("deliveryDate")} />
          </FormField>
        </div>
        <FormField label="Delivery address">
          <Textarea rows={2} {...form.register("deliveryAddress")} />
        </FormField>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <div className="space-y-3">
              {field.value.map((line, index) => {
                const product = products.data?.find(
                  (item) => item.id === line.productId,
                );
                return (
                  <div
                    key={`${line.productId}-${index}`}
                    className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <div>
                      <div className="text-sm font-semibold">
                        {product?.name ?? line.productId}
                      </div>
                      <div className="text-xs text-slate-500">
                        {product?.sku}
                      </div>
                    </div>
                    <FormField label="Deliver quantity">
                      <TextInput
                        type="number"
                        min="1"
                        value={line.deliveredQuantity}
                        readOnly
                        aria-readonly="true"
                      />
                    </FormField>
                    {product?.trackByBatch && (
                      <FormField label="Batch">
                        <TextInput
                          value={line.batchReference ?? ""}
                          readOnly
                          aria-readonly="true"
                        />
                      </FormField>
                    )}
                    {product?.trackExpiry && (
                      <FormField label="Expiry date">
                        <TextInput
                          type="date"
                          value={line.expiryDate ?? ""}
                          readOnly
                          aria-readonly="true"
                        />
                      </FormField>
                    )}
                    {product?.trackBySerialNumber && (
                      <FormField label="Serial numbers">
                        <TextInput
                          value={line.serialReferences.join(", ")}
                          readOnly
                          aria-readonly="true"
                        />
                      </FormField>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

interface SalesInvoiceProps extends Props {
  initialOrderId?: string;
  invoice?: SalesInvoice | null;
}
export function SalesInvoiceFormModal({
  isOpen,
  onClose,
  initialOrderId = "",
  invoice,
}: SalesInvoiceProps) {
  const { branches, branchId } = useBranch();
  const customers = useSalesCustomerOptions(),
    people = useSalespersonOptions(),
    productOptions = useSalesProductOptions(),
    orders = useSalesOrders({ branchId: "all", pageSize: Number.MAX_SAFE_INTEGER }),
    deliveries = useDeliveryNotes({ branchId: "all", pageSize: Number.MAX_SAFE_INTEGER }),
    mutations = useSalesMutations();
  const { terms } = usePaymentTerms();
  const form = useAppForm<SalesInvoiceFormValues>({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      customerId: "",
      branchId: branchId ?? "",
      salespersonId: "",
      salesOrderId: initialOrderId,
      deliveryNoteId: "",
      invoiceDate: today(),
      dueDate: future(30),
      paymentTerms: "",
      currency: "USD",
      notes: "",
      items: [blankLine()],
    },
  });
  const linkedOrderId = invoice?.salesOrderId ?? initialOrderId;
  const orderId = form.watch("salesOrderId"),
    deliveryId = form.watch("deliveryNoteId");
  const selectedOrder = orders.data?.data.find((item) => item.id === orderId);
  const selectedOrderIsServiceOnly = Boolean(selectedOrder?.items.length) && selectedOrder!.items.every(
    (item) => productOptions.data?.find((product) => product.id === item.productId)?.type === "service",
  );
  const invoiceDate = form.watch("invoiceDate"), paymentTerms = form.watch("paymentTerms");
  useEffect(() => {
    if (!isOpen) return;
    if (invoice) {
      form.reset({
        customerId: invoice.customerId,
        branchId: invoice.branchId,
        salespersonId: invoice.salespersonId,
        salesOrderId: invoice.salesOrderId ?? "",
        deliveryNoteId: invoice.deliveryNoteId ?? "",
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        paymentTerms: invoice.paymentTerms,
        currency: invoice.currency,
        notes: invoice.notes ?? "",
        items: invoice.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxCode: item.taxCode,
          taxPercent: item.taxPercent,
          pricesIncludeTax: item.pricesIncludeTax,
        })),
      });
      return;
    }
    if (initialOrderId) {
      form.setValue("salesOrderId", initialOrderId);
      form.setValue("deliveryNoteId", "");
    }
  }, [form, initialOrderId, invoice, isOpen]);
  useEffect(() => {
    const term = matchPaymentTerm(terms, paymentTerms);
    if (term && invoiceDate) form.setValue("dueDate", addPaymentTermDays(invoiceDate, term.dueDays));
  }, [form, invoiceDate, paymentTerms, terms]);
  useEffect(() => {
    if (invoice) return;
    const order = orders.data?.data.find((item) => item.id === orderId);
    if (order) {
      form.setValue("customerId", order.customerId);
      form.setValue("branchId", order.branchId);
      form.setValue("salespersonId", order.salespersonId);
      form.setValue("paymentTerms", order.paymentTerms);
      form.setValue("currency", order.currency);
      form.setValue(
        "items",
        order.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxCode: item.taxCode,
          taxPercent: item.taxPercent,
        })),
      );
    }
  }, [form, invoice, orderId, orders.data?.data]);
  useEffect(() => {
    if (invoice) return;
    const delivery = deliveries.data?.data.find(
      (item) => item.id === deliveryId,
    );
    const order = orders.data?.data.find(
      (item) => item.id === delivery?.salesOrderId,
    );
    if (delivery && order)
      form.setValue(
        "items",
        delivery.items.map((item) => {
          const source = order.items.find(
            (line) => line.id === item.salesOrderLineId,
          );
          return {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.deliveredQuantity,
            unitPrice: source?.unitPrice ?? 0,
            discountPercent: source?.discountPercent ?? 0,
            taxCode: source?.taxCode,
            taxPercent: source?.taxPercent ?? 0,
          };
        }),
      );
  }, [deliveries.data?.data, deliveryId, form, invoice, orders.data?.data]);
  const submit = form.handleSubmit(async (values) => {
    try {
      if (invoice) {
        await mutations.updateInvoice(invoice.id, values);
        appToast.success("Returned invoice corrections saved.");
      } else {
        await mutations.createInvoice(values);
        appToast.success("Sales invoice saved as draft.");
      }
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to create invoice."));
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={invoice ? `Edit Returned Invoice ${invoice.referenceNumber}` : selectedOrder ? `Create Invoice from ${selectedOrder.referenceNumber}` : "New Sales Invoice"}
      maxWidth="1050px"
      footer={
        <Footer
          formId="sales-invoice-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label={invoice ? "Save Corrections" : "Save Draft"}
        />
      }
    >
      <form
        id="sales-invoice-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        {invoice?.status === "returned" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Finance return reason:</span>{" "}
            {[...invoice.approval.history]
              .reverse()
              .find((entry) => entry.status === "rejected")
              ?.remarks?.trim() || "Finance did not provide a reason."}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Sales order">
            <Select
              {...form.register("salesOrderId", {
                onChange: () => form.setValue("deliveryNoteId", ""),
              })}
              disabled={Boolean(invoice)}
              placeholder="Select delivered order"
              options={option(
                (orders.data?.data ?? []).filter(
                  (item) =>
                    (item.status === "delivered" ||
                      (item.status === "confirmed" && Boolean(item.items.length) && item.items.every(
                        (line) => productOptions.data?.find((product) => product.id === line.productId)?.type === "service",
                      ))) &&
                    (!linkedOrderId || item.id === linkedOrderId),
                ),
              )}
            />
          </FormField>
          <FormField label="Delivery note">
            <Select
              {...form.register("deliveryNoteId")}
              placeholder={selectedOrderIsServiceOnly
                ? "Not required for a service-only order"
                : initialOrderId ? "Linked through the delivered order" : "Optional delivery"}
              disabled={Boolean(linkedOrderId)}
              options={option(
                (deliveries.data?.data ?? []).filter(
                  (item) => !orderId || item.salesOrderId === orderId,
                ),
              )}
            />
          </FormField>
          <FormField label="Customer" required>
            <Select
              {...form.register("customerId", { onChange: (event) => { const customer = customers.data?.find((item) => item.id === event.target.value); if (customer) { form.setValue("branchId", customer.branchId); form.setValue("currency", customer.currency); form.setValue("paymentTerms", customer.paymentTerms); } } })}
              disabled={Boolean(invoice)}
              options={option(customers.data ?? [])}
            />
          </FormField>
          <FormField label="Branch" required>
            <Select {...form.register("branchId")} options={option(branches)} disabled={Boolean(invoice)} />
          </FormField>
          <FormField label="Salesperson" required>
            <Select
              {...form.register("salespersonId")}
              options={option(people.data ?? [])}
              disabled={Boolean(invoice)}
            />
          </FormField>
          <FormField label="Invoice date">
            <DatePicker {...form.register("invoiceDate")} />
          </FormField>
          <FormField label="Due date">
            <DatePicker {...form.register("dueDate")} readOnly aria-readonly="true" />
          </FormField>
          <FormField label="Payment terms">
            <Controller control={form.control} name="paymentTerms" render={({ field }) => <PaymentTermSelect value={field.value} onChange={(code) => field.onChange(code)} />} />
          </FormField>
          <FormField label="Currency">
            <TextInput {...form.register("currency")} readOnly={Boolean(invoice)} aria-readonly={Boolean(invoice)} />
          </FormField>
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <SalesLineEditor value={field.value} onChange={field.onChange} taxDate={form.watch("invoiceDate")} />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function SalesReturnFormModal({ isOpen, onClose }: Props) {
  const deliveries = useDeliveryNotes({ branchId: "all", pageSize: 100 }),
    invoices = useSalesInvoices({ branchId: "all", pageSize: 100 }),
    orders = useSalesOrders({ branchId: "all", pageSize: 100 }),
    products = useSalesProductOptions(),
    mutations = useSalesMutations();
  const form = useAppForm<SalesReturnFormValues>({
    resolver: zodResolver(salesReturnSchema),
    defaultValues: {
      salesOrderId: "",
      deliveryNoteId: "",
      invoiceId: "",
      warehouseId: "",
      locationId: "",
      reason: "",
      notes: "",
      items: [],
    },
  });
  const deliveryId = form.watch("deliveryNoteId"),
    warehouseId = form.watch("warehouseId");
  const locations = useStockLocationOptions(warehouseId);
  useEffect(() => {
    const delivery = deliveries.data?.data.find(
      (item) => item.id === deliveryId,
    );
    if (!delivery) return;
    form.setValue("salesOrderId", delivery.salesOrderId);
    form.setValue("warehouseId", delivery.warehouseId);
    form.setValue("locationId", delivery.locationId);
    form.setValue(
      "invoiceId",
      invoices.data?.data.find((item) => item.deliveryNoteId === delivery.id)
        ?.id ?? "",
    );
    form.setValue(
      "items",
      delivery.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.deliveredQuantity,
        condition: "usable" as const,
        batchReference: item.batchReference ?? "",
        serialReferences: item.serialReferences ?? [],
      })),
    );
  }, [deliveries.data?.data, deliveryId, form, invoices.data?.data]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.completeReturn(values);
      appToast.success(
        "Sales return completed and credit-note handoff prepared.",
      );
      onClose();
    } catch (error) {
      appToast.error(
        getErrorMessage(error, "Unable to complete sales return."),
      );
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sales Return & Credit Note"
      maxWidth="1000px"
      footer={
        <Footer
          formId="sales-return-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Complete Return"
        />
      }
    >
      <form
        id="sales-return-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Delivery note">
            <Select
              {...form.register("deliveryNoteId")}
              placeholder="Select delivery"
              options={option(deliveries.data?.data ?? [])}
            />
          </FormField>
          <FormField label="Sales order">
            <Select
              {...form.register("salesOrderId")}
              options={option(orders.data?.data ?? [])}
              disabled
            />
          </FormField>
          <FormField label="Invoice">
            <Select
              {...form.register("invoiceId")}
              options={option(invoices.data?.data ?? [])}
              disabled
            />
          </FormField>
          <FormField label="Location">
            <Select
              {...form.register("locationId")}
              options={option(locations.data ?? [])}
              disabled
            />
          </FormField>
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <div className="space-y-3">
              {field.value.map((line, index) => {
                const product = products.data?.find(
                  (item) => item.id === line.productId,
                );
                return (
                  <div
                    key={`${line.productId}-${index}`}
                    className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <div>
                      <div className="text-sm font-semibold">
                        {product?.name ?? line.productId}
                      </div>
                      <div className="text-xs text-slate-500">
                        {product?.sku}
                      </div>
                    </div>
                    <FormField label="Quantity">
                      <TextInput
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(event) =>
                          field.onChange(
                            field.value.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    quantity: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Condition">
                      <Select
                        value={line.condition}
                        onChange={(event) =>
                          field.onChange(
                            field.value.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    condition: event.target.value as
                                      "usable" | "damaged",
                                  }
                                : item,
                            ),
                          )
                        }
                        options={[
                          { value: "usable", label: "Usable - restore stock" },
                          {
                            value: "damaged",
                            label: "Damaged - no sellable stock",
                          },
                        ]}
                      />
                    </FormField>
                    {product?.trackByBatch && (
                      <FormField label="Batch">
                        <TextInput
                          value={line.batchReference ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              field.value.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      batchReference: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </FormField>
                    )}
                    {product?.trackBySerialNumber && (
                      <FormField label="Serials">
                        <TextInput
                          value={line.serialReferences.join(", ")}
                          onChange={(event) =>
                            field.onChange(
                              field.value.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      serialReferences: event.target.value
                                        .split(",")
                                        .map((value) => value.trim())
                                        .filter(Boolean),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </FormField>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        />
        <FormField label="Reason" required>
          <Textarea rows={2} {...form.register("reason")} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function RecurringInvoiceFormModal({ isOpen, onClose }: Props) {
  const { branches, branchId } = useBranch();
  const customers = useSalesCustomerOptions(),
    people = useSalespersonOptions(),
    mutations = useSalesMutations();
  const form = useAppForm<RecurringInvoiceFormValues>({
    resolver: zodResolver(recurringInvoiceSchema),
    defaultValues: {
      customerId: "",
      branchId: branchId ?? "",
      salespersonId: "",
      frequency: "monthly",
      startDate: future(1),
      endDate: "",
      paymentTerms: "",
      currency: "USD",
      notes: "",
      items: [blankLine()],
    },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.createRecurring(values);
      appToast.success("Recurring invoice schedule created.");
      onClose();
    } catch (error) {
      appToast.error(
        getErrorMessage(error, "Unable to create recurring schedule."),
      );
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Recurring Invoice Schedule"
      maxWidth="1000px"
      footer={
        <Footer
          formId="recurring-invoice-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
        />
      }
    >
      <form
        id="recurring-invoice-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Customer">
            <Select
              {...form.register("customerId", {
                onChange: (event) => {
                  const customer = customers.data?.find(
                    (item) => item.id === event.target.value,
                  );
                  if (customer) {
                    form.setValue("branchId", customer.branchId);
                    form.setValue("currency", customer.currency);
                    form.setValue("paymentTerms", customer.paymentTerms);
                  }
                },
              })}
              options={option(customers.data ?? [])}
            />
          </FormField>
          <FormField label="Branch">
            <Select {...form.register("branchId")} options={option(branches)} />
          </FormField>
          <FormField label="Salesperson">
            <Select
              {...form.register("salespersonId")}
              options={option(people.data ?? [])}
            />
          </FormField>
          <FormField label="Frequency">
            <Select
              {...form.register("frequency")}
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "yearly", label: "Yearly" },
              ]}
            />
          </FormField>
          <FormField label="Start date">
            <DatePicker {...form.register("startDate")} />
          </FormField>
          <FormField label="End date">
            <DatePicker {...form.register("endDate")} />
          </FormField>
          <FormField label="Payment terms">
            <Controller control={form.control} name="paymentTerms" render={({ field }) => <PaymentTermSelect value={field.value} onChange={(code) => field.onChange(code)} />} />
          </FormField>
          <FormField label="Currency">
            <TextInput {...form.register("currency")} />
          </FormField>
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <SalesLineEditor value={field.value} onChange={field.onChange} taxDate={form.watch("startDate")} />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}
