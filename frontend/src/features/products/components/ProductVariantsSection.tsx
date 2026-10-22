import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Edit, Eye, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import type { DropdownItem } from '@/shared/components/common/Dropdown';
import { IconButton } from '@/shared/components/common/IconButton';
import { Modal } from '@/shared/components/common/Modal';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { FormField } from '@/shared/components/forms/FormField';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Select } from '@/shared/components/forms/Select';
import { TextInput } from '@/shared/components/forms/TextInput';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import { formatDate } from '@/shared/utils/formatters';
import { appToast } from '@/shared/utils/toast';
import { useProductAttributeOptions } from '../hooks/useProductAttributes';
import { useProductVariants } from '../hooks/useProductVariants';
import { productVariantFormSchema, type ProductVariantFormValues } from '../schemas/productVariantSchema';
import type { Product, ProductAttribute, ProductVariantListItem } from '../types/product';

interface ProductVariantsSectionProps {
  product: Product;
  canManage: boolean;
  canManagePrices: boolean;
}

const barcodeTypeOptions = [
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'UPC_A', label: 'UPC-A' },
  { value: 'CODE128', label: 'Code 128' },
  { value: 'OTHER', label: 'Other / Internal' },
];

function attributeSummary(variant: ProductVariantListItem) {
  return variant.attributes.map((attribute) => `${attribute.attributeName}: ${attribute.value}`).join(' · ');
}

interface VariantFormModalProps {
  item: ProductVariantListItem | null;
  parent: Product;
  attributes: ProductAttribute[];
  isSaving: boolean;
  isGeneratingSku: boolean;
  onClose: () => void;
  onSave: (values: ProductVariantFormValues) => Promise<unknown>;
  onGenerateSku: (attributes: ProductVariantFormValues['attributes']) => Promise<string>;
  canManagePrices: boolean;
}

