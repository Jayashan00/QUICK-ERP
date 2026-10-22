import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles, Save, X } from 'lucide-react';

import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSection } from '@/shared/components/forms/FormSection';
import { FormSubmitError } from '@/shared/components/forms/FormSubmitError';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Select } from '@/shared/components/forms/Select';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Textarea } from '@/shared/components/forms/Textarea';
import { getErrorMessage } from '@/shared/validation';

import {
  supplierSchema,
  SUPPLIER_STATUS_OPTIONS,
  SUPPLIER_CATEGORY_OPTIONS,
  SUPPLIER_TAX_CATEGORIES,
  SUPPLIER_CURRENCIES,
  SUPPLIER_COUNTRIES,
  SUPPLIER_PAYMENT_METHOD_OPTIONS,
  SUPPLIER_PAYMENT_TERM_OPTIONS,
  type SupplierFormValues,
} from '../schemas/supplier.schema';

interface SupplierFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<SupplierFormValues>;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  canEditStatus?: boolean;
}

function generateSupplierCode() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SUP-${rand}`;
}

const defaultFormValues: SupplierFormValues = {
  code: '',
  name: '',
  category: '',
  contactPerson: '',
  email: '',
  phone: '',
  mobile: '',
  website: '',
  taxNumber: '',
  vatNumber: '',
  taxCategory: '',
  registrationNumber: '',
  currency: 'USD',
  paymentTermsDays: 30,
  paymentMethod: 'bank_transfer',
  bankDetails: {
    bankName: '',
    accountName: '',
    accountNumber: '',
    branch: '',
    branchCode: '',
    swiftCode: '',
    iban: '',
    currency: 'USD',
  },
  status: 'active',
  address: {
    street: '',
    street2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  },
  notes: '',
};


export function SupplierForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isLoading = false,
  canEditStatus = true,
}: SupplierFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      ...defaultFormValues,
      code: mode === 'create' ? generateSupplierCode() : '',
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      reset({
        ...defaultFormValues,
        ...initialValues,
      });
    }
  }, [initialValues, reset]);

  const handleFormSubmit = async (data: SupplierFormValues) => {
    setSubmitError(null);
    try {
      await onSubmit(data);
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Failed to save supplier. Please check the form.'));
    }
  };

  const handleGenerateCode = () => {
    setValue('code', generateSupplierCode(), { shouldValidate: true, shouldDirty: true });
  };

  const isPending = isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-6">
      {submitError && <FormSubmitError message={submitError} />}

      <Card className="p-6">
        <div className="space-y-6">
          {/* Section 1: Supplier Basic Information & Classification */}
          <FormSection
            title="Supplier Information"
            description="Core details identifying the vendor or supplier in your directory."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                label="Supplier Name"
                htmlFor="supplier-name"
                required
                error={errors.name?.message}
              >
                <TextInput
                  id="supplier-name"
                  placeholder="e.g. Acme Industrial Supplies"
                  error={Boolean(errors.name)}
                  {...register('name')}
                />
              </FormField>

              <FormField
                label="Supplier Code"
                htmlFor="supplier-code"
                required
                error={errors.code?.message}
                hint={mode === 'create' ? 'Auto-generated or custom code' : undefined}
              >
                <div className="flex gap-2">
                  <TextInput
                    id="supplier-code"
                    placeholder="e.g. SUP-0001"
                    error={Boolean(errors.code)}
                    className="font-mono text-sm uppercase"
                    readOnly={mode === 'edit'}
                    {...register('code')}
                  />
                  {mode === 'create' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleGenerateCode}
                      title="Generate new code"
                      className="shrink-0"
                    >
                      <Sparkles size={14} className="text-slate-500" />
                      <span className="sr-only sm:not-sr-only sm:ml-1">Auto</span>
                    </Button>
                  )}
                </div>
              </FormField>

              <FormField
                label="Category / Classification"
                htmlFor="supplier-category"
                error={errors.category?.message}
              >
                <Select
                  id="supplier-category"
                  options={[
                    { value: '', label: 'Select category...' },
                    ...SUPPLIER_CATEGORY_OPTIONS,
                  ]}
                  error={Boolean(errors.category)}
                  {...register('category')}
                />
              </FormField>

              <FormField
                label="Supplier Status"
                htmlFor="supplier-status"
                required
                error={errors.status?.message}
                hint={!canEditStatus ? 'You do not have permission to modify status' : undefined}
              >
                <Select
                  id="supplier-status"
                  options={SUPPLIER_STATUS_OPTIONS}
                  error={Boolean(errors.status)}
                  disabled={!canEditStatus}
                  {...register('status')}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Section 2: Contact Information */}
          <FormSection
            title="Contact Information"
            description="Primary liaison, mobile, email, and digital presence for communications."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Contact Person"
                htmlFor="supplier-contact"
                required
                error={errors.contactPerson?.message}
              >
                <TextInput
                  id="supplier-contact"
                  placeholder="e.g. Jane Doe"
                  error={Boolean(errors.contactPerson)}
                  {...register('contactPerson')}
                />
              </FormField>

              <FormField
                label="Email Address"
                htmlFor="supplier-email"
                required
                error={errors.email?.message}
              >
                <TextInput
                  id="supplier-email"
                  type="email"
                  placeholder="e.g. sales@vendor.com"
                  error={Boolean(errors.email)}
                  {...register('email')}
                />
              </FormField>

              <FormField
                label="Primary Phone Number"
                htmlFor="supplier-phone"
                required
                error={errors.phone?.message}
              >
                <TextInput
                  id="supplier-phone"
                  type="tel"
                  placeholder="e.g. +1-555-0199"
                  error={Boolean(errors.phone)}
                  {...register('phone')}
                />
              </FormField>

              <FormField
                label="Mobile Phone"
                htmlFor="supplier-mobile"
                error={errors.mobile?.message}
                hint="Direct line or mobile number (optional)"
              >
                <TextInput
                  id="supplier-mobile"
                  type="tel"
                  placeholder="e.g. +1-555-0288"
                  error={Boolean(errors.mobile)}
                  {...register('mobile')}
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField
                  label="Website"
                  htmlFor="supplier-website"
                  error={errors.website?.message}
                >
                  <TextInput
                    id="supplier-website"
                    type="url"
                    placeholder="https://www.example.com"
                    error={Boolean(errors.website)}
                    {...register('website')}
                  />
                </FormField>
              </div>
            </div>
          </FormSection>

          {/* Section 3: Physical Address Information */}
          <FormSection
            title="Address Information"
            description="Mailing, headquarters, or warehouse location for shipping and invoicing."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <FormField
                  label="Address Line 1"
                  htmlFor="supplier-street"
                  required
                  error={errors.address?.street?.message}
                >
                  <TextInput
                    id="supplier-street"
                    placeholder="e.g. 100 Industrial Parkway"
                    error={Boolean(errors.address?.street)}
                    {...register('address.street')}
                  />
                </FormField>
              </div>

              <FormField
                label="Address Line 2"
                htmlFor="supplier-street2"
                error={errors.address?.street2?.message}
                hint="Suite, building, floor, dock (optional)"
              >
                <TextInput
                  id="supplier-street2"
                  placeholder="e.g. Suite 400, Building B"
                  error={Boolean(errors.address?.street2)}
                  {...register('address.street2')}
                />
              </FormField>

              <FormField
                label="City"
                htmlFor="supplier-city"
                required
                error={errors.address?.city?.message}
              >
                <TextInput
                  id="supplier-city"
                  placeholder="e.g. Chicago"
                  error={Boolean(errors.address?.city)}
                  {...register('address.city')}
                />
              </FormField>

              <FormField
                label="State / Province"
                htmlFor="supplier-state"
                error={errors.address?.state?.message}
              >
                <TextInput
                  id="supplier-state"
                  placeholder="e.g. IL"
                  error={Boolean(errors.address?.state)}
                  {...register('address.state')}
                />
              </FormField>

              <FormField
                label="Postal / Zip Code"
                htmlFor="supplier-postal"
                required
                error={errors.address?.postalCode?.message}
              >
                <TextInput
                  id="supplier-postal"
                  placeholder="e.g. 60601"
                  error={Boolean(errors.address?.postalCode)}
                  {...register('address.postalCode')}
                />
              </FormField>

              <FormField
                label="Country"
                htmlFor="supplier-country"
                required
                error={errors.address?.country?.message}
              >
                <Select
                  id="supplier-country"
                  options={SUPPLIER_COUNTRIES.map((c) => ({ value: c.value, label: c.label }))}
                  error={Boolean(errors.address?.country)}
                  {...register('address.country')}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Section 4: Tax / VAT Information */}
          <FormSection
            title="Tax / VAT Information"
            description="Fiscal identifiers, tax category, and formal business registration details."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                label="Tax ID"
                htmlFor="supplier-tax"
                error={errors.taxNumber?.message}
                hint="Primary tax ID or EIN"
              >
                <TextInput
                  id="supplier-tax"
                  placeholder="e.g. US-TAX-12345"
                  error={Boolean(errors.taxNumber)}
                  {...register('taxNumber')}
                />
              </FormField>

              <FormField
                label="VAT Number"
                htmlFor="supplier-vat"
                error={errors.vatNumber?.message}
                hint="Value-added tax number"
              >
                <TextInput
                  id="supplier-vat"
                  placeholder="e.g. GB999999973"
                  error={Boolean(errors.vatNumber)}
                  {...register('vatNumber')}
                />
              </FormField>

              <FormField
                label="Tax Category"
                htmlFor="supplier-tax-category"
                error={errors.taxCategory?.message}
              >
                <Select
                  id="supplier-tax-category"
                  options={[
                    { value: '', label: 'Select tax category...' },
                    ...SUPPLIER_TAX_CATEGORIES,
                  ]}
                  error={Boolean(errors.taxCategory)}
                  {...register('taxCategory')}
                />
              </FormField>

              <FormField
                label="Registration Number"
                htmlFor="supplier-registration"
                error={errors.registrationNumber?.message}
                hint="Corporate or trade register ID"
              >
                <TextInput
                  id="supplier-registration"
                  placeholder="e.g. REG-8829104"
                  error={Boolean(errors.registrationNumber)}
                  {...register('registrationNumber')}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Section 5: Payment Settings */}
          <FormSection
            title="Payment Settings"
            description="Currency, agreed payment terms, and preferred disbursement method."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Commercial Currency"
                htmlFor="supplier-currency"
                required
                error={errors.currency?.message}
              >
                <Select
                  id="supplier-currency"
                  options={SUPPLIER_CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
                  error={Boolean(errors.currency)}
                  {...register('currency')}
                />
              </FormField>

              <FormField
                label="Payment Terms Preset"
                htmlFor="supplier-terms-preset"
                hint="Quick select standard settlement window"
              >
                <Controller
                  name="paymentTermsDays"
                  control={control}
                  render={({ field }) => {
                    const currentVal = field.value !== undefined ? String(field.value) : '';
                    const isKnownPreset = ['0', '15', '30', '45', '60', '90'].includes(currentVal);
                    const selectVal = isKnownPreset ? currentVal : (currentVal ? 'custom' : '30');

                    return (
                      <Select
                        id="supplier-terms-preset"
                        options={SUPPLIER_PAYMENT_TERM_OPTIONS}
                        value={selectVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== 'custom') {
                            field.onChange(Number(val));
                          }
                        }}
                      />
                    );
                  }}
                />
              </FormField>

              <FormField
                label="Payment Terms (Days)"
                htmlFor="supplier-terms"
                error={errors.paymentTermsDays?.message}
                hint="Net payment period in whole days (0 to 365)"
              >
                <Controller
                  name="paymentTermsDays"
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      id="supplier-terms"
                      min={0}
                      max={365}
                      step={1}
                      placeholder="e.g. 30"
                      value={field.value ?? ''}
                      onChange={(val) => field.onChange(val === undefined ? undefined : Number(val))}
                      error={Boolean(errors.paymentTermsDays)}
                    />
                  )}
                />
              </FormField>

              <div className="sm:col-span-2 lg:col-span-3">
                <FormField
                  label="Preferred Payment Method"
                  htmlFor="supplier-payment-method"
                  error={errors.paymentMethod?.message}
                  hint="Primary settlement method used when generating purchase disbursements"
                >
                  <Select
                    id="supplier-payment-method"
                    options={[
                      { value: '', label: 'Select payment method...' },
                      ...SUPPLIER_PAYMENT_METHOD_OPTIONS,
                    ]}
                    error={Boolean(errors.paymentMethod)}
                    {...register('paymentMethod')}
                  />
                </FormField>
              </div>
            </div>
          </FormSection>

          {/* Section 6: Bank / Payment Details */}
          <FormSection
            title="Bank / Payment Details"
            description="Banking account information for electronic fund transfers (EFT/ACH/Wire). Account numbers are masked when viewed."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Bank Name"
                htmlFor="supplier-bank-name"
                error={errors.bankDetails?.bankName?.message}
              >
                <TextInput
                  id="supplier-bank-name"
                  placeholder="e.g. JPMorgan Chase Bank"
                  error={Boolean(errors.bankDetails?.bankName)}
                  {...register('bankDetails.bankName')}
                />
              </FormField>

              <FormField
                label="Account Name / Holder"
                htmlFor="supplier-account-name"
                error={errors.bankDetails?.accountName?.message}
              >
                <TextInput
                  id="supplier-account-name"
                  placeholder="e.g. Acme Supplies LLC"
                  error={Boolean(errors.bankDetails?.accountName)}
                  {...register('bankDetails.accountName')}
                />
              </FormField>

              <FormField
                label="Account Number"
                htmlFor="supplier-account-number"
                error={errors.bankDetails?.accountNumber?.message}
                hint="Stored securely and masked in overview"
              >
                <TextInput
                  id="supplier-account-number"
                  placeholder="e.g. 1234567890"
                  error={Boolean(errors.bankDetails?.accountNumber)}
                  {...register('bankDetails.accountNumber')}
                />
              </FormField>

              <FormField
                label="Branch Name"
                htmlFor="supplier-branch"
                error={errors.bankDetails?.branch?.message}
              >
                <TextInput
                  id="supplier-branch"
                  placeholder="e.g. Main Commercial Branch"
                  error={Boolean(errors.bankDetails?.branch)}
                  {...register('bankDetails.branch')}
                />
              </FormField>

              <FormField
                label="Branch Code / Routing"
                htmlFor="supplier-branch-code"
                error={errors.bankDetails?.branchCode?.message}
              >
                <TextInput
                  id="supplier-branch-code"
                  placeholder="e.g. 021000021"
                  error={Boolean(errors.bankDetails?.branchCode)}
                  {...register('bankDetails.branchCode')}
                />
              </FormField>

              <FormField
                label="SWIFT / BIC Code"
                htmlFor="supplier-swift"
                error={errors.bankDetails?.swiftCode?.message}
                hint="Required for international wire transfers"
              >
                <TextInput
                  id="supplier-swift"
                  placeholder="e.g. CHASUS33"
                  className="uppercase font-mono text-sm"
                  error={Boolean(errors.bankDetails?.swiftCode)}
                  {...register('bankDetails.swiftCode')}
                />
              </FormField>

              <FormField
                label="IBAN"
                htmlFor="supplier-iban"
                error={errors.bankDetails?.iban?.message}
                hint="International Bank Account Number"
              >
                <TextInput
                  id="supplier-iban"
                  placeholder="e.g. US44CHAS0210000211234567890"
                  className="uppercase font-mono text-sm"
                  error={Boolean(errors.bankDetails?.iban)}
                  {...register('bankDetails.iban')}
                />
              </FormField>

              <FormField
                label="Account Currency"
                htmlFor="supplier-bank-currency"
                error={errors.bankDetails?.currency?.message}
              >
                <Select
                  id="supplier-bank-currency"
                  options={[
                    { value: '', label: 'Same as supplier currency' },
                    ...SUPPLIER_CURRENCIES.map((c) => ({ value: c.value, label: c.label })),
                  ]}
                  error={Boolean(errors.bankDetails?.currency)}
                  {...register('bankDetails.currency')}
                />
              </FormField>
            </div>
          </FormSection>


          {/* Section 6: Additional Information */}
          <FormSection
            title="Additional Information"
            description="Internal notes, delivery terms, or procurement instructions."
          >
            <FormField
              label="Internal Notes"
              htmlFor="supplier-notes"
              error={errors.notes?.message}
            >
              <Textarea
                id="supplier-notes"
                rows={3}
                placeholder="Add any specific vendor requirements, contract terms, or special conditions..."
                error={Boolean(errors.notes)}
                {...register('notes')}
              />
            </FormField>
          </FormSection>
        </div>
      </Card>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isPending}
          leftIcon={<X size={16} />}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isPending}
          leftIcon={<Save size={16} />}
        >
          {mode === 'create' ? 'Create Supplier' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
