import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSection } from '@/shared/components/forms/FormSection';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Checkbox } from '@/shared/components/forms/Checkbox';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';
import type { Customer } from '@/features/customers/types/customer';

import { customerSchema, type CustomerFormValues } from '../schemas/customerSchema';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CustomerFormValues) => Promise<void>;
  customer?: Customer | null;
}

const FORM_ID = 'customer-form';

function generateCustomerCode() {
  return `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getDefaultValues(customer?: Customer | null): CustomerFormValues {
  if (customer) {
    return {
      name: customer.name,
      code: customer.code,
      type: customer.type,
      email: customer.email,
      phone: customer.phone,
      website: customer.website ?? '',
      taxNumber: customer.taxNumber ?? '',
      currency: customer.currency,
      creditLimit: customer.creditLimit,
      paymentTermsDays: customer.paymentTermsDays,
      status: customer.status,
      billingAddress: {
        street: customer.billingAddress.street,
        city: customer.billingAddress.city,
        state: customer.billingAddress.state ?? '',
        postalCode: customer.billingAddress.postalCode,
        country: customer.billingAddress.country,
      },
      shippingSameAsBilling: !customer.shippingAddress,
      shippingAddress: {
        street: customer.shippingAddress?.street ?? '',
        city: customer.shippingAddress?.city ?? '',
        state: customer.shippingAddress?.state ?? '',
        postalCode: customer.shippingAddress?.postalCode ?? '',
        country: customer.shippingAddress?.country ?? '',
      },
      primaryContact: {
        name: customer.primaryContact?.name ?? '',
        jobTitle: customer.primaryContact?.jobTitle ?? '',
        email: customer.primaryContact?.email ?? '',
        phone: customer.primaryContact?.phone ?? '',
      },
      notes: customer.notes ?? '',
    };
  }

  return {
    name: '',
    code: generateCustomerCode(),
    type: 'company',
    email: '',
    phone: '',
    website: '',
    taxNumber: '',
    currency: 'USD',
    creditLimit: undefined,
    paymentTermsDays: undefined,
    status: 'active',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    },
    shippingSameAsBilling: true,
    shippingAddress: { street: '', city: '', state: '', postalCode: '', country: '' },
    primaryContact: { name: '', jobTitle: '', email: '', phone: '' },
    notes: '',
  };
}

export function CustomerFormModal({ isOpen, onClose, onSubmit, customer }: CustomerFormModalProps) {
  const isEditing = Boolean(customer);
  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: getDefaultValues(customer),
  });
  const shippingSameAsBilling = watch('shippingSameAsBilling');

  useEffect(() => {
    if (isOpen) reset(getDefaultValues(customer));
  }, [customer, isOpen, reset]);

  const submitForm = async (data: CustomerFormValues) => {
    try {
      await onSubmit(data);
      appToast.success(isEditing ? 'Customer updated successfully.' : 'Customer created successfully.');
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Unable to save the customer. Please try again.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title={isEditing ? 'Edit Customer' : 'Create New Customer'}
      maxWidth="760px"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Customer'}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-6" noValidate onSubmit={handleSubmit(submitForm)}>
        <FormSection title="Customer Details" description="Core account and contact information.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Customer Name" htmlFor="customer-name" required error={errors.name?.message}>
              <TextInput id="customer-name" required error={Boolean(errors.name)} aria-describedby={errors.name ? 'customer-name-error' : undefined} placeholder="e.g. Acme Corp" {...register('name')} />
            </FormField>

            <FormField label="Customer Code" htmlFor="customer-code" required error={errors.code?.message}>
              <TextInput id="customer-code" required error={Boolean(errors.code)} aria-describedby={errors.code ? 'customer-code-error' : undefined} placeholder="e.g. CUST-0001" {...register('code')} />
            </FormField>

            <FormField label="Customer Type" htmlFor="customer-type" required error={errors.type?.message}>
              <Select id="customer-type" required error={Boolean(errors.type)} aria-describedby={errors.type ? 'customer-type-error' : undefined} options={[{ value: 'company', label: 'Company / Business' }, { value: 'individual', label: 'Individual Person' }]} {...register('type')} />
            </FormField>

            <FormField label="Status" htmlFor="customer-status" required error={errors.status?.message}>
              <Select id="customer-status" required error={Boolean(errors.status)} aria-describedby={errors.status ? 'customer-status-error' : undefined} options={[{ value: 'active', label: 'Active' }, { value: 'lead', label: 'Lead' }, { value: 'inactive', label: 'Inactive' }]} {...register('status')} />
            </FormField>

            <FormField label="Email Address" htmlFor="customer-email" required error={errors.email?.message}>
              <TextInput id="customer-email" type="email" required error={Boolean(errors.email)} aria-describedby={errors.email ? 'customer-email-error' : undefined} placeholder="billing@example.com" {...register('email')} />
            </FormField>

            <FormField label="Phone Number" htmlFor="customer-phone" required error={errors.phone?.message}>
              <TextInput id="customer-phone" type="tel" required error={Boolean(errors.phone)} aria-describedby={errors.phone ? 'customer-phone-error' : undefined} placeholder="+94 77 123 4567" {...register('phone')} />
            </FormField>

            <FormField label="Website" htmlFor="customer-website" error={errors.website?.message}>
              <TextInput id="customer-website" type="url" error={Boolean(errors.website)} aria-describedby={errors.website ? 'customer-website-error' : undefined} placeholder="https://example.com" {...register('website')} />
            </FormField>

            <FormField label="Tax Number" htmlFor="customer-tax-number" error={errors.taxNumber?.message}>
              <TextInput id="customer-tax-number" error={Boolean(errors.taxNumber)} aria-describedby={errors.taxNumber ? 'customer-tax-number-error' : undefined} placeholder="Tax registration number" {...register('taxNumber')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Commercial Terms">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Currency" htmlFor="customer-currency" required error={errors.currency?.message}>
              <Select id="customer-currency" required error={Boolean(errors.currency)} aria-describedby={errors.currency ? 'customer-currency-error' : undefined} options={[{ value: 'USD', label: 'USD' }, { value: 'LKR', label: 'LKR' }]} {...register('currency')} />
            </FormField>

            <FormField label="Credit Limit" htmlFor="customer-credit-limit" error={errors.creditLimit?.message} hint="Leave empty when no credit limit is assigned.">
              <Controller name="creditLimit" control={control} render={({ field: { value, onChange, ...field } }) => (
                <CurrencyInput {...field} id="customer-credit-limit" min={0} value={value ?? ''} error={Boolean(errors.creditLimit)} aria-describedby={errors.creditLimit ? 'customer-credit-limit-error' : 'customer-credit-limit-hint'} onChange={(nextValue) => onChange(nextValue === '' ? undefined : nextValue)} />
              )} />
            </FormField>

            <FormField label="Payment Terms" htmlFor="customer-payment-terms" error={errors.paymentTermsDays?.message} hint="Number of days before payment is due.">
              <Controller name="paymentTermsDays" control={control} render={({ field: { value, onChange, ...field } }) => (
                <NumberInput {...field} id="customer-payment-terms" min={0} step={1} value={value ?? ''} error={Boolean(errors.paymentTermsDays)} aria-describedby={errors.paymentTermsDays ? 'customer-payment-terms-error' : 'customer-payment-terms-hint'} placeholder="30" onChange={(nextValue) => onChange(nextValue === '' ? undefined : nextValue)} />
              )} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Billing Address">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField className="sm:col-span-2" label="Street Address" htmlFor="customer-street" error={errors.billingAddress?.street?.message}>
              <TextInput id="customer-street" error={Boolean(errors.billingAddress?.street)} aria-describedby={errors.billingAddress?.street ? 'customer-street-error' : undefined} placeholder="123 Business Way" {...register('billingAddress.street')} />
            </FormField>
            <FormField label="City" htmlFor="customer-city" error={errors.billingAddress?.city?.message}>
              <TextInput id="customer-city" error={Boolean(errors.billingAddress?.city)} aria-describedby={errors.billingAddress?.city ? 'customer-city-error' : undefined} placeholder="City" {...register('billingAddress.city')} />
            </FormField>
            <FormField label="State / Province" htmlFor="customer-state" error={errors.billingAddress?.state?.message}>
              <TextInput id="customer-state" error={Boolean(errors.billingAddress?.state)} aria-describedby={errors.billingAddress?.state ? 'customer-state-error' : undefined} placeholder="State or province" {...register('billingAddress.state')} />
            </FormField>
            <FormField label="Postal Code" htmlFor="customer-postal-code" error={errors.billingAddress?.postalCode?.message}>
              <TextInput id="customer-postal-code" error={Boolean(errors.billingAddress?.postalCode)} aria-describedby={errors.billingAddress?.postalCode ? 'customer-postal-code-error' : undefined} placeholder="Postal code" {...register('billingAddress.postalCode')} />
            </FormField>
            <FormField label="Country" htmlFor="customer-country" required error={errors.billingAddress?.country?.message}>
              <TextInput id="customer-country" required error={Boolean(errors.billingAddress?.country)} aria-describedby={errors.billingAddress?.country ? 'customer-country-error' : undefined} placeholder="Country" {...register('billingAddress.country')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Shipping Address" description="Use a separate delivery address when it differs from billing.">
          <div className="space-y-4">
            <Checkbox label="Shipping address is the same as billing" {...register('shippingSameAsBilling')} />
            {!shippingSameAsBilling && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField className="sm:col-span-2" label="Street Address" htmlFor="customer-shipping-street" error={errors.shippingAddress?.street?.message}>
                  <TextInput id="customer-shipping-street" error={Boolean(errors.shippingAddress?.street)} {...register('shippingAddress.street')} />
                </FormField>
                <FormField label="City" htmlFor="customer-shipping-city" error={errors.shippingAddress?.city?.message}>
                  <TextInput id="customer-shipping-city" error={Boolean(errors.shippingAddress?.city)} {...register('shippingAddress.city')} />
                </FormField>
                <FormField label="State / Province" htmlFor="customer-shipping-state" error={errors.shippingAddress?.state?.message}>
                  <TextInput id="customer-shipping-state" error={Boolean(errors.shippingAddress?.state)} {...register('shippingAddress.state')} />
                </FormField>
                <FormField label="Postal Code" htmlFor="customer-shipping-postal" error={errors.shippingAddress?.postalCode?.message}>
                  <TextInput id="customer-shipping-postal" error={Boolean(errors.shippingAddress?.postalCode)} {...register('shippingAddress.postalCode')} />
                </FormField>
                <FormField label="Country" htmlFor="customer-shipping-country" required error={errors.shippingAddress?.country?.message}>
                  <TextInput id="customer-shipping-country" error={Boolean(errors.shippingAddress?.country)} {...register('shippingAddress.country')} />
                </FormField>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Primary Contact" description="Main person for commercial and account communication.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Contact Name" htmlFor="customer-contact-name" error={errors.primaryContact?.name?.message}>
              <TextInput id="customer-contact-name" error={Boolean(errors.primaryContact?.name)} {...register('primaryContact.name')} />
            </FormField>
            <FormField label="Job Title" htmlFor="customer-contact-title" error={errors.primaryContact?.jobTitle?.message}>
              <TextInput id="customer-contact-title" error={Boolean(errors.primaryContact?.jobTitle)} {...register('primaryContact.jobTitle')} />
            </FormField>
            <FormField label="Contact Email" htmlFor="customer-contact-email" error={errors.primaryContact?.email?.message}>
              <TextInput id="customer-contact-email" type="email" error={Boolean(errors.primaryContact?.email)} {...register('primaryContact.email')} />
            </FormField>
            <FormField label="Contact Phone" htmlFor="customer-contact-phone" error={errors.primaryContact?.phone?.message}>
              <TextInput id="customer-contact-phone" type="tel" error={Boolean(errors.primaryContact?.phone)} {...register('primaryContact.phone')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Notes">
          <FormField label="Customer Notes" htmlFor="customer-notes" error={errors.notes?.message}>
            <Textarea id="customer-notes" rows={4} error={Boolean(errors.notes)} aria-describedby={errors.notes ? 'customer-notes-error' : undefined} placeholder="Account notes, preferences, or billing instructions" {...register('notes')} />
          </FormField>
        </FormSection>
      </form>
    </Modal>
  );
}
