import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useBranch } from "@/core/branch/branch-context";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { DatePicker } from "@/shared/components/forms/DatePicker";
import { FormField } from "@/shared/components/forms/FormField";
import { MultiSelect } from "@/shared/components/forms/MultiSelect";
import { Select } from "@/shared/components/forms/Select";
import { Textarea } from "@/shared/components/forms/Textarea";
import { TextInput } from "@/shared/components/forms/TextInput";
import { getErrorMessage } from "@/shared/utils/errors";
import { appToast } from "@/shared/utils/toast";
import { useStockLocationOptions } from "@/features/inventory/hooks/useStockLocationManagement";
import { useWarehouseOptions } from "@/features/inventory/hooks/useWarehouseManagement";
import {
  grnSchema,
  purchaseInvoiceSchema,
  purchaseOrderSchema,
  purchaseRequestSchema,
  purchaseReturnSchema,
  rfqSchema,
  supplierQuotationSchema,
  type GrnFormValues,
  type PurchaseInvoiceFormValues,
  type PurchaseOrderFormValues,
  type PurchaseRequestFormValues,
  type PurchaseReturnFormValues,
  type RfqFormValues,
  type SupplierQuotationFormValues,
} from "../schemas/purchasingSchemas";
import {
  useGoodsReceipts,
  usePurchaseOrders,
  usePurchaseRequests,
  usePurchasingMutations,
  usePurchasingProductOptions,
  usePurchasingSupplierOptions,
  useRfqs,
} from "../hooks/usePurchasing";
import type { PurchaseOrder, PurchaseRequest } from "../types/purchasing";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}
interface PurchaseRequestProps extends Props {
  request?: PurchaseRequest | null;
}
interface PurchaseOrderProps extends Props {
  order?: PurchaseOrder | null;
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
      row.referenceNumber ?? `${row.name}${row.code ? ` (${row.code})` : ""}`,
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
function PurchaseLineEditor({
  value,
  onChange,
  pricing = true,
}: {
  value: EditableLine[];
  onChange: (value: EditableLine[]) => void;
  pricing?: boolean;
}) {
  const products = usePurchasingProductOptions();
  const update = (index: number, patch: Partial<EditableLine>) =>
    onChange(
      value.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">
          Products and quantities
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
          <FormField label="Product" className="lg:col-span-2">
            <Select
              value={line.productId}
              onChange={(event) => {
                const product = products.data?.find(
                  (item) => item.id === event.target.value,
                );
                update(index, {
                  productId: event.target.value,
                  unitPrice: product?.costPrice ?? line.unitPrice,
                });
              }}
              placeholder="Select product"
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
          {pricing && (
            <>
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
                    update(index, {
                      discountPercent: Number(event.target.value),
                    })
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
            </>
          )}
          {value.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="danger"
              leftIcon={<Trash2 size={14} />}
              onClick={() =>
                onChange(value.filter((_, lineIndex) => lineIndex !== index))
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

export function PurchaseRequestFormModal({
  isOpen,
  onClose,
  request,
}: PurchaseRequestProps) {
  const { branches, branchId } = useBranch();
  const mutations = usePurchasingMutations();
  const form = useForm<PurchaseRequestFormValues>({
    resolver: zodResolver(purchaseRequestSchema),
    defaultValues: {
      branchId: branchId ?? "",
      requiredDate: future(14),
      reason: "",
      notes: "",
      items: [blankLine()],
    },
  });
  useEffect(() => {
    if (!isOpen) return;
    form.reset(
      request
        ? {
            branchId: request.branchId,
            requiredDate: request.requiredDate,
            reason: request.reason,
            notes: request.notes ?? "",
            items: request.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: 0,
              discountPercent: 0,
              taxPercent: 0,
            })),
          }
        : {
            branchId: branchId ?? "",
            requiredDate: future(14),
            reason: "",
            notes: "",
            items: [blankLine()],
          },
    );
  }, [branchId, form, isOpen, request]);
  const submit = form.handleSubmit(async (values) => {
    try {
      if (request) await mutations.updateRequest(request.id, values);
      else await mutations.createRequest(values);
      appToast.success(
        request
          ? "Purchase request updated."
          : "Purchase request saved as draft.",
      );
      form.reset();
      onClose();
    } catch (error) {
      appToast.error(
        getErrorMessage(
          error,
          request
            ? "Unable to update purchase request."
            : "Unable to create purchase request.",
        ),
      );
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        request ? `Edit ${request.referenceNumber}` : "New Purchase Request"
      }
      maxWidth="980px"
      footer={
        <Footer
          formId="purchase-request-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Save Draft"
        />
      }
    >
      <form
        id="purchase-request-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Branch"
            required
            error={form.formState.errors.branchId?.message}
          >
            <Select {...form.register("branchId")} options={option(branches)} />
          </FormField>
          <FormField
            label="Required date"
            required
            error={form.formState.errors.requiredDate?.message}
          >
            <DatePicker {...form.register("requiredDate")} />
          </FormField>
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <PurchaseLineEditor
              value={field.value}
              onChange={field.onChange}
              pricing={false}
            />
          )}
        />
        <FormField
          label="Reason"
          required
          error={form.formState.errors.reason?.message}
        >
          <Textarea rows={2} {...form.register("reason")} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function RfqFormModal({ isOpen, onClose }: Props) {
  const requests = usePurchaseRequests({
    status: "approved",
    branchId: "all",
    pageSize: 100,
  });
  const suppliers = usePurchasingSupplierOptions();
  const mutations = usePurchasingMutations();
  const form = useForm<RfqFormValues>({
    resolver: zodResolver(rfqSchema),
    defaultValues: {
      purchaseRequestId: "",
      supplierIds: [],
      requiredDeliveryDate: future(21),
      notes: "",
    },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.createRfq(values);
      appToast.success("RFQ sent to selected suppliers.");
      form.reset();
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to create RFQ."));
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create RFQ from Approved Request"
      maxWidth="720px"
      footer={
        <Footer
          formId="rfq-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Create & Send RFQ"
        />
      }
    >
      <form id="rfq-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormField
          label="Approved purchase request"
          required
          error={form.formState.errors.purchaseRequestId?.message}
        >
          <Select
            {...form.register("purchaseRequestId")}
            placeholder="Select request"
            options={option(requests.data?.data ?? [])}
          />
        </FormField>
        <Controller
          control={form.control}
          name="supplierIds"
          render={({ field }) => (
            <FormField
              label="Suppliers"
              required
              error={form.formState.errors.supplierIds?.message}
            >
              <MultiSelect
                value={field.value}
                onChange={(values) => field.onChange(values.map(String))}
                options={(suppliers.data ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.name} · score ${item.score}`,
                }))}
              />
            </FormField>
          )}
        />
        <FormField label="Required delivery date">
          <DatePicker {...form.register("requiredDeliveryDate")} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={3} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function SupplierQuotationFormModal({ isOpen, onClose }: Props) {
  const rfqs = useRfqs({ branchId: "all", pageSize: 100 });
  const suppliers = usePurchasingSupplierOptions();
  const mutations = usePurchasingMutations();
  const form = useForm<SupplierQuotationFormValues>({
    resolver: zodResolver(supplierQuotationSchema),
    defaultValues: {
      rfqId: "",
      supplierId: "",
      quotationNumber: "",
      quotationDate: today(),
      validityDate: future(30),
      deliveryDays: 7,
      paymentTerms: "Net 30",
      currency: "USD",
      notes: "",
      items: [blankLine()],
    },
  });
  const rfqId = form.watch("rfqId");
  useEffect(() => {
    const rfq = rfqs.data?.data.find((item) => item.id === rfqId);
    if (rfq)
      form.setValue(
        "items",
        rfq.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: 0,
          discountPercent: 0,
          taxPercent: 0,
        })),
      );
  }, [form, rfqId, rfqs.data?.data]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.createQuotation(values);
      appToast.success("Supplier quotation captured.");
      form.reset();
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to capture quotation."));
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Capture Supplier Quotation"
      maxWidth="980px"
      footer={
        <Footer
          formId="quotation-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
        />
      }
    >
      <form
        id="quotation-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="RFQ">
            <Select
              {...form.register("rfqId")}
              placeholder="Select RFQ"
              options={option(
                (rfqs.data?.data ?? []).filter(
                  (item) => item.status !== "cancelled",
                ),
              )}
            />
          </FormField>
          <FormField label="Supplier">
            <Select
              {...form.register("supplierId")}
              placeholder="Select supplier"
              options={(suppliers.data ?? [])
                .filter(
                  (item) =>
                    rfqs.data?.data
                      .find((rfq) => rfq.id === rfqId)
                      ?.supplierIds.includes(item.id) ?? true,
                )
                .map((item) => ({ value: item.id, label: item.name }))}
            />
          </FormField>
          <FormField label="Supplier quote #">
            <TextInput {...form.register("quotationNumber")} />
          </FormField>
          <FormField label="Quote date">
            <DatePicker {...form.register("quotationDate")} />
          </FormField>
          <FormField label="Valid until">
            <DatePicker {...form.register("validityDate")} />
          </FormField>
          <FormField label="Delivery days">
            <TextInput
              type="number"
              min="1"
              {...form.register("deliveryDays", { valueAsNumber: true })}
            />
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
            <PurchaseLineEditor value={field.value} onChange={field.onChange} />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function PurchaseOrderFormModal({
  isOpen,
  onClose,
  order,
}: PurchaseOrderProps) {
  const { branches, branchId } = useBranch();
  const suppliers = usePurchasingSupplierOptions();
  const mutations = usePurchasingMutations();
  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: "",
      branchId: branchId ?? "",
      warehouseId: "",
      orderDate: today(),
      expectedDeliveryDate: future(14),
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
            supplierId: order.supplierId,
            branchId: order.branchId,
            warehouseId: order.warehouseId,
            orderDate: order.orderDate,
            expectedDeliveryDate: order.expectedDeliveryDate,
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
            supplierId: "",
            branchId: branchId ?? "",
            warehouseId: "",
            orderDate: today(),
            expectedDeliveryDate: future(14),
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
        order
          ? "Purchase order updated."
          : "Direct purchase order saved as draft.",
      );
      form.reset();
      onClose();
    } catch (error) {
      appToast.error(
        getErrorMessage(
          error,
          order
            ? "Unable to update purchase order."
            : "Unable to create purchase order.",
        ),
      );
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        order ? `Edit ${order.referenceNumber}` : "New Direct Purchase Order"
      }
      maxWidth="1000px"
      footer={
        <Footer
          formId="purchase-order-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Save Draft"
        />
      }
    >
      <form
        id="purchase-order-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField
            label="Supplier"
            required
            error={form.formState.errors.supplierId?.message}
          >
            <Select
              {...form.register("supplierId")}
              placeholder="Select supplier"
              options={(suppliers.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </FormField>
          <FormField
            label="Branch"
            required
            error={form.formState.errors.branchId?.message}
          >
            <Select
              {...form.register("branchId", {
                onChange: () => form.setValue("warehouseId", ""),
              })}
              options={option(branches)}
            />
          </FormField>
          <FormField
            label="Warehouse"
            required
            error={form.formState.errors.warehouseId?.message}
          >
            <Select
              {...form.register("warehouseId")}
              placeholder="Select warehouse"
              options={option(warehouses.data ?? [])}
            />
          </FormField>
          <FormField
            label="Order date"
            error={form.formState.errors.orderDate?.message}
          >
            <DatePicker {...form.register("orderDate")} />
          </FormField>
          <FormField
            label="Expected delivery"
            error={form.formState.errors.expectedDeliveryDate?.message}
          >
            <DatePicker {...form.register("expectedDeliveryDate")} />
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
            <PurchaseLineEditor value={field.value} onChange={field.onChange} />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function GrnFormModal({ isOpen, onClose }: Props) {
  const orders = usePurchaseOrders({ branchId: "all", pageSize: 100 });
  const mutations = usePurchasingMutations();
  const form = useForm<GrnFormValues>({
    resolver: zodResolver(grnSchema),
    defaultValues: {
      purchaseOrderId: "",
      warehouseId: "",
      locationId: "",
      receivedDate: today(),
      notes: "",
      items: [],
    },
  });
  const poId = form.watch("purchaseOrderId");
  const warehouseId = form.watch("warehouseId");
  const locations = useStockLocationOptions(warehouseId);
  const allWarehouses = useWarehouseOptions(undefined, true);
  const products = usePurchasingProductOptions();
  useEffect(() => {
    const po = orders.data?.data.find((item) => item.id === poId);
    if (po) {
      form.setValue("warehouseId", po.warehouseId);
      form.setValue(
        "items",
        po.items.map((item) => ({
          purchaseOrderLineId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          receivedQuantity: 0,
          damagedQuantity: 0,
          rejectedQuantity: 0,
          batchNumber: "",
          serialNumbers: [],
          manufacturedDate: "",
          expiryDate: "",
        })),
      );
    }
  }, [form, orders.data?.data, poId]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.completeGrn(values);
      appToast.success("GRN completed and accepted stock posted to Inventory.");
      form.reset();
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to complete GRN."));
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Goods Against PO"
      maxWidth="1050px"
      footer={
        <Footer
          formId="grn-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Complete GRN"
        />
      }
    >
      <form id="grn-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Purchase order">
            <Select
              {...form.register("purchaseOrderId")}
              placeholder="Select approved/open PO"
              options={option(
                (orders.data?.data ?? []).filter((item) =>
                  ["approved", "sent", "partially_received"].includes(
                    item.status,
                  ),
                ),
              )}
            />
          </FormField>
          <FormField label="Warehouse">
            <Select
              {...form.register("warehouseId")}
              disabled
              options={option(allWarehouses.data ?? [])}
            />
          </FormField>
          <FormField label="Stock location">
            <Select
              {...form.register("locationId")}
              placeholder="Select receiving location"
              options={option(locations.data ?? [])}
            />
          </FormField>
          <FormField label="Received date">
            <DatePicker {...form.register("receivedDate")} />
          </FormField>
        </div>
        <div className="space-y-3">
          {form.watch("items").map((item, index) => {
            const product = products.data?.find(
              (entry) => entry.id === item.productId,
            );
            return (
              <div
                key={item.purchaseOrderLineId}
                className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-5"
              >
                <div className="lg:col-span-2">
                  <div className="text-sm font-semibold text-slate-800">
                    {product?.name ?? item.productId}
                  </div>
                  <div className="text-xs text-slate-500">{product?.sku}</div>
                </div>
                <FormField label="Accepted">
                  <TextInput
                    type="number"
                    min="0"
                    {...form.register(`items.${index}.receivedQuantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </FormField>
                <FormField label="Damaged">
                  <TextInput
                    type="number"
                    min="0"
                    {...form.register(`items.${index}.damagedQuantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </FormField>
                <FormField label="Rejected">
                  <TextInput
                    type="number"
                    min="0"
                    {...form.register(`items.${index}.rejectedQuantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </FormField>
                {product?.trackByBatch && (
                  <FormField label="Batch number">
                    <TextInput
                      {...form.register(`items.${index}.batchNumber`)}
                    />
                  </FormField>
                )}
                {product?.trackBySerialNumber && (
                  <Controller
                    control={form.control}
                    name={`items.${index}.serialNumbers`}
                    render={({ field }) => (
                      <FormField
                        label="Serial numbers"
                        hint="Comma-separated; one per accepted unit."
                      >
                        <TextInput
                          value={field.value.join(", ")}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value
                                .split(",")
                                .map((value) => value.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </FormField>
                    )}
                  />
                )}
                {product?.trackExpiry && (
                  <FormField label="Expiry date">
                    <DatePicker
                      {...form.register(`items.${index}.expiryDate`)}
                    />
                  </FormField>
                )}
              </div>
            );
          })}
        </div>
        <FormField label="Receiving notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function PurchaseInvoiceFormModal({ isOpen, onClose }: Props) {
  const orders = usePurchaseOrders({ branchId: "all", pageSize: 100 });
  const receipts = useGoodsReceipts({ branchId: "all", pageSize: 100 });
  const mutations = usePurchasingMutations();
  const form = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      purchaseOrderId: "",
      grnId: "",
      supplierInvoiceNumber: "",
      invoiceDate: today(),
      dueDate: future(30),
      paymentTerms: "Net 30",
      notes: "",
      items: [blankLine()],
    },
  });
  const poId = form.watch("purchaseOrderId");
  useEffect(() => {
    const po = orders.data?.data.find((item) => item.id === poId);
    if (po) {
      form.setValue("paymentTerms", po.paymentTerms);
      form.setValue(
        "items",
        po.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxPercent: item.taxPercent,
        })),
      );
    }
  }, [form, orders.data?.data, poId]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.createInvoice(values);
      appToast.success("Supplier invoice captured for matching and approval.");
      form.reset();
      onClose();
    } catch (error) {
      appToast.error(
        getErrorMessage(error, "Unable to capture supplier invoice."),
      );
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Supplier Purchase Invoice"
      maxWidth="980px"
      footer={
        <Footer
          formId="invoice-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
        />
      }
    >
      <form
        id="invoice-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Purchase order">
            <Select
              {...form.register("purchaseOrderId")}
              placeholder="Select PO"
              options={option(orders.data?.data ?? [])}
            />
          </FormField>
          <FormField label="GRN reference">
            <Select
              {...form.register("grnId")}
              placeholder="Optional GRN"
              options={option(
                (receipts.data?.data ?? []).filter(
                  (item) => item.purchaseOrderId === poId,
                ),
              )}
            />
          </FormField>
          <FormField label="Supplier invoice #">
            <TextInput {...form.register("supplierInvoiceNumber")} />
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
        </div>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <PurchaseLineEditor value={field.value} onChange={field.onChange} />
          )}
        />
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function PurchaseReturnFormModal({ isOpen, onClose }: Props) {
  const receipts = useGoodsReceipts({ branchId: "all", pageSize: 100 });
  const mutations = usePurchasingMutations();
  const form = useForm<PurchaseReturnFormValues>({
    resolver: zodResolver(purchaseReturnSchema),
    defaultValues: {
      purchaseOrderId: "",
      grnId: "",
      warehouseId: "",
      locationId: "",
      reason: "",
      notes: "",
      items: [],
    },
  });
  const grnId = form.watch("grnId");
  const products = usePurchasingProductOptions();
  useEffect(() => {
    const grn = receipts.data?.data.find((item) => item.id === grnId);
    if (grn) {
      form.setValue("purchaseOrderId", grn.purchaseOrderId);
      form.setValue("warehouseId", grn.warehouseId);
      form.setValue("locationId", grn.locationId);
      form.setValue(
        "items",
        grn.items
          .filter((item) => item.acceptedQuantity > 0)
          .map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: 1,
            batchReference: item.batchNumber,
            serialReferences: item.serialNumbers ?? [],
          })),
      );
    }
  }, [form, grnId, receipts.data?.data]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.completeReturn(values);
      appToast.success("Purchase return completed and stock deducted.");
      form.reset();
      onClose();
    } catch (error) {
      appToast.error(
        getErrorMessage(error, "Unable to complete purchase return."),
      );
    }
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Purchase Return"
      maxWidth="900px"
      footer={
        <Footer
          formId="return-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          label="Complete Return"
        />
      }
    >
      <form id="return-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormField label="Source GRN">
          <Select
            {...form.register("grnId")}
            placeholder="Select completed GRN"
            options={option(receipts.data?.data ?? [])}
          />
        </FormField>
        <div className="space-y-3">
          {form.watch("items").map((item, index) => (
            <div
              key={`${item.productId}-${index}`}
              className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="font-semibold text-slate-800">
                {products.data?.find((product) => product.id === item.productId)
                  ?.name ?? item.productId}
              </div>
              <FormField label="Return quantity">
                <TextInput
                  type="number"
                  min="0.01"
                  {...form.register(`items.${index}.quantity`, {
                    valueAsNumber: true,
                  })}
                />
              </FormField>
              <FormField label="Batch">
                <TextInput
                  {...form.register(`items.${index}.batchReference`)}
                />
              </FormField>
              <Controller
                control={form.control}
                name={`items.${index}.serialReferences`}
                render={({ field }) => (
                  <FormField label="Serials" hint="Comma-separated">
                    <TextInput
                      value={field.value.join(", ")}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                  </FormField>
                )}
              />
            </div>
          ))}
        </div>
        <FormField label="Reason">
          <Textarea rows={2} {...form.register("reason")} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}
