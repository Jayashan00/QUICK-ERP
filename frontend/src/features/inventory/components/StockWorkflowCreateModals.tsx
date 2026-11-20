import { useEffect } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useAppForm } from "@/shared/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { useQuery } from "@tanstack/react-query";
import { branchService } from "@/core/branch/branchService";
import { branchKeys } from "@/core/branch/branchKeys";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { FormField } from "@/shared/components/forms/FormField";
import { MultiSelect } from "@/shared/components/forms/MultiSelect";
import { Select } from "@/shared/components/forms/Select";
import { Textarea } from "@/shared/components/forms/Textarea";
import { TextInput } from "@/shared/components/forms/TextInput";
import { getErrorMessage } from "@/shared/utils/errors";
import { appToast } from "@/shared/utils/toast";
import { useInventoryBatches, useInventoryProductOptions, useInventorySerialNumbers } from "../hooks/useInventoryTracking";
import { useStockBalances } from "../hooks/useInventory";
import { useStockLocationOptions, useDestinationStockLocationOptions } from "../hooks/useStockLocationManagement";
import { useStockWorkflowMutations } from "../hooks/useStockWorkflows";
import { useWarehouseOptions, useDestinationWarehouseOptions } from "../hooks/useWarehouseManagement";
import {
  branchStockRequestSchema,
  stockAdjustmentSchema,
  stockCountSchema,
  stockReturnWastageSchema,
  stockTransferSchema,
  type BranchStockRequestFormValues,
  type StockAdjustmentFormValues,
  type StockCountFormValues,
  type StockReturnWastageFormValues,
  type StockTransferFormValues,
} from "../schemas/inventorySchemas";

interface ModalProps { isOpen: boolean; onClose: () => void }
const lineDefaults = { productId: "", variantId: "", quantity: 1, batchReference: "", serialReferences: [] as string[] };

function options(rows: Array<{ id: string; name: string; code?: string; sku?: string }>) {
  return rows.map((row) => ({ value: row.id, label: `${row.name}${row.code ? ` (${row.code})` : row.sku ? ` (${row.sku})` : ""}` }));
}

function TrackingFields(props: {
  branchId: string;
  warehouseId: string;
  locationId: string;
  productId: string;
  batchReference?: string;
  serialReferences: string[];
  onBatchChange: (value: string) => void;
  onSerialChange: (value: string[]) => void;
}) {
  const { branches } = useBranch();
  const products = useInventoryProductOptions("all");
  const product = products.data?.find((item) => item.id === props.productId);
  const scopeParams = { branchId: props.branchId || "__none__", warehouseId: props.warehouseId || "__none__", locationId: props.locationId || "__none__", productId: props.productId || "__none__", permittedBranchIds: branches.map((branch) => branch.id), pageSize: 100 };
  const batches = useInventoryBatches({ ...scopeParams, status: "available" });
  const serials = useInventorySerialNumbers({ ...scopeParams, status: "all" });
  if (!product?.trackByBatch && !product?.trackBySerialNumber) return null;
  return (
    <>
      {product.trackByBatch && (
        <FormField label="Batch" hint="Required for this batch-tracked product.">
          <Select value={props.batchReference ?? ""} onChange={(event) => props.onBatchChange(event.target.value)} placeholder="Select batch" options={(batches.data?.data ?? []).map((item) => ({ value: item.batchNumber, label: `${item.batchNumber} · ${item.remainingQuantity} available` }))} />
        </FormField>
      )}
      {product.trackBySerialNumber && (
        <FormField label="Serial numbers" hint="Select exactly one serial per unit.">
          <MultiSelect value={props.serialReferences} onChange={(values) => props.onSerialChange(values.map(String))} placeholder="Select serial numbers" options={(serials.data?.data ?? []).filter((item) => item.status === "available" || item.status === "returned" || item.status === "sold_issued").map((item) => ({ value: item.serialNumber, label: `${item.serialNumber} · ${item.status.replace(/_/g, " ")}` }))} />
        </FormField>
      )}
    </>
  );
}