function VariantFormModal({ item, parent, attributes, isSaving, isGeneratingSku, onClose, onSave, onGenerateSku, canManagePrices }: VariantFormModalProps) {
  const currency = useTenantCurrency();
  const values: ProductVariantFormValues = {
    sku: item?.sku ?? '',
    barcode: item?.barcode ?? '',
    barcodeType: item?.barcodeType ?? 'CODE128',
    status: item?.status ?? 'active',
    attributes: item?.attributes.map((attribute) => ({ attributeId: attribute.attributeId, optionId: attribute.optionId })) ?? [{ attributeId: '', optionId: '' }],
    sellingPrice: item?.sellingPrice,
    costPrice: item?.costPrice,
  };
  const { control, register, handleSubmit, getValues, setValue, formState: { errors } } = useForm<ProductVariantFormValues>({
    resolver: zodResolver(productVariantFormSchema),
    defaultValues: values,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'attributes' });
  const selections = useWatch({ control, name: 'attributes' });

  const generateSku = async () => {
    const selected = getValues('attributes');
    if (!selected.length || selected.some((selection) => !selection.attributeId || !selection.optionId)) {
      appToast.error('Select the variant attributes before generating a SKU.');
      return;
    }
    try {
      const sku = await onGenerateSku(selected);
      setValue('sku', sku, { shouldDirty: true, shouldValidate: true });
      appToast.success('Variant SKU generated.');
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to generate a variant SKU.');
    }
  };

  const submit = async (form: ProductVariantFormValues) => {
    try {
      await onSave(form);
      appToast.success(`Variant ${item ? 'updated' : 'created'}.`);
      onClose();
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to save the product variant.');
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item ? 'Edit Product Variant' : 'Add Product Variant'}
      maxWidth="820px"
      footer={<><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" isLoading={isSaving} onClick={() => void handleSubmit(submit)()}>Save Variant</Button></>}
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-slate-900">Attribute Combination</h3><p className="text-xs text-slate-500">Select a unique combination from the system-provided attribute values.</p></div>
            <Button type="button" size="sm" variant="secondary" leftIcon={<Plus size={14} />} disabled={fields.length >= attributes.length} onClick={() => append({ attributeId: '', optionId: '' })}>Add Attribute</Button>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => {
              const selectedAttribute = attributes.find((attribute) => attribute.id === selections[index]?.attributeId);
              const selectedElsewhere = new Set(selections.filter((_, selectionIndex) => selectionIndex !== index).map((selection) => selection.attributeId));
              return (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <FormField label="Attribute" error={errors.attributes?.[index]?.attributeId?.message}>
                    <Controller name={`attributes.${index}.attributeId`} control={control} render={({ field: attributeField }) => <Select {...attributeField} placeholder="Select attribute" options={attributes.map((attribute) => ({ value: attribute.id, label: attribute.name, disabled: selectedElsewhere.has(attribute.id) }))} onChange={(event) => { attributeField.onChange(event); setValue(`attributes.${index}.optionId`, '', { shouldDirty: true }); }} />} />
                  </FormField>
                  <FormField label="Allowed value" error={errors.attributes?.[index]?.optionId?.message}>
                    <Select {...register(`attributes.${index}.optionId`)} placeholder="Select value" disabled={!selectedAttribute} options={(selectedAttribute?.options ?? []).map((option) => ({ value: option.id, label: option.value }))} />
                  </FormField>
                  <div className="pt-6"><IconButton type="button" icon={<Trash2 size={16} />} label="Remove attribute" disabled={fields.length === 1} className="text-red-600 hover:bg-red-50" onClick={() => remove(index)} /></div>
                </div>
              );
            })}
          </div>
          {typeof errors.attributes?.message === 'string' && <p className="mt-1 text-xs text-red-600">{errors.attributes.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Variant SKU" required error={errors.sku?.message}>
            <div className="flex gap-2"><TextInput {...register('sku')} className="font-mono" /><Button type="button" variant="secondary" leftIcon={<Sparkles size={15} />} isLoading={isGeneratingSku} onClick={() => void generateSku()}>Generate</Button></div>
          </FormField>
          <FormField label="Status" required error={errors.status?.message}>
            <Select {...register('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          </FormField>
          <FormField label="Barcode" error={errors.barcode?.message}><TextInput {...register('barcode')} className="font-mono" placeholder="Optional" /></FormField>
          <FormField label="Barcode format" error={errors.barcodeType?.message}><Select {...register('barcodeType')} options={barcodeTypeOptions} /></FormField>
          <FormField label="Selling price override" error={errors.sellingPrice?.message} hint={`Leave empty to use ${currency.formatMoney(parent.sellingPrice)}.`}>
            <Controller name="sellingPrice" control={control} render={({ field }) => <NumberInput min={0} step="0.01" value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? undefined : value)} disabled={!canManagePrices} />} />
          </FormField>
          <FormField label="Cost price override" error={errors.costPrice?.message} hint={`Leave empty to use ${currency.formatMoney(parent.costPrice)}.`}>
            <Controller name="costPrice" control={control} render={({ field }) => <NumberInput min={0} step="0.01" value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? undefined : value)} disabled={!canManagePrices} />} />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

export function ProductVariantsSection({ product, canManage, canManagePrices }: ProductVariantsSectionProps) {
  const currency = useTenantCurrency();
  const variants = useProductVariants(product.id);
  const attributeQuery = useProductAttributeOptions(true);
  const [editing, setEditing] = useState<ProductVariantListItem | null | undefined>();
  const [viewing, setViewing] = useState<ProductVariantListItem | null>(null);
  const [deleting, setDeleting] = useState<ProductVariantListItem | null>(null);
  const activeAttributes = (attributeQuery.data ?? []).filter((attribute) => attribute.isActive || editing?.attributes.some((selection) => selection.attributeId === attribute.id));
  const columns: Column<ProductVariantListItem>[] = [
    { key: 'attributes', header: 'Variant', render: (variant) => <div className="min-w-52"><p className="font-semibold text-slate-900">{attributeSummary(variant)}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{variant.sku}</p></div> },
    { key: 'barcode', header: 'Barcode', render: (variant) => variant.barcode ? <div><p className="font-mono text-slate-700">{variant.barcode}</p><p className="text-xs text-slate-500">{variant.barcodeType?.replace('_', '-')}</p></div> : 'Not assigned' },
    { key: 'sellingPrice', header: 'Selling Price', align: 'right', render: (variant) => <div><p className="font-semibold text-slate-900">{currency.formatMoney(variant.effectiveSellingPrice)}</p><p className="text-xs text-slate-500">{variant.usesParentSellingPrice ? 'Parent price' : 'Variant override'}</p></div> },
    { key: 'costPrice', header: 'Cost Price', align: 'right', render: (variant) => <div><p>{currency.formatMoney(variant.effectiveCostPrice)}</p><p className="text-xs text-slate-500">{variant.usesParentCostPrice ? 'Parent price' : 'Variant override'}</p></div> },
    { key: 'status', header: 'Status', render: (variant) => <StatusBadge status={variant.status} /> },
  ];
  const rowActions = (variant: ProductVariantListItem): DropdownItem[] => {
    const actions: DropdownItem[] = [{ key: 'view', label: 'View Details', icon: <Eye size={14} />, onClick: () => setViewing(variant) }];
    if (canManage) {
      actions.push({ key: 'edit', label: 'Edit Variant', icon: <Edit size={14} />, onClick: () => setEditing(variant) });
      actions.push({ key: 'delete', label: 'Delete Variant', icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleting(variant) });
    }
    return actions;
  };

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-base font-semibold text-slate-900">Product Variants</h2><p className="mt-1 text-sm text-slate-500">Tenant-level attribute combinations, identifiers, status and price overrides. Stock remains branch-specific.</p></div>
        {canManage && <Button type="button" leftIcon={<Plus size={16} />} disabled={!attributeQuery.data?.some((attribute) => attribute.isActive)} onClick={() => setEditing(null)}>Add Variant</Button>}
      </div>
      {variants.error ? (
        <ErrorState message={variants.error} onRetry={() => void variants.refetch()} />
      ) : attributeQuery.error ? (
        <ErrorState message="Failed to load the system product attributes." onRetry={() => void attributeQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={variants.variants}
          keyField="id"
          isLoading={variants.isLoading || attributeQuery.isLoading}
          onRowClick={setViewing}
          rowActions={rowActions}
          emptyTitle="No product variants"
          emptyMessage={canManage ? 'Create a variant from the system-provided attribute options.' : 'No variants have been created for this product.'}
          emptyAction={canManage && attributeQuery.data?.some((attribute) => attribute.isActive) ? <Button type="button" size="sm" leftIcon={<Plus size={14} />} onClick={() => setEditing(null)}>Add Variant</Button> : undefined}
        />
      )}

      {editing !== undefined && (
        <VariantFormModal
          item={editing}
          parent={product}
          attributes={activeAttributes}
          isSaving={variants.isSaving}
          isGeneratingSku={variants.isGeneratingSku}
          onClose={() => setEditing(undefined)}
          onSave={(values) => editing ? variants.update(editing.id, values) : variants.create(values)}
          onGenerateSku={variants.generateSku}
          canManagePrices={canManagePrices}
        />
      )}

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Variant Details"
        footer={<><Button type="button" variant="secondary" onClick={() => setViewing(null)}>Close</Button>{canManage && viewing && <Button type="button" leftIcon={<Edit size={15} />} onClick={() => { setEditing(viewing); setViewing(null); }}>Edit Variant</Button>}</>}
      >
        {viewing && <div><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{attributeSummary(viewing)}</h3><p className="mt-1 font-mono text-xs text-slate-500">{viewing.sku}</p></div><StatusBadge status={viewing.status} /></div><dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase text-slate-500">Barcode</dt><dd className="mt-1 text-sm text-slate-900">{viewing.barcode ?? 'Not assigned'}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">Format</dt><dd className="mt-1 text-sm text-slate-900">{viewing.barcodeType?.replace('_', '-') ?? 'Not assigned'}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">Effective selling price</dt><dd className="mt-1 text-sm text-slate-900">{currency.formatMoney(viewing.effectiveSellingPrice)} ({viewing.usesParentSellingPrice ? 'parent' : 'override'})</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">Effective cost price</dt><dd className="mt-1 text-sm text-slate-900">{currency.formatMoney(viewing.effectiveCostPrice)} ({viewing.usesParentCostPrice ? 'parent' : 'override'})</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">Created</dt><dd className="mt-1 text-sm text-slate-900">{formatDate(viewing.createdAt)}</dd></div></dl>{viewing.status === 'inactive' && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This variant is excluded from normal sales and purchasing selectors.</p>}</div>}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Delete Product Variant"
        message={`Delete variant "${deleting?.sku ?? ''}"? This removes its master-data combination but does not change branch stock records.`}
        confirmLabel="Delete Variant"
        variant="danger"
        isLoading={variants.isDeleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void variants.remove(deleting.id).then(() => { appToast.success('Product variant deleted.'); setDeleting(null); }).catch((error: unknown) => appToast.error(error instanceof Error ? error.message : 'Unable to delete the variant.'));
        }}
      />
    </Card>
  );
}
