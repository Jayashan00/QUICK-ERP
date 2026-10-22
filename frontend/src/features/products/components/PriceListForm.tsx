import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { priceListFormSchema, type PriceListFormValues } from '../schemas/priceListSchema';
import type { PriceList } from '../types/priceList';

interface PriceListFormProps {
  priceList?: PriceList | null;
  onSubmit: (values: PriceListFormValues) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function PriceListForm({ priceList, onSubmit, onCancel, isSaving }: PriceListFormProps) {
  const tenantCurrency = useTenantCurrency();
  const values: PriceListFormValues = {
    name: priceList?.name ?? '',
    code: priceList?.code ?? '',
    description: priceList?.description ?? '',
    type: priceList?.type ?? 'retail',
    currency: priceList?.currency ?? tenantCurrency.currencyCode ?? '',
    status: priceList?.status ?? 'active',
    effectiveStartDate: priceList?.effectiveStartDate ?? '',
    effectiveEndDate: priceList?.effectiveEndDate ?? '',
  };
  const { register, handleSubmit, formState: { errors } } = useForm<PriceListFormValues>({ resolver: zodResolver(priceListFormSchema), values });

  return (
    <form onSubmit={handleSubmit((form) => void onSubmit(form))} className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">Price List Information</h2>
          <p className="mt-1 text-sm text-slate-500">Configure tenant-level pricing metadata. Product rules are managed from the detail screen.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" htmlFor="price-list-name" required error={errors.name?.message}>
            <TextInput id="price-list-name" {...register('name')} autoFocus />
          </FormField>
          <FormField label="Code" htmlFor="price-list-code" required error={errors.code?.message}>
            <TextInput id="price-list-code" {...register('code')} className="uppercase" />
          </FormField>
          <FormField label="Type" htmlFor="price-list-type" required error={errors.type?.message}>
            <Select id="price-list-type" {...register('type')} options={[{ value: 'retail', label: 'Retail' }, { value: 'wholesale', label: 'Wholesale' }, { value: 'distributor', label: 'Distributor' }, { value: 'custom', label: 'Custom' }]} />
          </FormField>
          <FormField label="Status" htmlFor="price-list-status" required error={errors.status?.message}>
            <Select id="price-list-status" {...register('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, ...(priceList?.status === 'archived' ? [{ value: 'archived', label: 'Archived' }] : [])]} />
          </FormField>
          <FormField label="Currency" htmlFor="price-list-currency" required error={errors.currency?.message} hint="Inherited from Currency & Localization settings.">
            <TextInput id="price-list-currency" value={values.currency} disabled />
            <input type="hidden" {...register('currency')} />
          </FormField>
          <div aria-hidden="true" className="hidden sm:block" />
          <FormField label="Effective start date" htmlFor="price-list-start" error={errors.effectiveStartDate?.message}>
            <TextInput id="price-list-start" type="date" {...register('effectiveStartDate')} />
          </FormField>
          <FormField label="Effective end date" htmlFor="price-list-end" error={errors.effectiveEndDate?.message}>
            <TextInput id="price-list-end" type="date" {...register('effectiveEndDate')} />
          </FormField>
          <FormField label="Description" htmlFor="price-list-description" error={errors.description?.message} className="sm:col-span-2">
            <Textarea id="price-list-description" {...register('description')} rows={4} />
          </FormField>
        </div>
      </Card>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isSaving}>Save Price List</Button>
      </div>
    </form>
  );
}