function FormActions({ formId, busy, onClose, submitLabel = "Submit for approval" }: { formId: string; busy: boolean; onClose: () => void; submitLabel?: string }) {
  return <><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form={formId} isLoading={busy}>{submitLabel}</Button></>;
}

export function StockAdjustmentCreateModal({ isOpen, onClose }: ModalProps) {
  const { branches, branchId } = useBranch();
  const mutations = useStockWorkflowMutations();
  const form = useAppForm<StockAdjustmentFormValues>({ resolver: zodResolver(stockAdjustmentSchema), defaultValues: { branchId: branchId ?? "", warehouseId: "", locationId: "", direction: "increase", reason: "", notes: "", lines: [{ ...lineDefaults }] } });
  const selectedBranch = form.watch("branchId"); const warehouseId = form.watch("warehouseId"); const locationId = form.watch("locationId"); const productId = form.watch("lines.0.productId");
  const warehouses = useWarehouseOptions(selectedBranch); const locations = useStockLocationOptions(warehouseId); const products = useInventoryProductOptions("all");
  const submit = form.handleSubmit(async (values) => { try { await mutations.createAdjustment(values); appToast.success("Stock adjustment submitted for approval."); form.reset(); onClose(); } catch (error) { appToast.error(getErrorMessage(error, "Unable to create stock adjustment.")); } });
  return <Modal isOpen={isOpen} onClose={onClose} title="New Stock Adjustment" maxWidth="820px" footer={<FormActions formId="adjustment-form" busy={form.formState.isSubmitting} onClose={onClose} />}><form id="adjustment-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
    <FormField label="Branch" error={form.formState.errors.branchId?.message}><Select {...form.register("branchId", { onChange: () => { form.setValue("warehouseId", ""); form.setValue("locationId", ""); } })} options={options(branches)} error={Boolean(form.formState.errors.branchId)} /></FormField>
    <FormField label="Direction"><Select {...form.register("direction")} options={[{ value: "increase", label: "Increase" }, { value: "decrease", label: "Decrease" }]} /></FormField>
    <FormField label="Warehouse" error={form.formState.errors.warehouseId?.message}><Select {...form.register("warehouseId", { onChange: () => form.setValue("locationId", "") })} placeholder="Select warehouse" options={options(warehouses.data ?? [])} /></FormField>
    <FormField label="Location" error={form.formState.errors.locationId?.message}><Select {...form.register("locationId")} placeholder="Select location" options={options(locations.data ?? [])} /></FormField>
    <FormField label="Product" error={form.formState.errors.lines?.[0]?.productId?.message}><Select {...form.register("lines.0.productId", { onChange: () => { form.setValue("lines.0.batchReference", ""); form.setValue("lines.0.serialReferences", []); } })} placeholder="Select product" options={options(products.data ?? [])} /></FormField>
    <FormField label="Quantity" error={form.formState.errors.lines?.[0]?.quantity?.message}><TextInput type="number" min="0.01" step="0.01" {...form.register("lines.0.quantity", { valueAsNumber: true })} /></FormField>
    <Controller control={form.control} name="lines.0.batchReference" render={({ field: batch }) => <Controller control={form.control} name="lines.0.serialReferences" render={({ field: serials }) => <TrackingFields branchId={selectedBranch} warehouseId={warehouseId} locationId={locationId} productId={productId} batchReference={batch.value} serialReferences={serials.value} onBatchChange={batch.onChange} onSerialChange={serials.onChange} />} />} />
    <FormField label="Reason" error={form.formState.errors.reason?.message} className="sm:col-span-2"><Textarea rows={2} {...form.register("reason")} /></FormField>
    <FormField label="Notes" className="sm:col-span-2"><Textarea rows={2} {...form.register("notes")} /></FormField>
  </form></Modal>;
}

