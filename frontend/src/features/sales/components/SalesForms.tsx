import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useBranch } from "@/core/branch/branch-context";
import { useWarehouseOptions } from "@/features/inventory/hooks/useWarehouseManagement";
import { useStockLocationOptions } from "@/features/inventory/hooks/useStockLocationManagement";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { DatePicker } from "@/shared/components/forms/DatePicker";
import { FormField } from "@/shared/components/forms/FormField";
import { Select } from "@/shared/components/forms/Select";
import { Textarea } from "@/shared/components/forms/Textarea";
import { TextInput } from "@/shared/components/forms/TextInput";
import { getErrorMessage } from "@/shared/utils/errors";
import { appToast } from "@/shared/utils/toast";
import {
  customerPaymentSchema,
  deliverySchema,
  recurringInvoiceSchema,
  salesInvoiceSchema,
  salesOrderSchema,
  salesQuotationSchema,
  salesReturnSchema,
  type CustomerPaymentFormValues,
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
import type { SalesOrder, SalesQuotation } from "../types/sales";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}
interface QuotationProps extends Props {
  quotation?: SalesQuotation | null;
}
interface OrderProps extends Props {
  order?: SalesOrder | null;
}
interface EditableLine {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
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
  taxPercent: 0,
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
}: {
  value: EditableLine[];
  onChange: (value: EditableLine[]) => void;
}) {
  const products = useSalesProductOptions();
  const update = (index: number, patch: Partial<EditableLine>) =>
    onChange(
      value.map((line, itemIndex) =>
        itemIndex === index ? { ...line, ...patch } : line,
      ),
    );
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
      {value.map((line, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-lg bg-white p-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          <FormField label="Product / service" className="lg:col-span-2">
            <Select
              value={line.productId}
              onChange={(event) => {
                const product = products.data?.find(
                  (item) => item.id === event.target.value,
                );
                update(index, {
                  productId: event.target.value,
                  unitPrice: product?.sellingPrice ?? line.unitPrice,
                });
              }}
              placeholder="Select item"
              options={(products.data ?? []).map((item) => ({
                value: item.id,
                label: `${item.name} (${item.sku})`,
              }))}
            />
          </FormField>
          <FormField label="Quantity">
            <TextInput
              type="number"
              min="0.01"
              step="0.01"
              value={line.quantity}
              onChange={(event) =>
                update(index, { quantity: Number(event.target.value) })
              }
            />
          </FormField>
          <FormField label="Unit price">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice}
              onChange={(event) =>
                update(index, { unitPrice: Number(event.target.value) })
              }
            />
          </FormField>
          <FormField label="Discount %">
            <TextInput
              type="number"
              min="0"
              max="100"
              value={line.discountPercent}
              onChange={(event) =>
                update(index, { discountPercent: Number(event.target.value) })
              }
            />
          </FormField>
          <FormField label="Tax %">
            <TextInput
              type="number"
              min="0"
              max="100"
              value={line.taxPercent}
              onChange={(event) =>
                update(index, { taxPercent: Number(event.target.value) })
              }
            />
          </FormField>
          {value.length > 1 && (
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
          )}
        </div>
      ))}
    </div>
  );
}

