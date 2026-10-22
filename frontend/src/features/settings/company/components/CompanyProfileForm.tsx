import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, RotateCcw } from 'lucide-react';
import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { FormSection } from '@/shared/components/forms/FormSection';
import type { Company } from '@/features/settings/company/types/company';
import { companySchema, type CompanyFormValues } from '@/features/settings/company/schemas/companySchema';
import { CompanyLogoUpload } from '@/features/settings/company/components/CompanyLogoUpload';

interface CompanyProfileFormProps {
  initialData: Company;
  onSubmit: (data: CompanyFormValues) => Promise<void>;
  isLoading?: boolean;
  canEdit?: boolean;
}

export function CompanyProfileForm({
  initialData,
  onSubmit,
  isLoading = false,
  canEdit = true,
}: CompanyProfileFormProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: initialData.name,
      legalName: initialData.legalName,
      registrationNumber: initialData.registrationNumber || '',
      taxNumber: initialData.taxNumber || '',
      email: initialData.email,
      phone: initialData.phone,
      website: initialData.website || '',
      logoUrl: initialData.logoUrl || '',
      address: {
        street: initialData.address.street || '',
        city: initialData.address.city || '',
        state: initialData.address.state || '',
        postalCode: initialData.address.postalCode || '',
        country: initialData.address.country || '',
      },
    },
  });

  useEffect(() => {
    reset({
      name: initialData.name,
      legalName: initialData.legalName,
      registrationNumber: initialData.registrationNumber || '',
      taxNumber: initialData.taxNumber || '',
      email: initialData.email,
      phone: initialData.phone,
      website: initialData.website || '',
      logoUrl: initialData.logoUrl || '',
      address: {
        street: initialData.address.street || '',
        city: initialData.address.city || '',
        state: initialData.address.state || '',
        postalCode: initialData.address.postalCode || '',
        country: initialData.address.country || '',
      },
    });
  }, [initialData, reset]);

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Branding Section */}
        <FormSection
          title="Company Logo & Branding"
          description="Your official brand visual for reports, invoices, and quotations."
        >
          <Controller
            name="logoUrl"
            control={control}
            render={({ field }) => (
              <CompanyLogoUpload
                value={field.value}
                onChange={field.onChange}
                disabled={!canEdit || isSubmitting || isLoading}
              />
            )}
          />
        </FormSection>

        {/* Basic Information */}
        <FormSection
          title="Basic Information"
          description="Core legal name, registered business identity, and tax identifiers."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Company Name"
              htmlFor="comp-name"
              required
              error={errors.name?.message}
            >
              <TextInput
                id="comp-name"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.name)}
                placeholder="e.g. Acme Corporation"
                {...register('name')}
              />
            </FormField>

            <FormField
              label="Legal Entity Name"
              htmlFor="comp-legal-name"
              required
              error={errors.legalName?.message}
            >
              <TextInput
                id="comp-legal-name"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.legalName)}
                placeholder="e.g. Acme Global Technologies Inc."
                {...register('legalName')}
              />
            </FormField>

            <FormField
              label="Business Registration Number"
              htmlFor="comp-reg-number"
              error={errors.registrationNumber?.message}
            >
              <TextInput
                id="comp-reg-number"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.registrationNumber)}
                placeholder="e.g. REG-2024-884920"
                {...register('registrationNumber')}
              />
            </FormField>

            <FormField
              label="Tax / VAT Number"
              htmlFor="comp-tax-number"
              error={errors.taxNumber?.message}
            >
              <TextInput
                id="comp-tax-number"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.taxNumber)}
                placeholder="e.g. TAX-US-99384721"
                {...register('taxNumber')}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Contact Information */}
        <FormSection
          title="Contact Details"
          description="Primary organization communication channels for invoices and notifications."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              label="Official Email"
              htmlFor="comp-email"
              required
              error={errors.email?.message}
            >
              <TextInput
                id="comp-email"
                type="email"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.email)}
                placeholder="contact@company.com"
                {...register('email')}
              />
            </FormField>

            <FormField
              label="Primary Phone"
              htmlFor="comp-phone"
              required
              error={errors.phone?.message}
            >
              <TextInput
                id="comp-phone"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.phone)}
                placeholder="+1 (555) 000-0000"
                {...register('phone')}
              />
            </FormField>

            <FormField
              label="Website URL"
              htmlFor="comp-website"
              error={errors.website?.message}
            >
              <TextInput
                id="comp-website"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.website)}
                placeholder="https://example.com"
                {...register('website')}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Registered Address */}
        <FormSection
          title="Registered Headquarters Address"
          description="Legal physical address shown on official tax bills and declarations."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Street Address"
                htmlFor="comp-street"
                required
                error={errors.address?.street?.message}
              >
                <TextInput
                  id="comp-street"
                  disabled={!canEdit || isSubmitting || isLoading}
                  error={Boolean(errors.address?.street)}
                  placeholder="Street name, suite, or building"
                  {...register('address.street')}
                />
              </FormField>
            </div>

            <FormField
              label="City"
              htmlFor="comp-city"
              required
              error={errors.address?.city?.message}
            >
              <TextInput
                id="comp-city"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.address?.city)}
                placeholder="e.g. New York"
                {...register('address.city')}
              />
            </FormField>

            <FormField
              label="State / Province"
              htmlFor="comp-state"
              error={errors.address?.state?.message}
            >
              <TextInput
                id="comp-state"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.address?.state)}
                placeholder="e.g. NY"
                {...register('address.state')}
              />
            </FormField>

            <FormField
              label="Postal / ZIP Code"
              htmlFor="comp-postal-code"
              required
              error={errors.address?.postalCode?.message}
            >
              <TextInput
                id="comp-postal-code"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.address?.postalCode)}
                placeholder="e.g. 10001"
                {...register('address.postalCode')}
              />
            </FormField>

            <FormField
              label="Country"
              htmlFor="comp-country"
              required
              error={errors.address?.country?.message}
            >
              <TextInput
                id="comp-country"
                disabled={!canEdit || isSubmitting || isLoading}
                error={Boolean(errors.address?.country)}
                placeholder="e.g. United States"
                {...register('address.country')}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Form Actions */}
        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<RotateCcw size={16} />}
              disabled={!isDirty || isSubmitting || isLoading}
              onClick={() => reset()}
            >
              Discard Changes
            </Button>

            <Button
              type="submit"
              variant="primary"
              leftIcon={<Save size={16} />}
              isLoading={isSubmitting || isLoading}
              disabled={!isDirty && !isLoading}
            >
              Save Changes
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
