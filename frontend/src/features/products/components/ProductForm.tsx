import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { isSalesTaxApplicable, useTaxRates } from '@/features/settings/finance/tax';
import { ProductOpeningStockSection, openingStockSchema, type OpeningStockFormValues } from '@/features/inventory';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSection } from '@/shared/components/forms/FormSection';
import { FormSubmitError } from '@/shared/components/forms/FormSubmitError';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Select } from '@/shared/components/forms/Select';
import { Switch } from '@/shared/components/forms/Switch';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { useBrandOptions, useCategoryOptions, useUomOptions } from '../hooks/useProductMasterData';
import { useProductIdentifierTools } from '../hooks/useProducts';
import { productFormSchema, type ProductFormValues } from '../schemas/productSchema';
import type { Product } from '../types/product';
import { ProductDocumentsSection } from './ProductDocumentsSection';
import { ProductImagesSection } from './ProductImagesSection';
import { ProductSpecificationsSection } from './ProductSpecificationsSection';
import { ProductBundleSection, ProductSuppliersSection, RelatedProductsSection } from './ProductRelationshipsSections';

interface ProductFormProps {
  initialData?: Product;
  imageProductId: string;
  canManageImages: boolean;
  documentProductId: string;
  canManageDocuments: boolean;
  canDownloadDocuments: boolean;
  specificationProductId: string;
  canManageSpecifications: boolean;
  canManagePrices: boolean;
  canManageLifecycle: boolean;
  canRecordOpeningStock: boolean;
  onSubmit: (values: ProductFormValues, openingStock?: OpeningStockFormValues) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  submitError?: string | null;
}

const typeOptions = [
  { value: 'goods', label: 'Product' },
  { value: 'service', label: 'Service' },
];

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived', disabled: true },
];

const barcodeTypeOptions = [
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'UPC_A', label: 'UPC-A' },
  { value: 'CODE128', label: 'Code 128' },
  { value: 'OTHER', label: 'Other / Internal' },
];

function defaultValues(product?: Product): ProductFormValues {
  return {
    name: product?.name ?? '',
    shortName: product?.shortName ?? '',
    sku: product?.sku ?? '',
    internalCode: product?.internalCode ?? '',
    barcode: product?.barcode ?? '',
    barcodeType: product?.barcodeType ?? 'EAN13',
    qrValue: product?.qrValue ?? '',
    brandId: product?.brandId ?? '',
    brand: product?.brand ?? '',
    description: product?.description ?? '',
    type: product?.type ?? 'goods',
    status: product?.status ?? 'draft',
    categoryId: product?.categoryId ?? '',
    uomId: product?.uomId ?? '',
    purchaseUomId: '',
    sellingPrice: product?.sellingPrice ?? 0,
    costPrice: product?.costPrice ?? 0,
    priceTiers: product?.priceTiers.map((tier) => ({ ...tier })) ?? [],
    taxCode: product?.taxCode ?? '',
    pricesIncludeTax: product?.pricesIncludeTax ?? false,
    isSellable: product?.isSellable ?? true,
    isPurchasable: product?.isPurchasable ?? true,
    trackInventory: product?.trackInventory ?? true,
    trackByBatch: product?.trackByBatch ?? false,
    trackBySerialNumber: product?.trackBySerialNumber ?? false,
    trackExpiry: product?.trackExpiry ?? false,
    allowNegativeStock: product?.allowNegativeStock ?? false,
    minStockLevel: product?.minStockLevel,
    reorderLevel: product?.reorderLevel,
    maxStockLevel: product?.maxStockLevel,
  };
}

