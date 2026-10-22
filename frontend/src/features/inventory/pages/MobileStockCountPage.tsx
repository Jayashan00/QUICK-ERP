import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ClipboardCheck, Save, ScanLine, Trash2 } from "lucide-react";
import { useBranch } from "@/core/branch/branch-context";
import { Button } from "@/shared/components/common/Button";
import { Card } from "@/shared/components/common/Card";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { FormField } from "@/shared/components/forms/FormField";
import { Select } from "@/shared/components/forms/Select";
import { Textarea } from "@/shared/components/forms/Textarea";
import { TextInput } from "@/shared/components/forms/TextInput";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { appToast } from "@/shared/utils/toast";
import { getErrorMessage } from "@/shared/utils/errors";
import {
  stockCountSchema,
  type StockCountFormValues,
} from "../schemas/inventorySchemas";
import { useStockBalances } from "../hooks/useInventory";
import { useInventorySettings } from "../hooks/useInventorySettings";
import { useStockLocationOptions } from "../hooks/useStockLocationManagement";
import { useStockCounts, useStockWorkflowMutations } from "../hooks/useStockWorkflows";
import { useWarehouseOptions } from "../hooks/useWarehouseManagement";
import type { StockBalanceListItem } from "../types/inventory";

export function MobileStockCountPage() {
  const { currentBranch, branches } = useBranch();
  const [selectedBranchId, setSelectedBranchId] = useState(currentBranch?.id ?? "");
  const [selectedCountId, setSelectedCountId] = useState("");
  const [scan, setScan] = useState("");
  const [pendingCompletion, setPendingCompletion] = useState<StockCountFormValues | null>(null);
  const [savedStatus, setSavedStatus] = useState<"draft" | "pending_review" | "completed">("draft");
  const settings = useInventorySettings();
  const mutations = useStockWorkflowMutations();
  const form = useForm<StockCountFormValues>({
    resolver: zodResolver(stockCountSchema),
    defaultValues: {
      branchId: selectedBranchId,
      warehouseId: "",
      locationId: "",
      reason: "Mobile cycle count",
      notes: "",
      lines: [],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "lines" });
  const warehouseId = useWatch({ control: form.control, name: "warehouseId" });
  const locationId = useWatch({ control: form.control, name: "locationId" });
  const watchedLines = useWatch({ control: form.control, name: "lines" });
  const lines = useMemo(() => watchedLines ?? [], [watchedLines]);
  const warehouses = useWarehouseOptions(selectedBranchId);
  const locations = useStockLocationOptions(warehouseId);
  const counts = useStockCounts({ branchId: selectedBranchId, status: "all", page: 1, pageSize: 100 });
  const balances = useStockBalances({
    branchId: selectedBranchId,
    permittedBranchIds: branches.map((item) => item.id),
    warehouseId: warehouseId || undefined,
    locationId: locationId || undefined,
  });
  const draftCounts = (counts.data?.data ?? []).filter((item) => item.status === "draft");

  useEffect(() => {
    if (
      settings.settings?.branchId === selectedBranchId &&
      !form.getValues("warehouseId")
    ) {
      form.setValue("warehouseId", settings.settings.defaultWarehouseId);
      form.setValue("locationId", settings.settings.defaultLocationId);
    }
  }, [form, selectedBranchId, settings.settings]);

  const availableBalances = useMemo(() => {
    const query = scan.trim().toLocaleLowerCase();
    const existing = new Set(lines.map((line) => `${line.productId}:${line.variantId ?? ""}`));
    return (balances.data ?? [])
      .filter((item) => !existing.has(`${item.productId}:${item.variantId ?? ""}`))
      .filter(
        (item) =>
          !query ||
          [item.productName, item.sku, item.barcode].some((value) =>
            value?.toLocaleLowerCase().includes(query),
          ),
      )
      .slice(0, 8);
  }, [balances.data, lines, scan]);

  const balanceFor = (productId: string, variantId?: string) =>
    (balances.data ?? []).find(
      (item) => item.productId === productId && item.variantId === variantId,
    );
  const addBalance = (item: StockBalanceListItem) => {
    append({
      productId: item.productId,
      variantId: item.variantId,
      quantity: 1,
      batchReference: "",
      serialReferences: [],
      systemQuantity: item.quantityOnHand,
      physicalQuantity: item.quantityOnHand,
    });
    setScan("");
  };
  const scanExact = () => {
    const value = scan.trim().toLocaleLowerCase();
    const match = availableBalances.find(
      (item) =>
        item.sku.toLocaleLowerCase() === value ||
        item.barcode?.toLocaleLowerCase() === value,
    );
    if (match) addBalance(match);
    else if (availableBalances.length === 1) addBalance(availableBalances[0]);
    else appToast.error("No unique SKU or barcode match was found in this location.");
  };

  const changeBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedCountId("");
    setSavedStatus("draft");
    form.reset({ branchId, warehouseId: "", locationId: "", reason: "Mobile cycle count", notes: "", lines: [] });
  };
  const loadDraft = (id: string) => {
    setSelectedCountId(id);
    const count = draftCounts.find((item) => item.id === id);
    if (!count) return;
    setSelectedBranchId(count.branchId);
    setSavedStatus("draft");
    form.reset({
      branchId: count.branchId,
      warehouseId: count.warehouseId,
      locationId: count.locationId,
      reason: count.reason,
      notes: count.notes ?? "",
      lines: count.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: Math.max(1, line.quantity),
        batchReference: line.batchReference ?? "",
        serialReferences: line.serialReferences ?? [],
        systemQuantity: line.systemQuantity,
        physicalQuantity: line.physicalQuantity,
      })),
    });
  };
  const saveDraft = async (values: StockCountFormValues) => {
    const saved = await mutations.saveCountDraft(values, selectedCountId || undefined);
    setSelectedCountId(saved.id);
    setSavedStatus("draft");
    return saved;
  };
  const submitDraft = form.handleSubmit(async (values) => {
    try {
      await saveDraft(values);
      appToast.success("Stock count draft saved.");
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to save the stock count draft."));
    }
  });
  const complete = async () => {
    if (!pendingCompletion) return;
    try {
      const draft = await saveDraft(pendingCompletion);
      const completed = await mutations.completeCount(draft.id);
      setSavedStatus(completed.status === "completed" ? "completed" : "pending_review");
      setPendingCompletion(null);
      appToast.success(completed.status === "completed" ? "Stock count completed and the ledger was updated." : "Stock count submitted for approval.");
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to complete the stock count."));
    }
  };

  if (counts.error || balances.error)
    return <ErrorState title="Mobile stock count unavailable" message="Count or stock data could not be loaded for the selected branch." onRetry={() => { void counts.refetch(); void balances.refetch(); }} />;

  const showSystemQuantity = settings.settings?.showSystemQuantityDuringCount ?? true;
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24 lg:pb-6">
      <PageHeader title="Mobile Stock Count" description="Count existing location stock on a phone or tablet without creating a second inventory state." actions={<StatusBadge status={savedStatus} label={savedStatus === "pending_review" ? "Pending review" : savedStatus === "completed" ? "Completed" : "Draft"} />} />
      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Branch" required>
            <Select value={selectedBranchId} onChange={(event) => changeBranch(event.target.value)} options={branches.map((item) => ({ value: item.id, label: item.name }))} />
          </FormField>
          <FormField label="Continue existing draft">
            <Select value={selectedCountId} onChange={(event) => loadDraft(event.target.value)} options={[{ value: "", label: "Start a new count" }, ...draftCounts.map((item) => ({ value: item.id, label: `${item.referenceNumber} - ${item.reason}` }))]} />
          </FormField>
          <FormField label="Warehouse" required error={form.formState.errors.warehouseId?.message}>
            <Select error={Boolean(form.formState.errors.warehouseId)} options={[{ value: "", label: "Select warehouse" }, ...(warehouses.data ?? []).map((item) => ({ value: item.id, label: item.name }))]} {...form.register("warehouseId", { onChange: () => { form.setValue("locationId", ""); replace([]); setSelectedCountId(""); setSavedStatus("draft"); } })} />
          </FormField>
          <FormField label="Location" required error={form.formState.errors.locationId?.message}>
            <Select error={Boolean(form.formState.errors.locationId)} disabled={!warehouseId} options={[{ value: "", label: "Select location" }, ...(locations.data ?? []).filter((item) => item.warehouseId === warehouseId).map((item) => ({ value: item.id, label: item.name }))]} {...form.register("locationId", { onChange: () => { replace([]); setSelectedCountId(""); setSavedStatus("draft"); } })} />
          </FormField>
        </div>
        <input type="hidden" {...form.register("branchId")} />
      </Card>

      <Card className="p-4">
        <FormField label="Search or scan SKU / barcode" hint={locationId ? "Use a connected barcode scanner or type a SKU/barcode and press Enter." : "Select a warehouse and location first."}>
          <div className="flex gap-2">
            <TextInput value={scan} disabled={!locationId} placeholder="SKU, barcode or product name" onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); scanExact(); } }} />
            <Button type="button" variant="secondary" aria-label="Add scanned stock item" disabled={!scan.trim() || !locationId} onClick={scanExact}><ScanLine size={19} /></Button>
          </div>
        </FormField>
        {scan.trim() && locationId && (
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {availableBalances.length ? availableBalances.map((item) => (
              <button key={item.id} type="button" className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => addBalance(item)}>
                <span><span className="block text-sm font-medium text-slate-900">{item.productName}</span><span className="block text-xs text-slate-500">{item.sku}{item.barcode ? ` · ${item.barcode}` : ""}</span></span>
                <span className="text-xs font-semibold text-slate-600">On hand {item.quantityOnHand}</span>
              </button>
            )) : <p className="p-3 text-sm text-slate-500">No uncounted stock matches this search.</p>}
          </div>
        )}
      </Card>

      <form className="space-y-4" onSubmit={submitDraft}>
        {fields.length === 0 ? (
          <Card className="py-10 text-center"><ClipboardCheck className="mx-auto text-slate-400" size={36} /><h2 className="mt-3 font-semibold text-slate-800">No items added</h2><p className="mt-1 text-sm text-slate-500">Scan or search stock from the selected location to begin counting.</p></Card>
        ) : fields.map((field, index) => {
          const line = lines[index];
          const balance = balanceFor(line?.productId ?? field.productId, line?.variantId);
          const systemQuantity = line?.systemQuantity ?? field.systemQuantity;
          const physicalQuantity = Number.isFinite(line?.physicalQuantity) ? line.physicalQuantity : 0;
          const variance = physicalQuantity - systemQuantity;
          return (
            <Card key={field.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-semibold text-slate-900">{balance?.productName ?? field.productId}</h2><p className="mt-0.5 text-xs text-slate-500">{balance?.sku ?? "Stock item"}{balance?.barcode ? ` · ${balance.barcode}` : ""}</p></div>
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${balance?.productName ?? "stock item"}`} onClick={() => remove(index)}><Trash2 size={17} /></Button>
              </div>
              <input type="hidden" {...form.register(`lines.${index}.productId`)} />
              <input type="hidden" {...form.register(`lines.${index}.variantId`)} />
              <input type="hidden" {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })} />
              <input type="hidden" {...form.register(`lines.${index}.systemQuantity`, { valueAsNumber: true })} />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">System</p><p className="mt-1 text-lg font-semibold text-slate-800">{showSystemQuantity ? systemQuantity : "Hidden"}</p></div>
                <FormField label="Counted" error={form.formState.errors.lines?.[index]?.physicalQuantity?.message}>
                  <TextInput className="text-center text-lg font-semibold" inputMode="decimal" type="number" min={0} step="any" {...form.register(`lines.${index}.physicalQuantity`, { valueAsNumber: true })} />
                </FormField>
                <div className={`rounded-lg p-3 text-center ${variance === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}><p className="text-xs">Variance</p><p className="mt-1 text-lg font-semibold">{variance > 0 ? "+" : ""}{variance}</p></div>
              </div>
            </Card>
          );
        })}
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Count reason" required error={form.formState.errors.reason?.message}><TextInput {...form.register("reason")} /></FormField>
            <FormField label="Notes" error={form.formState.errors.notes?.message}><Textarea rows={2} {...form.register("notes")} /></FormField>
          </div>
        </Card>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur lg:static lg:flex lg:justify-end lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mx-auto flex max-w-4xl gap-2 lg:mx-0">
            <Button className="flex-1 lg:flex-none" type="submit" variant="secondary" leftIcon={<Save size={17} />} disabled={savedStatus !== "draft"} isLoading={mutations.isPending}>Save Draft</Button>
            <Button className="flex-1 lg:flex-none" type="button" leftIcon={<CheckCircle2 size={17} />} disabled={!fields.length || savedStatus !== "draft"} isLoading={mutations.isPending} onClick={() => void form.handleSubmit((values) => setPendingCompletion(values))()}>{settings.settings?.requireCountApproval ? "Submit Count" : "Complete Count"}</Button>
          </div>
        </div>
      </form>
      <ConfirmDialog isOpen={Boolean(pendingCompletion)} title={settings.settings?.requireCountApproval ? "Submit stock count" : "Complete stock count"} message={settings.settings?.requireCountApproval ? "Save this count and submit its variances for approval?" : "Complete this count and post its variances to the mock stock ledger?"} confirmLabel={settings.settings?.requireCountApproval ? "Submit Count" : "Complete Count"} isLoading={mutations.isPending} onCancel={() => setPendingCompletion(null)} onConfirm={() => void complete()} />
    </div>
  );
}
