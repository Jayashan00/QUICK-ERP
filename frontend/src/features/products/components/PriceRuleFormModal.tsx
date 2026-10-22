import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { Button } from '@/shared/components/common/Button';
import { IconButton } from '@/shared/components/common/IconButton';
import { Modal } from '@/shared/components/common/Modal';
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput';
import { FormField } from '@/shared/components/forms/FormField';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Select } from '@/shared/components/forms/Select';
import { appToast } from '@/shared/utils/toast';
import { usePriceRuleProductOptions, usePriceRules } from '../hooks/usePriceLists';
import { useProductVariants } from '../hooks/useProductVariants';
import { priceRuleFormSchema, type PriceRuleFormValues } from '../schemas/priceListSchema';
import type { PriceRuleListItem } from '../types/priceList';

interface PriceRuleFormModalProps {
  priceListId: string;
  rule?: PriceRuleListItem | null;
  onClose: () => void;
}

export function PriceRuleFormModal({ priceListId, rule, onClose }: PriceRuleFormModalProps) {
  const data = usePriceRules(priceListId);
  const currency = useTenantCurrency();
  const products = usePriceRuleProductOptions();
  const defaults: PriceRuleFormValues = {
    productId: rule?.productId ?? '',
    variantId: rule?.variantId ?? '',
    pricingType: rule?.pricingType ?? 'fixed',
    fixedPrice: rule?.fixedPrice,
    tiers: rule?.tiers.map((tier) => ({ ...tier })) ?? [],
  };
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<PriceRuleFormValues>({ resolver: zodResolver(priceRuleFormSchema), defaultValues: defaults });
  const tiers = useFieldArray({ control, name: 'tiers' });
  const productId = watch('productId');
  const pricingType = watch('pricingType');
  const variants = useProductVariants(productId);

  useEffect(() => {
    if (pricingType === 'fixed' && tiers.fields.length) setValue('tiers', []);
    if (pricingType === 'quantity_tier' && !tiers.fields.length) setValue('tiers', [{ minQuantity: 1, maxQuantity: 9, price: 0 }]);
  }, [pricingType, setValue, tiers.fields.length]);

  const submit = async (values: PriceRuleFormValues) => {
    try {
      if (rule) await data.update(rule.id, values);
      else await data.create(values);
      appToast.success(`Pricing rule ${rule ? 'updated' : 'created'}.`);
      onClose();
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to save the pricing rule.');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={rule ? 'Edit Pricing Rule' : 'Add Pricing Rule'} maxWidth="860px" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="price-rule-form" isLoading={data.isSaving}>Save Rule</Button></>}>
      <form id="price-rule-form" onSubmit={handleSubmit((values) => void submit(values))} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Product" required error={errors.productId?.message}>
            <Controller name="productId" control={control} render={({ field }) => <Select value={field.value} onChange={(event) => { field.onChange(event.target.value); setValue('variantId', ''); }} placeholder={products.isLoading ? 'Loading products...' : 'Select product'} options={(products.data ?? []).map((product) => ({ value: product.id, label: `${product.name} (${product.sku})` }))} disabled={products.isLoading} />} />
          </FormField>
          <FormField label="Variant" error={errors.variantId?.message} hint="Leave empty to price the parent product.">
            <Controller name="variantId" control={control} render={({ field }) => <Select {...field} placeholder={productId ? 'Parent product' : 'Select a product first'} disabled={!productId || variants.isLoading} options={variants.variants.filter((variant) => variant.status === 'active').map((variant) => ({ value: variant.id, label: `${variant.attributes.map((attribute) => attribute.value).join(' / ')} (${variant.sku})` }))} />} />
          </FormField>
          <FormField label="Pricing method" required error={errors.pricingType?.message}>
            <Controller name="pricingType" control={control} render={({ field }) => <Select {...field} options={[{ value: 'fixed', label: 'Fixed price' }, { value: 'quantity_tier', label: 'Quantity tiers' }]} />} />
          </FormField>
          {pricingType === 'fixed' && <FormField label="Fixed price" required error={errors.fixedPrice?.message} hint="Overrides the default selling price for any quantity.">
            <Controller name="fixedPrice" control={control} render={({ field }) => <CurrencyInput currency={currency.currencyLabel} min={0} value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? undefined : value)} />} />
          </FormField>}
        </div>

        {pricingType === 'quantity_tier' && (
          <div className="rounded-xl border border-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="font-semibold text-slate-900">Quantity Tiers</h3><p className="text-sm text-slate-500">Ranges are inclusive. Leave the final maximum empty for an open-ended tier.</p></div>
              <Button type="button" variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={() => tiers.append({ minQuantity: 1, maxQuantity: undefined, price: 0 })}>Add Tier</Button>
            </div>
            <div className="space-y-3 p-4">
              {errors.tiers?.root?.message && <p className="text-sm text-red-600" role="alert">{errors.tiers.root.message}</p>}
              {tiers.fields.map((tier, index) => (
                <div key={tier.id} className="grid items-start gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1.25fr_auto]">
                  <FormField label="Minimum" error={errors.tiers?.[index]?.minQuantity?.message}><Controller name={`tiers.${index}.minQuantity`} control={control} render={({ field }) => <NumberInput min={1} step={1} value={field.value} onChange={(value) => field.onChange(value === '' ? 1 : value)} />} /></FormField>
                  <FormField label="Maximum" error={errors.tiers?.[index]?.maxQuantity?.message}><Controller name={`tiers.${index}.maxQuantity`} control={control} render={({ field }) => <NumberInput min={1} step={1} placeholder="No limit" value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? undefined : value)} />} /></FormField>
                  <FormField label="Price" error={errors.tiers?.[index]?.price?.message}><Controller name={`tiers.${index}.price`} control={control} render={({ field }) => <CurrencyInput currency={currency.currencyLabel} min={0} value={field.value} onChange={(value) => field.onChange(value === '' ? 0 : value)} />} /></FormField>
                  <div className="pt-7"><IconButton type="button" icon={<Trash2 size={16} />} label={`Remove tier ${index + 1}`} className="text-red-600 hover:bg-red-50" onClick={() => tiers.remove(index)} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
