import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { FormField } from '@/shared/components/forms/FormField';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Select } from '@/shared/components/forms/Select';
import { Switch } from '@/shared/components/forms/Switch';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { appToast } from '@/shared/utils/toast';
import { brandFormSchema, categoryFormSchema, uomFormSchema, type BrandFormValues, type CategoryFormValues, type UomFormValues } from '../schemas/masterDataSchemas';
import { useCategoryOptions } from '../hooks/useProductMasterData';
import type { Brand, Category, UOM } from '../types/product';

interface FormModalProps<T> {
  item: T | null;
  onClose: () => void;
  onSave: (values: never) => Promise<unknown>;
  isSaving: boolean;
}

export function CategoryFormModal({ item, onClose, onSave, isSaving }: Omit<FormModalProps<Category>, 'onSave'> & { onSave: (values: CategoryFormValues) => Promise<unknown> }) {
  const options = useCategoryOptions(true);
  const values: CategoryFormValues = { name: item?.name ?? '', code: item?.code ?? '', description: item?.description ?? '', parentId: item?.parentId ?? '', sortOrder: item?.sortOrder ?? 10, isActive: item?.isActive ?? true };
  const { register, control, handleSubmit, formState: { errors } } = useForm<CategoryFormValues>({ resolver: zodResolver(categoryFormSchema), values });
  const submit = async (form: CategoryFormValues) => { try { await onSave(form); appToast.success(`Category ${item ? 'updated' : 'created'}.`); onClose(); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to save category.'); } };
  return <Modal isOpen onClose={onClose} title={item ? 'Edit Category' : 'Add Category'} maxWidth="680px" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="category-form" isLoading={isSaving}>Save Category</Button></>}><form id="category-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((form) => void submit(form))}><FormField label="Name" required error={errors.name?.message}><TextInput {...register('name')} /></FormField><FormField label="Code" required error={errors.code?.message}><TextInput {...register('code')} /></FormField><FormField label="Parent category" error={errors.parentId?.message}><Select {...register('parentId')} placeholder="No parent category" options={(options.data ?? []).filter((category) => category.id !== item?.id).map((category) => ({ value: category.id, label: category.name }))} /></FormField><FormField label="Display order" required error={errors.sortOrder?.message}><Controller name="sortOrder" control={control} render={({ field }) => <NumberInput min={0} max={9999} value={field.value} onChange={field.onChange} />} /></FormField><FormField label="Description" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register('description')} /></FormField><Controller name="isActive" control={control} render={({ field }) => <Switch label="Active category" checked={field.value} onChange={field.onChange} />} /></form></Modal>;
}

export function BrandFormModal({ item, onClose, onSave, isSaving }: Omit<FormModalProps<Brand>, 'onSave'> & { onSave: (values: BrandFormValues) => Promise<unknown> }) {
  const values: BrandFormValues = { name: item?.name ?? '', code: item?.code ?? '', description: item?.description ?? '', websiteUrl: item?.websiteUrl ?? '', logoUrl: item?.logoUrl ?? '', isActive: item?.isActive ?? true };
  const { register, control, handleSubmit, formState: { errors } } = useForm<BrandFormValues>({ resolver: zodResolver(brandFormSchema), values });
  const submit = async (form: BrandFormValues) => { try { await onSave(form); appToast.success(`Brand ${item ? 'updated' : 'created'}.`); onClose(); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to save brand.'); } };
  return <Modal isOpen onClose={onClose} title={item ? 'Edit Brand' : 'Add Brand'} maxWidth="680px" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="brand-form" isLoading={isSaving}>Save Brand</Button></>}><form id="brand-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((form) => void submit(form))}><FormField label="Name" required error={errors.name?.message}><TextInput {...register('name')} /></FormField><FormField label="Code" required error={errors.code?.message}><TextInput {...register('code')} /></FormField><FormField label="Website" error={errors.websiteUrl?.message}><TextInput type="url" {...register('websiteUrl')} placeholder="https://" /></FormField><FormField label="Logo URL" error={errors.logoUrl?.message}><TextInput type="url" {...register('logoUrl')} placeholder="https://" /></FormField><FormField label="Description" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register('description')} /></FormField><Controller name="isActive" control={control} render={({ field }) => <Switch label="Active brand" checked={field.value} onChange={field.onChange} />} /></form></Modal>;
}

export function UomFormModal({ item, onClose, onSave, isSaving }: Omit<FormModalProps<UOM>, 'onSave'> & { onSave: (values: UomFormValues) => Promise<unknown> }) {
  const values: UomFormValues = { name: item?.name ?? '', code: item?.code ?? '', symbol: item?.symbol ?? '', type: item?.type ?? 'count', decimalPlaces: item?.decimalPlaces ?? 0, description: item?.description ?? '', isDefault: item?.isDefault ?? false, isActive: item?.isActive ?? true };
  const { register, control, handleSubmit, formState: { errors } } = useForm<UomFormValues>({ resolver: zodResolver(uomFormSchema), values });
  const submit = async (form: UomFormValues) => { try { await onSave(form); appToast.success(`Unit of measure ${item ? 'updated' : 'created'}.`); onClose(); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to save unit of measure.'); } };
  return <Modal isOpen onClose={onClose} title={item ? 'Edit Unit of Measure' : 'Add Unit of Measure'} maxWidth="680px" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="uom-form" isLoading={isSaving}>Save Unit</Button></>}><form id="uom-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((form) => void submit(form))}><FormField label="Name" required error={errors.name?.message}><TextInput {...register('name')} /></FormField><FormField label="Code" required error={errors.code?.message}><TextInput {...register('code')} /></FormField><FormField label="Symbol" required error={errors.symbol?.message}><TextInput {...register('symbol')} /></FormField><FormField label="Unit type" required error={errors.type?.message}><Select {...register('type')} options={[{ value: 'count', label: 'Count' }, { value: 'weight', label: 'Weight' }, { value: 'volume', label: 'Volume' }, { value: 'length', label: 'Length' }, { value: 'time', label: 'Time' }, { value: 'service', label: 'Service' }]} /></FormField><FormField label="Decimal precision" required error={errors.decimalPlaces?.message}><Controller name="decimalPlaces" control={control} render={({ field }) => <NumberInput min={0} max={6} value={field.value} onChange={field.onChange} />} /></FormField><FormField label="Description" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register('description')} /></FormField><Controller name="isActive" control={control} render={({ field }) => <Switch label="Active unit" checked={field.value} onChange={field.onChange} />} /><Controller name="isDefault" control={control} render={({ field }) => <Switch label="Default / base unit" checked={field.value} onChange={field.onChange} />} /></form></Modal>;
}
