import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ArrowDown, ArrowUp, Edit, ListPlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { IconButton } from '@/shared/components/common/IconButton';
import { Modal } from '@/shared/components/common/Modal';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { FormField } from '@/shared/components/forms/FormField';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { appToast } from '@/shared/utils/toast';
import { useProductSpecifications } from '../hooks/useProductSpecifications';
import { productSpecificationFormSchema, type ProductSpecificationFormValues } from '../schemas/productSpecificationSchema';
import { ProductSectionSkeleton } from './ProductLoadingStates';
import type { ProductSpecification } from '../types/product';

interface ProductSpecificationsSectionProps {
  productId: string;
  canManage: boolean;
}

interface SpecificationFormModalProps {
  item: ProductSpecification | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: ProductSpecificationFormValues) => Promise<unknown>;
}

function SpecificationFormModal({ item, isSaving, onClose, onSave }: SpecificationFormModalProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<ProductSpecificationFormValues>({
    resolver: zodResolver(productSpecificationFormSchema),
    defaultValues: {
      name: item?.name ?? '',
      value: item?.value ?? '',
      unit: item?.unit ?? '',
      group: item?.group ?? '',
    },
  });
  const submit = async (values: ProductSpecificationFormValues) => {
    try {
      await onSave(values);
      appToast.success(`Specification ${item ? 'updated' : 'added'}.`);
      onClose();
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to save the product specification.');
    }
  };
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item ? 'Edit Product Specification' : 'Add Product Specification'}
      maxWidth="680px"
      footer={<><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" isLoading={isSaving} onClick={() => void handleSubmit(submit)()}>Save Specification</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name / label" required error={errors.name?.message}><TextInput {...register('name')} placeholder="Processor" /></FormField>
        <FormField label="Group" error={errors.group?.message} hint="Optional; ungrouped fields appear under General."><TextInput {...register('group')} placeholder="Technical" /></FormField>
        <FormField label="Value" required error={errors.value?.message} className="sm:col-span-2"><Textarea {...register('value')} rows={3} placeholder="Intel Core i7-1360P" /></FormField>
        <FormField label="Unit" error={errors.unit?.message} hint="Optional, for example kg, mm, GB or years."><TextInput {...register('unit')} placeholder="GB" /></FormField>
      </div>
    </Modal>
  );
}

export function ProductSpecificationsSection({ productId, canManage }: ProductSpecificationsSectionProps) {
  const data = useProductSpecifications(productId);
  const [editing, setEditing] = useState<ProductSpecification | null | undefined>();
  const [removing, setRemoving] = useState<ProductSpecification | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const groups = useMemo(() => {
    const result = new Map<string, ProductSpecification[]>();
    data.specifications.forEach((specification) => {
      const group = specification.group?.trim() || 'General';
      result.set(group, [...(result.get(group) ?? []), specification]);
    });
    return [...result.entries()];
  }, [data.specifications]);

  const move = async (specification: ProductSpecification, direction: 'up' | 'down') => {
    setActionError(null);
    try {
      await data.move(specification.id, direction);
      appToast.success('Specification order updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reorder specifications.';
      setActionError(message);
      appToast.error(message);
    }
  };

  const confirmRemoval = async () => {
    if (!removing) return;
    setActionError(null);
    try {
      await data.remove(removing.id);
      appToast.success('Product specification removed.');
      setRemoving(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove the product specification.';
      setActionError(message);
      appToast.error(message);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-base font-semibold text-slate-900">Product Specifications</h2><p className="mt-1 text-sm text-slate-500">Flexible tenant-level product details grouped for clear reference.</p></div>
        {canManage && <Button type="button" leftIcon={<Plus size={16} />} onClick={() => setEditing(null)}>Add Specification</Button>}
      </div>

      {actionError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>}

      {data.error ? (
        <div className="mt-4"><ErrorState message={data.error} onRetry={() => void data.refetch()} /></div>
      ) : data.isLoading ? (
        <ProductSectionSkeleton rows={2} />
      ) : data.specifications.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
          <ListPlus className="mx-auto text-slate-400" size={28} />
          <p className="mt-2 text-sm font-medium text-slate-700">No product specifications</p>
          <p className="mt-1 text-xs text-slate-500">{canManage ? 'Add flexible specification fields for this product.' : 'No specifications have been added to this product.'}</p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map(([group, specifications]) => (
            <section key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</h3>
              <dl className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {specifications.map((specification, index) => (
                  <div key={specification.id} className="grid grid-cols-1 gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(160px,0.7fr)_minmax(240px,1.3fr)_auto] sm:items-center">
                    <dt className="text-sm font-medium text-slate-600">{specification.name}</dt>
                    <dd className="whitespace-pre-wrap text-sm font-medium text-slate-900">{specification.value}{specification.unit ? <span className="ml-1 text-slate-500">{specification.unit}</span> : null}</dd>
                    {canManage && (
                      <div className="flex items-center justify-end">
                        <IconButton type="button" icon={<ArrowUp size={15} />} label="Move specification up" disabled={index === 0 || data.isSaving} onClick={() => void move(specification, 'up')} />
                        <IconButton type="button" icon={<ArrowDown size={15} />} label="Move specification down" disabled={index === specifications.length - 1 || data.isSaving} onClick={() => void move(specification, 'down')} />
                        <IconButton type="button" icon={<Edit size={15} />} label="Edit specification" disabled={data.isSaving} onClick={() => setEditing(specification)} />
                        <IconButton type="button" icon={<Trash2 size={15} />} label="Remove specification" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={data.isSaving} onClick={() => setRemoving(specification)} />
                      </div>
                    )}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}

      {editing !== undefined && <SpecificationFormModal item={editing} isSaving={data.isSaving} onClose={() => setEditing(undefined)} onSave={(values) => editing ? data.update(editing.id, values) : data.create(values)} />}
      <ConfirmDialog
        isOpen={Boolean(removing)}
        title="Remove Product Specification"
        message={`Remove "${removing?.name ?? 'this specification'}" from this product?`}
        confirmLabel="Remove Specification"
        variant="danger"
        isLoading={data.isDeleting}
        onCancel={() => setRemoving(null)}
        onConfirm={() => void confirmRemoval()}
      />
    </Card>
  );
}