export function SalesQuotationFormModal({
  isOpen,
  onClose,
  quotation,
}: QuotationProps) {
  const { branches, branchId } = useBranch();
  const customers = useSalesCustomerOptions(),
    people = useSalespersonOptions(),
    opportunities = useSalesOpportunityOptions(),
    mutations = useSalesMutations();
  const form = useForm<SalesQuotationFormValues>({
    resolver: zodResolver(salesQuotationSchema),
    defaultValues: {
      customerId: "",
      branchId: branchId ?? "",
      salespersonId: "",
      opportunityId: "",
      quotationDate: today(),
      expiryDate: future(30),
      terms: "Prices valid until the expiry date.",
      currency: "USD",
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
            currency: quotation.currency,
            notes: quotation.notes ?? "",
            items: quotation.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              taxPercent: item.taxPercent,
            })),
          }
        : {
            customerId: "",
            branchId: branchId ?? "",
            salespersonId: "",
            opportunityId: "",
            quotationDate: today(),
            expiryDate: future(30),
            terms: "Prices valid until the expiry date.",
            currency: "USD",
            notes: "",
            items: [blankLine()],
          },
    );
  }, [branchId, form, isOpen, quotation]);
  const submit = form.handleSubmit(async (values) => {
    try {
      if (quotation) await mutations.updateQuotation(quotation.id, values);
      else await mutations.createQuotation(values);
      appToast.success(
        quotation ? "Quotation updated." : "Quotation saved as draft.",
      );
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to save quotation."));
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
                    form.setValue("currency", customer.currency);
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
          <FormField label="Currency">
            <TextInput {...form.register("currency")} />
          </FormField>
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <SalesLineEditor value={field.value} onChange={field.onChange} />
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
    mutations = useSalesMutations();
  const form = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues: {
      customerId: "",
      branchId: branchId ?? "",
      salespersonId: "",
      warehouseId: "",
      orderDate: today(),
      expectedDeliveryDate: future(7),
      deliveryAddress: "",
      paymentTerms: "Net 30",
      currency: "USD",
      notes: "",
      items: [blankLine()],
    },
  });
  const selectedBranch = form.watch("branchId");
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
            paymentTerms: "Net 30",
            currency: "USD",
            notes: "",
            items: [blankLine()],
          },
    );
  }, [branchId, form, isOpen, order]);
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
          label="Save Draft"
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
                    form.setValue("currency", customer.currency);
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
          <FormField label="Warehouse" required>
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
            <TextInput {...form.register("paymentTerms")} />
          </FormField>
          <FormField label="Currency">
            <TextInput {...form.register("currency")} />
          </FormField>
        </div>
        <FormField label="Delivery address" required>
          <Textarea rows={2} {...form.register("deliveryAddress")} />
        </FormField>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <SalesLineEditor value={field.value} onChange={field.onChange} />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function DeliveryFormModal({ isOpen, onClose }: Props) {
  const orders = useSalesOrders({ branchId: "all", pageSize: 100 }),
    deliveries = useDeliveryNotes({ branchId: "all", pageSize: 100 }),
    products = useSalesProductOptions(),
    mutations = useSalesMutations();
  const form = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      salesOrderId: "",
      warehouseId: "",
      locationId: "",
      deliveryDate: today(),
      deliveryAddress: "",
      notes: "",
      items: [],
    },
  });
  const orderId = form.watch("salesOrderId"),
    warehouseId = form.watch("warehouseId");
  const locations = useStockLocationOptions(warehouseId),
    warehouses = useWarehouseOptions(undefined, true);
  useEffect(() => {
    const order = orders.data?.data.find((item) => item.id === orderId);
    if (!order) return;
    const previous = (deliveries.data?.data ?? []).filter(
      (item) => item.salesOrderId === order.id,
    );
    form.setValue("warehouseId", order.warehouseId);
    form.setValue("deliveryAddress", order.deliveryAddress);
    form.setValue(
      "items",
      order.items
        .filter(
          (line) =>
            products.data?.find((item) => item.id === line.productId)
              ?.trackInventory,
        )
        .map((line) => ({
          salesOrderLineId: line.id,
          productId: line.productId,
          variantId: line.variantId,
          deliveredQuantity: Math.max(
            0,
            line.quantity -
              previous
                .flatMap((item) => item.items)
                .filter((item) => item.salesOrderLineId === line.id)
                .reduce((sum, item) => sum + item.deliveredQuantity, 0),
          ),
          batchReference: "",
          serialReferences: [],
        })),
    );
  }, [deliveries.data?.data, form, orderId, orders.data?.data, products.data]);
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
                        onChange={(event) =>
                          field.onChange(
                            field.value.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    deliveredQuantity: Number(
                                      event.target.value,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
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
                      <FormField label="Serials (comma separated)">
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
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function SalesInvoiceFormModal({ isOpen, onClose }: Props) {
  const { branches, branchId } = useBranch();
  const customers = useSalesCustomerOptions(),
    people = useSalespersonOptions(),
    orders = useSalesOrders({ branchId: "all", pageSize: 100 }),
    deliveries = useDeliveryNotes({ branchId: "all", pageSize: 100 }),
    mutations = useSalesMutations();
  const form = useForm<SalesInvoiceFormValues>({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      customerId: "",
      branchId: branchId ?? "",
      salespersonId: "",
      salesOrderId: "",
      deliveryNoteId: "",
      invoiceDate: today(),
      dueDate: future(30),
      paymentTerms: "Net 30",
      currency: "USD",
      notes: "",
      items: [blankLine()],
    },
  });
  const orderId = form.watch("salesOrderId"),
    deliveryId = form.watch("deliveryNoteId");
  useEffect(() => {
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
          taxPercent: item.taxPercent,
        })),
      );
    }
  }, [form, orderId, orders.data?.data]);
  useEffect(() => {
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
            taxPercent: source?.taxPercent ?? 0,
          };
        }),
      );
  }, [deliveries.data?.data, deliveryId, form, orders.data?.data]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.createInvoice(values);
      appToast.success("Sales invoice saved as draft.");
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to create invoice."));
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Sales Invoice"
      maxWidth="1050px"
      footer={
        <Footer
          formId="sales-invoice-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Save Draft"
        />
      }
    >
      <form
        id="sales-invoice-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Sales order">
            <Select
              {...form.register("salesOrderId", {
                onChange: () => form.setValue("deliveryNoteId", ""),
              })}
              placeholder="Optional order"
              options={option(orders.data?.data ?? [])}
            />
          </FormField>
          <FormField label="Delivery note">
            <Select
              {...form.register("deliveryNoteId")}
              placeholder="Optional delivery"
              options={option(
                (deliveries.data?.data ?? []).filter(
                  (item) => !orderId || item.salesOrderId === orderId,
                ),
              )}
            />
          </FormField>
          <FormField label="Customer" required>
            <Select
              {...form.register("customerId")}
              options={option(customers.data ?? [])}
            />
          </FormField>
          <FormField label="Branch" required>
            <Select {...form.register("branchId")} options={option(branches)} />
          </FormField>
          <FormField label="Salesperson" required>
            <Select
              {...form.register("salespersonId")}
              options={option(people.data ?? [])}
            />
          </FormField>
          <FormField label="Invoice date">
            <DatePicker {...form.register("invoiceDate")} />
          </FormField>
          <FormField label="Due date">
            <DatePicker {...form.register("dueDate")} />
          </FormField>
          <FormField label="Payment terms">
            <TextInput {...form.register("paymentTerms")} />
          </FormField>
          <FormField label="Currency">
            <TextInput {...form.register("currency")} />
          </FormField>
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <SalesLineEditor value={field.value} onChange={field.onChange} />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function CustomerPaymentFormModal({ isOpen, onClose }: Props) {
  const invoices = useSalesInvoices({ branchId: "all", pageSize: 100 }),
    mutations = useSalesMutations();
  const form = useForm<CustomerPaymentFormValues>({
    resolver: zodResolver(customerPaymentSchema),
    defaultValues: {
      invoiceId: "",
      amount: 0,
      paymentMethod: "bank_transfer",
      paymentDate: today(),
      externalReference: "",
    },
  });
  const invoiceId = form.watch("invoiceId");
  useEffect(() => {
    const invoice = invoices.data?.data.find((item) => item.id === invoiceId);
    if (invoice) form.setValue("amount", invoice.outstandingAmount);
  }, [form, invoiceId, invoices.data?.data]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.receivePayment(values);
      appToast.success("Payment recorded and Accounting handoff prepared.");
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to receive payment."));
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Customer Payment"
      maxWidth="650px"
      footer={
        <Footer
          formId="customer-payment-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Receive Payment"
        />
      }
    >
      <form
        id="customer-payment-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <FormField label="Invoice" required>
          <Select
            {...form.register("invoiceId")}
            placeholder="Select invoice"
            options={option(
              (invoices.data?.data ?? []).filter(
                (item) => item.outstandingAmount > 0 && item.status !== "void",
              ),
            )}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Amount" required>
            <TextInput
              type="number"
              min="0.01"
              step="0.01"
              {...form.register("amount", { valueAsNumber: true })}
            />
          </FormField>
          <FormField label="Method">
            <Select
              {...form.register("paymentMethod")}
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank_transfer", label: "Bank transfer" },
                { value: "card", label: "Card" },
                { value: "cheque", label: "Cheque" },
                { value: "mobile_payment", label: "Mobile payment" },
              ]}
            />
          </FormField>
          <FormField label="Payment date">
            <DatePicker {...form.register("paymentDate")} />
          </FormField>
          <FormField label="External reference">
            <TextInput {...form.register("externalReference")} />
          </FormField>
        </div>
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
  const form = useForm<SalesReturnFormValues>({
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
  const form = useForm<RecurringInvoiceFormValues>({
    resolver: zodResolver(recurringInvoiceSchema),
    defaultValues: {
      customerId: "",
      branchId: branchId ?? "",
      salespersonId: "",
      frequency: "monthly",
      startDate: future(1),
      endDate: "",
      paymentTerms: "Net 30",
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
            <TextInput {...form.register("paymentTerms")} />
          </FormField>
          <FormField label="Currency">
            <TextInput {...form.register("currency")} />
          </FormField>
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <SalesLineEditor value={field.value} onChange={field.onChange} />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}