export function ProductForm({
  initialData,
  imageProductId,
  canManageImages,
  documentProductId,
  canManageDocuments,
  canDownloadDocuments,
  specificationProductId,
  canManageSpecifications,
  canManagePrices,
  canManageLifecycle,
  canRecordOpeningStock,
  onSubmit,
  onCancel,
  isSaving = false,
  submitError,
}: ProductFormProps) {
  const categoryQuery = useCategoryOptions(Boolean(initialData));
  const brandQuery = useBrandOptions(Boolean(initialData));
  const uomQuery = useUomOptions(Boolean(initialData));
  const taxQuery = useTaxRates();
  const tenantCurrency = useTenantCurrency();
  const {
    generateSku,
    checkAvailability,
    isGeneratingSku,
    isCheckingIdentifiers,
  } = useProductIdentifierTools();
  const {
    control,
    handleSubmit,
    register,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultValues(initialData),
  });
  const priceTiers = useFieldArray({ control, name: 'priceTiers', keyName: 'formKey' });
  const defaultTaxApplied = useRef(Boolean(initialData));
  const productType = watch('type');
  const productName = watch('name');
  const selectedCategoryId = watch('categoryId');
  const selectedUomId = watch('uomId');
  const trackInventory = watch('trackInventory');
  const trackByBatch = watch('trackByBatch');
  const trackBySerialNumber = watch('trackBySerialNumber');
  const trackExpiry = watch('trackExpiry');
  const selectedTaxCode = watch('taxCode');
  const sellingPrice = watch('sellingPrice');
  const costPrice = watch('costPrice');
  const generatedSku = watch('sku');
  const isService = productType === 'service';
  const [openingStockEnabled, setOpeningStockEnabled] = useState(false);
  const [openingStockErrors, setOpeningStockErrors] = useState<Record<string, string>>({});
  const [openingStock, setOpeningStock] = useState<OpeningStockFormValues>({
    branchId: '',
    warehouseId: '',
    locationId: '',
    quantity: 0,
    batchReference: '',
    expiryDate: '',
    serialReferences: [],
    notes: '',
  });

  useEffect(() => {
    if (initialData || isService || !trackInventory) {
      setOpeningStockEnabled(false);
      setOpeningStockErrors({});
    }
  }, [initialData, isService, trackInventory]);

  const submitForm = async (values: ProductFormValues) => {
    if (!initialData && !isService && trackInventory && openingStockEnabled) {
      const parsed = openingStockSchema.safeParse(openingStock);
      const nextErrors: Record<string, string> = {};
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = String(issue.path[0] ?? 'openingStock');
          nextErrors[field] ??= issue.message;
        }
      }
      if (trackByBatch && !openingStock.batchReference?.trim()) nextErrors.batchReference = 'Batch reference is required.';
      if (trackExpiry && !openingStock.expiryDate?.trim()) nextErrors.expiryDate = 'Expiry date is required.';
      if (trackBySerialNumber) {
        if (!Number.isInteger(openingStock.quantity)) nextErrors.quantity = 'Serialized opening stock must use a whole quantity.';
        if (openingStock.serialReferences.length !== openingStock.quantity) nextErrors.serialReferences = 'Enter one serial number for every opening unit.';
        if (new Set(openingStock.serialReferences).size !== openingStock.serialReferences.length) nextErrors.serialReferences = 'Serial numbers must be unique.';
      }
      if (Object.keys(nextErrors).length || !parsed.success) {
        setOpeningStockErrors(nextErrors);
        return;
      }
      setOpeningStockErrors({});
      await onSubmit(values, {
        ...parsed.data,
        batchReference: trackByBatch ? parsed.data.batchReference : undefined,
        expiryDate: trackExpiry ? parsed.data.expiryDate : undefined,
        serialReferences: trackBySerialNumber ? parsed.data.serialReferences : [],
      });
      return;
    }
    setOpeningStockErrors({});
    await onSubmit(values);
  };

  useEffect(() => {
    if (initialData || productName.trim().length < 2) return;
    let active = true;
    const timeout = globalThis.setTimeout(() => {
      void generateSku({
        name: productName,
        categoryId: selectedCategoryId || undefined,
        type: productType,
      }).then((sku) => {
        if (!active) return;
        setValue('sku', sku, { shouldDirty: true, shouldValidate: true });
        clearErrors('sku');
      });
    }, 350);
    return () => {
      active = false;
      globalThis.clearTimeout(timeout);
    };
  }, [clearErrors, generateSku, initialData, productName, productType, selectedCategoryId, setValue]);

  const checkIdentifier = async (field: 'sku' | 'barcode' | 'qrValue', value?: string) => {
    if (!value?.trim()) {
      clearErrors(field);
      return;
    }
    const result = await checkAvailability({ [field]: value, excludeId: initialData?.id });
    const available = field === 'sku'
      ? result.skuAvailable
      : field === 'barcode'
        ? result.barcodeAvailable
        : result.qrValueAvailable;
    if (!available) {
      const message = field === 'sku'
        ? 'This SKU is already used by another product.'
        : field === 'barcode'
          ? 'This barcode is already used by another product.'
          : 'This QR value is already used by another product.';
      setError(field, { type: 'validate', message });
    } else {
      clearErrors(field);
    }
  };

  const taxOptions = useMemo(() => {
    const activeTaxes = taxQuery.taxes.filter((tax) => isSalesTaxApplicable(tax));
    const options = activeTaxes.map((tax) => ({
      value: tax.code,
      label: `${tax.name} (${tax.percentage}%)`,
    }));
    if (initialData?.taxCode && !options.some((option) => option.value === initialData.taxCode)) {
      const existingTax = taxQuery.taxes.find((tax) => tax.code === initialData.taxCode);
      options.push({
        value: initialData.taxCode,
        label: existingTax ? `${existingTax.name} (${existingTax.percentage}%) - Unavailable` : `${initialData.taxCode} - Unavailable`,
      });
    }
    return [{ value: '', label: 'No tax / Tax exempt' }, ...options];
  }, [initialData, taxQuery.taxes]);

  useEffect(() => {
    if (isService || defaultTaxApplied.current || selectedTaxCode) return;
    const defaultTax = taxQuery.taxes.find(
      (tax) => tax.isDefault && isSalesTaxApplicable(tax),
    );
    if (defaultTax) {
      defaultTaxApplied.current = true;
      setValue('taxCode', defaultTax.code);
    }
  }, [initialData, isService, selectedTaxCode, setValue, taxQuery.taxes]);

  useEffect(() => {
    if (initialData || isService || selectedUomId) return;
    const defaultUom = (uomQuery.data ?? []).find((uom) => uom.isDefault && uom.isActive);
    if (!defaultUom) return;
    setValue('uomId', defaultUom.id, { shouldValidate: true });
  }, [initialData, isService, selectedUomId, setValue, uomQuery.data]);

  const categoryOptions = (categoryQuery.data ?? []).map((category) => ({
    value: category.id,
    label: `${category.name} (${category.code})${category.isActive ? '' : ' - Inactive'}`,
    disabled: !category.isActive && category.id !== initialData?.categoryId,
  }));
  const brandOptions = (brandQuery.data ?? []).map((brand) => ({
    value: brand.id,
    label: `${brand.name} (${brand.code})${brand.isActive ? '' : ' - Inactive'}`,
    disabled: !brand.isActive && brand.id !== initialData?.brandId,
  }));
  const uomOptions = (uomQuery.data ?? []).map((uom) => ({
    value: uom.id,
    label: `${uom.name} (${uom.symbol})${uom.isActive ? '' : ' - Inactive'}`,
    disabled: !uom.isActive && initialData?.uomId !== uom.id,
  }));
  const busy = isSaving || isSubmitting || isCheckingIdentifiers;
  const barcodeField = register('barcode');

  return (
    <form className="space-y-6" onSubmit={handleSubmit(submitForm)} noValidate>
      <FormSubmitError message={submitError ?? null} />

      <Card>
        <FormSection title="Product Identity" description="Core tenant product identifiers and classification.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Product type" required error={errors.type?.message} className="sm:col-span-2 lg:col-span-3">
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    options={typeOptions}
                    value={field.value}
                    onChange={(event) => {
                      const nextType = event.target.value as ProductFormValues['type'];
                      field.onChange(nextType);
                      if (nextType === 'service') {
                        setValue('barcode', '', { shouldDirty: true, shouldValidate: true });
                        setValue('brandId', '', { shouldDirty: true });
                        setValue('uomId', '', { shouldDirty: true, shouldValidate: true });
                        setValue('costPrice', 0, { shouldDirty: true });
                        setValue('taxCode', '', { shouldDirty: true });
                        setValue('pricesIncludeTax', false, { shouldDirty: true });
                        setValue('isPurchasable', false, { shouldDirty: true });
                        setValue('trackInventory', false, { shouldDirty: true });
                        setValue('allowNegativeStock', false, { shouldDirty: true });
                        setValue('trackByBatch', false, { shouldDirty: true });
                        setValue('trackBySerialNumber', false, { shouldDirty: true });
                        setValue('trackExpiry', false, { shouldDirty: true });
                        setValue('minStockLevel', undefined, { shouldDirty: true });
                        setValue('reorderLevel', undefined, { shouldDirty: true });
                        setValue('maxStockLevel', undefined, { shouldDirty: true });
                        priceTiers.replace([]);
                        clearErrors(['barcode', 'barcodeType', 'brandId', 'uomId', 'minStockLevel', 'reorderLevel', 'maxStockLevel']);
                      }
                    }}
                  />
                )}
              />
            </FormField>
            <FormField label={isService ? 'Service name' : 'Product name'} required error={errors.name?.message} className="sm:col-span-2">
              <TextInput {...register('name')} placeholder={isService ? 'e.g. On-site installation' : 'e.g. Wireless Keyboard and Mouse Set'} />
            </FormField>
            <FormField label="Status" required error={errors.status?.message}>
              <Select options={statusOptions} disabled={!canManageLifecycle} {...register('status')} />
            </FormField>
            <FormField label={isService ? 'Service code' : 'Product Code / SKU'} required error={errors.sku?.message} hint={`Automatically generated from the category and ${isService ? 'service' : 'product'} name.`}>
              <TextInput
                value={generatedSku}
                readOnly
                placeholder="Generated after entering a product name"
                className="font-mono bg-slate-50"
              />
            </FormField>
            {!isService && (
              <>
                <FormField label="Barcode format" error={errors.barcodeType?.message}>
                  <Select options={barcodeTypeOptions} {...register('barcodeType')} />
                </FormField>
                <FormField label="Barcode" error={errors.barcode?.message} hint="Optional master-data identifier; scanner setup is managed separately.">
                  <TextInput
                    {...barcodeField}
                    placeholder="EAN, UPC or internal barcode"
                    onBlur={(event) => {
                      void barcodeField.onBlur(event);
                      void checkIdentifier('barcode', event.target.value);
                    }}
                  />
                </FormField>
              </>
            )}
            <FormField label={isService ? 'Service category' : 'Category'} required error={errors.categoryId?.message}>
              <Select
                options={categoryOptions}
                placeholder={categoryQuery.isLoading ? 'Loading categories...' : 'Select category...'}
                disabled={categoryQuery.isLoading}
                {...register('categoryId')}
              />
            </FormField>
            {!isService && (
              <FormField label="Brand" error={errors.brandId?.message ?? (brandQuery.error ? 'Unable to load brands.' : undefined)}>
                <Select {...register('brandId')} options={brandOptions} placeholder={brandQuery.isLoading ? 'Loading brands...' : 'No brand'} disabled={brandQuery.isLoading} />
              </FormField>
            )}
            <FormField label={isService ? 'Short service name' : 'Short name'} error={errors.shortName?.message}>
              <TextInput {...register('shortName')} placeholder={isService ? 'Optional short service name' : 'Optional display name'} />
            </FormField>
            <FormField label={isService ? 'Service description' : 'Description'} error={errors.description?.message} className="sm:col-span-2 lg:col-span-3">
              <Textarea {...register('description')} rows={3} placeholder={isService ? 'Describe the service scope and delivery details...' : 'Product description and master-data notes...'} />
            </FormField>
            <details className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Advanced identifiers
              </summary>
              <p className="mt-1 text-xs text-slate-500">
                The system code is generated automatically. Add an internal reference only when your company needs one.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  {isGeneratingSku ? 'Generating code…' : generatedSku || 'Code will appear after entering a name.'}
                </div>
                <FormField label="Internal code" error={errors.internalCode?.message} hint="Optional company-specific reference.">
                  <TextInput {...register('internalCode')} placeholder="Optional internal reference" />
                </FormField>
              </div>
            </details>
          </div>
        </FormSection>
      </Card>

      <Card>
        <FormSection title={isService ? 'Service Pricing' : 'Pricing & Tax'} description={isService ? 'Set the standard charge for this service.' : 'Tenant-level default pricing, quantity tiers and shared Tax/VAT treatment.'}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!isService && <FormField label="Purchase / cost price" required error={errors.costPrice?.message} hint="Default product cost; supplier pricing is managed separately.">
              <Controller
                name="costPrice"
                control={control}
                render={({ field }) => <CurrencyInput currency={tenantCurrency.currencyLabel} min={0} value={field.value} onChange={field.onChange} disabled={!canManagePrices} />}
              />
            </FormField>}
            <FormField label={isService ? 'Service price' : 'Selling price'} required error={errors.sellingPrice?.message}>
              <Controller
                name="sellingPrice"
                control={control}
                render={({ field }) => <CurrencyInput currency={tenantCurrency.currencyLabel} min={0} value={field.value} onChange={field.onChange} disabled={!canManagePrices} />}
              />
            </FormField>
            {!isService && (
            <FormField label="Gross margin" hint={`Company currency: ${tenantCurrency.currencyCode ?? 'Loading…'}`}>
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                {sellingPrice > 0 ? `${(((sellingPrice - costPrice) / sellingPrice) * 100).toFixed(1)}%` : '0.0%'}
              </div>
            </FormField>
            )}
            {!isService && (
            <>
            <FormField label="Sales tax" error={errors.taxCode?.message ?? (taxQuery.error || undefined)}>
              <Select
                options={taxOptions}
                placeholder={taxQuery.isLoading ? 'Loading tax rates...' : 'Select tax...'}
                disabled={taxQuery.isLoading || !canManagePrices}
                value={selectedTaxCode}
                onChange={(event) => setValue('taxCode', event.target.value, { shouldDirty: true, shouldValidate: true })}
              />
            </FormField>
            <Controller
              name="pricesIncludeTax"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} disabled={!selectedTaxCode || !canManagePrices} label="Selling price includes tax" />
              )}
            />
            </>
            )}
          </div>

          {!isService && (
          <div className="mt-6 border-t border-slate-200 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Wholesale / Price Tiers</h3>
                <p className="mt-1 text-xs text-slate-500">Optional quantity thresholds for future POS, web store and customer-tier pricing.</p>
              </div>
              {canManagePrices && <Button type="button" size="sm" variant="secondary" leftIcon={<Plus size={15} />} onClick={() => priceTiers.append({ name: '', minimumQuantity: 1, price: 0 })}>Add Tier</Button>}
            </div>
            {priceTiers.fields.length ? (
              <div className="mt-4 space-y-3">
                {priceTiers.fields.map((tier, index) => (
                  <div key={tier.formKey} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_180px_180px_auto]">
                    <FormField label="Tier name" error={errors.priceTiers?.[index]?.name?.message}>
                      <TextInput {...register(`priceTiers.${index}.name`)} placeholder="e.g. Wholesale" disabled={!canManagePrices} />
                    </FormField>
                    <FormField label="Minimum quantity" error={errors.priceTiers?.[index]?.minimumQuantity?.message}>
                      <Controller name={`priceTiers.${index}.minimumQuantity`} control={control} render={({ field }) => <NumberInput min={1} step={1} value={field.value} onChange={field.onChange} disabled={!canManagePrices} />} />
                    </FormField>
                    <FormField label="Tier price" error={errors.priceTiers?.[index]?.price?.message}>
                      <Controller name={`priceTiers.${index}.price`} control={control} render={({ field }) => <CurrencyInput currency={tenantCurrency.currencyLabel} min={0.01} value={field.value} onChange={field.onChange} disabled={!canManagePrices} />} />
                    </FormField>
                    {canManagePrices && <div className="flex items-end">
                      <Button type="button" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" leftIcon={<Trash2 size={15} />} onClick={() => priceTiers.remove(index)}>Remove</Button>
                    </div>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No wholesale price tiers configured.</p>
            )}
          </div>
          )}
        </FormSection>
      </Card>

      <Card>
        <FormSection
          title={isService ? 'Service Availability' : 'Sales, Purchasing & Stock'}
          description={isService ? 'Control whether this service is available for sales.' : 'Product eligibility, one shared unit for sales, purchasing and stock, and master-level stock thresholds.'}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {!isService && <FormField label="Unit of measure" required error={errors.uomId?.message} hint={!initialData ? 'The tenant default unit is selected automatically; you can choose another unit.' : undefined}>
              <Select
                options={uomOptions}
                placeholder={uomQuery.isLoading ? 'Loading units...' : 'Select unit...'}
                disabled={uomQuery.isLoading}
                {...register('uomId')}
              />
            </FormField>}
            <Controller name="isSellable" control={control} render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Available for sales" />} />
            {!isService && (
              <>
                <Controller name="isPurchasable" control={control} render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Available for purchasing" />} />
                <Controller name="trackInventory" control={control} render={({ field }) => <Switch checked={field.value} onChange={(event) => { field.onChange(event); if (!event.target.checked) { setValue('trackByBatch', false, { shouldDirty: true }); setValue('trackBySerialNumber', false, { shouldDirty: true }); setValue('trackExpiry', false, { shouldDirty: true }); } }} label="Track inventory" />} />
                <Controller name="allowNegativeStock" control={control} render={({ field }) => <Switch checked={field.value} onChange={field.onChange} disabled={!trackInventory} label="Allow negative stock" />} />
              </>
            )}
          </div>

          {!isService && trackInventory && (
            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Minimum stock" error={errors.minStockLevel?.message}>
                  <Controller name="minStockLevel" control={control} render={({ field }) => <NumberInput min={0} value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? undefined : value)} />} />
                </FormField>
                <FormField label="Reorder level" error={errors.reorderLevel?.message}>
                  <Controller name="reorderLevel" control={control} render={({ field }) => <NumberInput min={0} value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? undefined : value)} />} />
                </FormField>
                <FormField label="Maximum stock" error={errors.maxStockLevel?.message}>
                  <Controller name="maxStockLevel" control={control} render={({ field }) => <NumberInput min={0} value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? undefined : value)} />} />
                </FormField>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-semibold text-slate-900">Inventory Traceability</h3>
                <p className="mt-1 text-xs text-slate-500">Configuration for future receiving and stock workflows; no batch, serial or expiry records are created here.</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <FormField error={errors.trackByBatch?.message} hint="Capture lot or batch references during future stock transactions.">
                    <Controller name="trackByBatch" control={control} render={({ field }) => <Switch checked={field.value} error={Boolean(errors.trackByBatch)} onChange={(event) => { field.onChange(event); if (!event.target.checked) setValue('trackExpiry', false, { shouldDirty: true }); }} label="Track by batch" />} />
                  </FormField>
                  <FormField error={errors.trackBySerialNumber?.message} hint="Capture a unique serial number for each stock unit.">
                    <Controller name="trackBySerialNumber" control={control} render={({ field }) => <Switch checked={field.value} error={Boolean(errors.trackBySerialNumber)} onChange={field.onChange} label="Track by serial number" />} />
                  </FormField>
                  <FormField error={errors.trackExpiry?.message} hint={trackByBatch ? 'Capture expiry dates on future batch/stock records.' : 'Enable batch tracking before expiry tracking.'}>
                    <Controller name="trackExpiry" control={control} render={({ field }) => <Switch checked={field.value} error={Boolean(errors.trackExpiry)} disabled={!trackByBatch} onChange={field.onChange} label="Track expiry" />} />
                  </FormField>
                </div>
              </div>
            </div>
          )}
        </FormSection>
      </Card>

      {!initialData && !isService && trackInventory && (
        <ProductOpeningStockSection
          enabled={openingStockEnabled}
          canRecord={canRecordOpeningStock}
          value={openingStock}
          errors={openingStockErrors}
          trackByBatch={trackByBatch}
          trackBySerialNumber={trackBySerialNumber}
          trackExpiry={trackExpiry}
          costPrice={costPrice}
          currency={tenantCurrency.currencyCode ?? 'Loading…'}
          onEnabledChange={(enabled) => {
            setOpeningStockEnabled(enabled);
            setOpeningStockErrors({});
          }}
          onChange={(value) => {
            setOpeningStock(value);
            setOpeningStockErrors({});
          }}
        />
      )}

      {initialData && !isService && <ProductSuppliersSection productId={initialData.id} canManage={canManageSpecifications} canManagePrices={canManagePrices} />}

      {initialData && productType === 'composite' && <ProductBundleSection product={initialData} canManage={canManageSpecifications} canManagePrices={canManagePrices} />}

      {initialData && <RelatedProductsSection productId={initialData.id} canManage={canManageSpecifications} />}

      <ProductSpecificationsSection productId={specificationProductId} canManage={canManageSpecifications} />

      {!isService && <ProductImagesSection productId={imageProductId} canManage={canManageImages} />}

      <ProductDocumentsSection
        productId={documentProductId}
        canManage={canManageDocuments}
        canDownload={canDownloadDocuments}
      />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button
          type="submit"
          leftIcon={<Save size={16} />}
          isLoading={busy}
          disabled={busy || (Boolean(initialData) && !isDirty)}
        >
          {initialData ? 'Save Changes' : isService ? 'Create Service' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