export function StockTransferCreateModal({ isOpen, onClose }: ModalProps) {
  const { tenantId } = useTenant();
  const { branches, branchId } = useBranch();
  const mutations = useStockWorkflowMutations();

  const form = useAppForm<StockTransferFormValues>({
    resolver: zodResolver(stockTransferSchema),
    defaultValues: {
      sourceBranchId: branchId ?? "",
      sourceWarehouseId: "",
      sourceLocationId: "",
      destinationBranchId: "",
      destinationWarehouseId: "",
      destinationLocationId: "",
      notes: "",
      lines: [{ ...lineDefaults }],
    },
  });

  const lineFields = useFieldArray({ control: form.control, name: "lines" });

  const sourceBranch = form.watch("sourceBranchId");
  const sourceWarehouse = form.watch("sourceWarehouseId");
  const sourceLocation = form.watch("sourceLocationId");
  const destinationBranch = form.watch("destinationBranchId");
  const destinationWarehouse = form.watch("destinationWarehouseId");
  const destinationLocation = form.watch("destinationLocationId");
  const watchedLines = form.watch("lines");

  useEffect(() => {
    if (isOpen) {
      form.reset({
        sourceBranchId: branchId ?? "",
        sourceWarehouseId: "",
        sourceLocationId: "",
        destinationBranchId: "",
        destinationWarehouseId: "",
        destinationLocationId: "",
        notes: "",
        lines: [{ ...lineDefaults }],
      });
    }
  }, [isOpen, branchId, form]);

  // Destination branch options: query all active branches belonging to current tenant
  const allBranchesQuery = useQuery({
    queryKey: [...branchKeys.options(tenantId ?? ""), "all-active-tenant-branches"],
    queryFn: async () => {
      if (!tenantId) return [];
      const all = await branchService.getAllBranches(tenantId);
      return all.filter((b) => b.isActive && b.tenantId === tenantId);
    },
    enabled: Boolean(tenantId && isOpen),
  });

  // Source options: restricted to user's assigned branches
  const sourceWarehouses = useWarehouseOptions(sourceBranch);
  const sourceLocations = useStockLocationOptions(sourceWarehouse);

  // Destination options: all active warehouses & locations belonging to destination branch/warehouse in current tenant
  const destinationWarehouses = useDestinationWarehouseOptions(destinationBranch);
  const destinationLocations = useDestinationStockLocationOptions(destinationWarehouse);

  const products = useInventoryProductOptions("all");

  // Prevent users from selecting identical source and destination values in dropdowns
  const sourceBranchOptions = branches.filter((b) => b.isActive && b.id !== destinationBranch);
  const sourceWarehouseOptions = (sourceWarehouses.data ?? []).filter((w) => w.id !== destinationWarehouse);
  const sourceLocationOptions = (sourceLocations.data ?? []).filter((l) => l.id !== destinationLocation);

  const destBranchOptions = (allBranchesQuery.data ?? []).filter((b) => b.id !== sourceBranch);
  const destWarehouseOptions = (destinationWarehouses.data ?? []).filter((w) => w.id !== sourceWarehouse);
  const destLocationOptions = (destinationLocations.data ?? []).filter((l) => l.id !== sourceLocation);

  const sourceWarehousePlaceholder = !sourceBranch
    ? "Select source branch first"
    : sourceWarehouses.isLoading
    ? "Loading warehouses..."
    : sourceWarehouseOptions.length === 0
    ? "No warehouses available"
    : "Select source warehouse";

  const sourceLocationPlaceholder = !sourceWarehouse
    ? "Select source warehouse first"
    : sourceLocations.isLoading
    ? "Loading locations..."
    : sourceLocationOptions.length === 0
    ? "No locations available"
    : "Select source location";

  const destBranchPlaceholder = allBranchesQuery.isLoading
    ? "Loading branches..."
    : "Select destination branch";

  const destWarehousePlaceholder = !destinationBranch
    ? "Select destination branch first"
    : destinationWarehouses.isLoading
    ? "Loading warehouses..."
    : destWarehouseOptions.length === 0
    ? "No warehouses in this branch"
    : "Select destination warehouse";

  const destLocationPlaceholder = !destinationWarehouse
    ? "Select destination warehouse first"
    : destinationLocations.isLoading
    ? "Loading locations..."
    : destLocationOptions.length === 0
    ? "No locations in this warehouse"
    : "Select destination location";

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutations.createTransfer(values);
      appToast.success("Stock transfer saved as draft.");
      form.reset();
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to create stock transfer."));
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Stock Transfer"
      maxWidth="920px"
      footer={
        <FormActions
          formId="transfer-form"
          busy={form.formState.isSubmitting}
          onClose={onClose}
          submitLabel="Save Draft"
        />
      }
    >
      <form id="transfer-form" onSubmit={submit} className="space-y-4" noValidate>
        {/* SOURCE SECTION */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                1
              </span>
              <h3 className="text-sm font-semibold text-slate-800">Source (Origin)</h3>
            </div>
            <span className="text-xs text-slate-500">Authorized source branch, warehouse & location</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Source Branch" required error={form.formState.errors.sourceBranchId?.message}>
              <Select
                {...form.register("sourceBranchId", {
                  onChange: (e) => {
                    const next = e.target.value;
                    form.setValue("sourceWarehouseId", "");
                    form.setValue("sourceLocationId", "");
                    if (next && next === destinationBranch) {
                      form.setValue("destinationBranchId", "");
                      form.setValue("destinationWarehouseId", "");
                      form.setValue("destinationLocationId", "");
                    }
                  },
                })}
                placeholder="Select source branch"
                options={options(sourceBranchOptions)}
                error={Boolean(form.formState.errors.sourceBranchId)}
              />
            </FormField>

            <FormField label="Source Warehouse" required error={form.formState.errors.sourceWarehouseId?.message}>
              <Select
                {...form.register("sourceWarehouseId", {
                  onChange: (e) => {
                    const next = e.target.value;
                    form.setValue("sourceLocationId", "");
                    if (next && next === destinationWarehouse) {
                      form.setValue("destinationWarehouseId", "");
                      form.setValue("destinationLocationId", "");
                    }
                  },
                })}
                placeholder={sourceWarehousePlaceholder}
                disabled={!sourceBranch || sourceWarehouses.isLoading || sourceWarehouseOptions.length === 0}
                options={options(sourceWarehouseOptions)}
                error={Boolean(form.formState.errors.sourceWarehouseId)}
              />
            </FormField>

            <FormField label="Source Location" required error={form.formState.errors.sourceLocationId?.message}>
              <Select
                {...form.register("sourceLocationId", {
                  onChange: (e) => {
                    const next = e.target.value;
                    if (next && next === destinationLocation) {
                      form.setValue("destinationLocationId", "");
                    }
                  },
                })}
                placeholder={sourceLocationPlaceholder}
                disabled={!sourceWarehouse || sourceLocations.isLoading || sourceLocationOptions.length === 0}
                options={options(sourceLocationOptions)}
                error={Boolean(form.formState.errors.sourceLocationId)}
              />
            </FormField>
          </div>
        </div>

        {/* DESTINATION SECTION */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                2
              </span>
              <h3 className="text-sm font-semibold text-slate-800">Destination</h3>
            </div>
            <span className="text-xs text-slate-500">Any active branch, warehouse & location in tenant</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Destination Branch" required error={form.formState.errors.destinationBranchId?.message}>
              <Select
                {...form.register("destinationBranchId", {
                  onChange: (e) => {
                    const next = e.target.value;
                    form.setValue("destinationWarehouseId", "");
                    form.setValue("destinationLocationId", "");
                    if (next && next === sourceBranch) {
                      form.setValue("sourceBranchId", "");
                      form.setValue("sourceWarehouseId", "");
                      form.setValue("sourceLocationId", "");
                    }
                  },
                })}
                placeholder={destBranchPlaceholder}
                disabled={allBranchesQuery.isLoading}
                options={options(destBranchOptions)}
                error={Boolean(form.formState.errors.destinationBranchId)}
              />
            </FormField>

            <FormField label="Destination Warehouse" required error={form.formState.errors.destinationWarehouseId?.message}>
              <Select
                {...form.register("destinationWarehouseId", {
                  onChange: (e) => {
                    const next = e.target.value;
                    form.setValue("destinationLocationId", "");
                    if (next && next === sourceWarehouse) {
                      form.setValue("sourceWarehouseId", "");
                      form.setValue("sourceLocationId", "");
                    }
                  },
                })}
                placeholder={destWarehousePlaceholder}
                disabled={!destinationBranch || destinationWarehouses.isLoading || destWarehouseOptions.length === 0}
                options={options(destWarehouseOptions)}
                error={Boolean(form.formState.errors.destinationWarehouseId)}
              />
            </FormField>

            <FormField label="Destination Location" required error={form.formState.errors.destinationLocationId?.message}>
              <Select
                {...form.register("destinationLocationId", {
                  onChange: (e) => {
                    const next = e.target.value;
                    if (next && next === sourceLocation) {
                      form.setValue("sourceLocationId", "");
                    }
                  },
                })}
                placeholder={destLocationPlaceholder}
                disabled={!destinationWarehouse || destinationLocations.isLoading || destLocationOptions.length === 0}
                options={options(destLocationOptions)}
                error={Boolean(form.formState.errors.destinationLocationId)}
              />
            </FormField>
          </div>
        </div>

        {/* PRODUCTS AND QUANTITIES */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Products and quantities</h3>
            <Button type="button" size="sm" variant="secondary" onClick={() => lineFields.append({ ...lineDefaults })}>
              Add Product
            </Button>
          </div>
          {lineFields.fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-lg bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Product" error={form.formState.errors.lines?.[index]?.productId?.message}>
                <Select {...form.register(`lines.${index}.productId`)} placeholder="Select product" options={options(products.data ?? [])} />
              </FormField>
              <FormField label="Quantity" error={form.formState.errors.lines?.[index]?.quantity?.message}>
                <TextInput type="number" min="0.01" step="0.01" {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })} />
              </FormField>
              <Controller
                control={form.control}
                name={`lines.${index}.batchReference`}
                render={({ field: batch }) => (
                  <Controller
                    control={form.control}
                    name={`lines.${index}.serialReferences`}
                    render={({ field: serials }) => (
                      <TrackingFields
                        branchId={sourceBranch}
                        warehouseId={sourceWarehouse}
                        locationId={sourceLocation}
                        productId={watchedLines[index]?.productId ?? ""}
                        batchReference={batch.value}
                        serialReferences={serials.value}
                        onBatchChange={batch.onChange}
                        onSerialChange={serials.onChange}
                      />
                    )}
                  />
                )}
              />
              {lineFields.fields.length > 1 && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Button type="button" size="sm" variant="danger" onClick={() => lineFields.remove(index)}>
                    Remove Product
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* NOTES */}
        <FormField label="Notes">
          <Textarea rows={2} {...form.register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}

export function BranchStockRequestCreateModal({ isOpen, onClose }: ModalProps) {
  const { branches, branchId } = useBranch(); const mutations = useStockWorkflowMutations();
  const form = useAppForm<BranchStockRequestFormValues>({ resolver: zodResolver(branchStockRequestSchema), defaultValues: { requestingBranchId: branchId ?? "", requestedFromBranchId: "", destinationWarehouseId: "", destinationLocationId: "", reason: "", notes: "", lines: [{ ...lineDefaults }] } });
  const lineFields = useFieldArray({ control: form.control, name: "lines" });
  const requestingBranch = form.watch("requestingBranchId"), warehouseId = form.watch("destinationWarehouseId"); const warehouses = useWarehouseOptions(requestingBranch), locations = useStockLocationOptions(warehouseId), products = useInventoryProductOptions("all");
  const submit = form.handleSubmit(async (values) => { try { await mutations.createRequest(values); appToast.success("Branch stock request submitted for review."); form.reset(); onClose(); } catch (error) { appToast.error(getErrorMessage(error, "Unable to create stock request.")); } });
  return <Modal isOpen={isOpen} onClose={onClose} title="New Branch Stock Request" maxWidth="820px" footer={<FormActions formId="request-form" busy={form.formState.isSubmitting} onClose={onClose} />}><form id="request-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
    <FormField label="Requesting branch"><Select {...form.register("requestingBranchId")} options={options(branches)} /></FormField><FormField label="Request stock from"><Select {...form.register("requestedFromBranchId")} placeholder="Select source branch" options={options(branches)} /></FormField><FormField label="Destination warehouse"><Select {...form.register("destinationWarehouseId")} placeholder="Select warehouse" options={options(warehouses.data ?? [])} /></FormField><FormField label="Destination location"><Select {...form.register("destinationLocationId")} placeholder="Select location" options={options(locations.data ?? [])} /></FormField><div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-800">Requested products</h3><Button type="button" size="sm" variant="secondary" onClick={() => lineFields.append({ ...lineDefaults })}>Add Product</Button></div>{lineFields.fields.map((field, index) => <div key={field.id} className="grid gap-3 rounded-lg bg-white p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"><FormField label="Product"><Select {...form.register(`lines.${index}.productId`)} placeholder="Select product" options={options(products.data ?? [])} /></FormField><FormField label="Quantity"><TextInput type="number" min="0.01" step="0.01" {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })} /></FormField>{lineFields.fields.length > 1 && <Button type="button" size="sm" variant="danger" className="self-end" onClick={() => lineFields.remove(index)}>Remove</Button>}</div>)}</div><FormField label="Reason" className="sm:col-span-2"><Textarea rows={2} {...form.register("reason")} /></FormField><FormField label="Notes" className="sm:col-span-2"><Textarea rows={2} {...form.register("notes")} /></FormField>
  </form></Modal>;
}

export function StockCountCreateModal({ isOpen, onClose }: ModalProps) {
  const { branches, branchId } = useBranch(); const mutations = useStockWorkflowMutations();
  const form = useAppForm<StockCountFormValues>({ resolver: zodResolver(stockCountSchema), defaultValues: { branchId: branchId ?? "", warehouseId: "", locationId: "", reason: "Cycle count", notes: "", lines: [{ ...lineDefaults, systemQuantity: 0, physicalQuantity: 0 }] } });
  const selectedBranch = form.watch("branchId"), warehouseId = form.watch("warehouseId"), locationId = form.watch("locationId"), productId = form.watch("lines.0.productId"); const warehouses = useWarehouseOptions(selectedBranch), locations = useStockLocationOptions(warehouseId), products = useInventoryProductOptions("all");
  const balances = useStockBalances({ branchId: selectedBranch || "__none__", warehouseId: warehouseId || "__none__", locationId: locationId || "__none__", permittedBranchIds: branches.map((branch) => branch.id) });
  const systemQuantity = (balances.data ?? []).filter((balance) => balance.productId === productId).reduce((sum, balance) => sum + balance.quantityOnHand, 0);
  useEffect(() => { form.setValue("lines.0.systemQuantity", systemQuantity); }, [form, systemQuantity]);
  const submit = form.handleSubmit(async (values) => { try { await mutations.createCount(values); appToast.success("Stock count submitted for review."); form.reset(); onClose(); } catch (error) { appToast.error(getErrorMessage(error, "Unable to create stock count.")); } });
  return <Modal isOpen={isOpen} onClose={onClose} title="New Stock Count" maxWidth="820px" footer={<FormActions formId="count-form" busy={form.formState.isSubmitting} onClose={onClose} />}><form id="count-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
    <FormField label="Branch"><Select {...form.register("branchId")} options={options(branches)} /></FormField><FormField label="Warehouse"><Select {...form.register("warehouseId")} placeholder="Select warehouse" options={options(warehouses.data ?? [])} /></FormField><FormField label="Location"><Select {...form.register("locationId")} placeholder="Select location" options={options(locations.data ?? [])} /></FormField><FormField label="Product"><Select {...form.register("lines.0.productId")} placeholder="Select product" options={options(products.data ?? [])} /></FormField><FormField label="System quantity" hint="The service recalculates this value when submitted."><TextInput type="number" readOnly {...form.register("lines.0.systemQuantity", { valueAsNumber: true })} /></FormField><FormField label="Physical quantity"><TextInput type="number" min="0" step="0.01" {...form.register("lines.0.physicalQuantity", { valueAsNumber: true })} /></FormField>
    <Controller control={form.control} name="lines.0.batchReference" render={({ field: batch }) => <Controller control={form.control} name="lines.0.serialReferences" render={({ field: serials }) => <TrackingFields branchId={selectedBranch} warehouseId={warehouseId} locationId={locationId} productId={productId} batchReference={batch.value} serialReferences={serials.value} onBatchChange={batch.onChange} onSerialChange={serials.onChange} />} />} />
    <FormField label="Reason"><TextInput {...form.register("reason")} /></FormField><FormField label="Notes" className="sm:col-span-2"><Textarea rows={2} {...form.register("notes")} /></FormField>
  </form></Modal>;
}

export function StockReturnWastageCreateModal({ isOpen, onClose }: ModalProps) {
  const { branches, branchId } = useBranch(); const mutations = useStockWorkflowMutations();
  const form = useAppForm<StockReturnWastageFormValues>({ resolver: zodResolver(stockReturnWastageSchema), defaultValues: { branchId: branchId ?? "", warehouseId: "", locationId: "", workflowType: "return", condition: "usable", reason: "", notes: "", lines: [{ ...lineDefaults }] } });
  const selectedBranch = form.watch("branchId"), warehouseId = form.watch("warehouseId"), locationId = form.watch("locationId"), productId = form.watch("lines.0.productId"); const warehouses = useWarehouseOptions(selectedBranch), locations = useStockLocationOptions(warehouseId), products = useInventoryProductOptions("all");
  const submit = form.handleSubmit(async (values) => { try { await mutations.createReturnWastage(values); appToast.success("Stock return or wastage submitted for approval."); form.reset(); onClose(); } catch (error) { appToast.error(getErrorMessage(error, "Unable to create stock return or wastage.")); } });
  return <Modal isOpen={isOpen} onClose={onClose} title="New Return / Wastage" maxWidth="820px" footer={<FormActions formId="return-form" busy={form.formState.isSubmitting} onClose={onClose} />}><form id="return-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
    <FormField label="Workflow"><Select {...form.register("workflowType")} options={[{ value: "return", label: "Return" }, { value: "wastage", label: "Wastage" }]} /></FormField><FormField label="Condition"><Select {...form.register("condition")} options={[{ value: "usable", label: "Usable" }, { value: "damaged", label: "Damaged / quarantine" }, { value: "wastage", label: "Wastage" }]} /></FormField><FormField label="Branch"><Select {...form.register("branchId")} options={options(branches)} /></FormField><FormField label="Warehouse"><Select {...form.register("warehouseId")} placeholder="Select warehouse" options={options(warehouses.data ?? [])} /></FormField><FormField label="Location"><Select {...form.register("locationId")} placeholder="Select location" options={options(locations.data ?? [])} /></FormField><FormField label="Product"><Select {...form.register("lines.0.productId")} placeholder="Select product" options={options(products.data ?? [])} /></FormField><FormField label="Quantity"><TextInput type="number" min="0.01" step="0.01" {...form.register("lines.0.quantity", { valueAsNumber: true })} /></FormField>
    <Controller control={form.control} name="lines.0.batchReference" render={({ field: batch }) => <Controller control={form.control} name="lines.0.serialReferences" render={({ field: serials }) => <TrackingFields branchId={selectedBranch} warehouseId={warehouseId} locationId={locationId} productId={productId} batchReference={batch.value} serialReferences={serials.value} onBatchChange={batch.onChange} onSerialChange={serials.onChange} />} />} />
    <FormField label="Reason" className="sm:col-span-2"><Textarea rows={2} {...form.register("reason")} /></FormField><FormField label="Notes" className="sm:col-span-2"><Textarea rows={2} {...form.register("notes")} /></FormField>
  </form></Modal>;
}
