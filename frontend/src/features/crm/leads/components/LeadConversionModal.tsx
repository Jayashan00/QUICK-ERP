import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSection } from '@/shared/components/forms/FormSection';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';
import type { Lead } from '@/features/crm/leads/types/lead';

import { leadConversionSchema, type LeadConversionFormValues } from '../schemas/leadConversionSchema';

interface LeadConversionModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LeadConversionFormValues) => Promise<void>;
}

const FORM_ID = 'lead-conversion-form';

function getDefaultValues(lead: Lead | null): LeadConversionFormValues {
  return {
    customerName: lead?.company || `${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim(),
    customerType: lead?.company ? 'company' : 'individual',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    currency: 'USD',
    street: '',
    city: '',
    postalCode: '',
    country: 'US',
    notes: lead?.notes ?? '',
  };
}

export function LeadConversionModal({ lead, isOpen, onClose, onSubmit }: LeadConversionModalProps) {
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadConversionFormValues>({
    resolver: zodResolver(leadConversionSchema),
    defaultValues: getDefaultValues(lead),
  });

  useEffect(() => {
    if (isOpen) reset(getDefaultValues(lead));
  }, [isOpen, lead, reset]);

  const submitForm = async (data: LeadConversionFormValues) => {
    try {
      await onSubmit(data);
      appToast.success('Lead converted to a customer successfully.');
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Unable to convert the lead. Please try again.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title="Convert Lead to Customer"
      maxWidth="700px"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting}>Convert to Customer</Button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-6" noValidate onSubmit={handleSubmit(submitForm)}>
        <FormSection title="Customer Details" description="Confirm the account information created from this lead.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField className="sm:col-span-2" label="Customer Name" htmlFor="conversion-name" required error={errors.customerName?.message}>
              <TextInput id="conversion-name" required error={Boolean(errors.customerName)} aria-describedby={errors.customerName ? 'conversion-name-error' : undefined} {...register('customerName')} />
            </FormField>
            <FormField label="Customer Type" htmlFor="conversion-type" required error={errors.customerType?.message}>
              <Select id="conversion-type" required error={Boolean(errors.customerType)} aria-describedby={errors.customerType ? 'conversion-type-error' : undefined} options={[{ value: 'company', label: 'Company / Business' }, { value: 'individual', label: 'Individual Person' }]} {...register('customerType')} />
            </FormField>
            <FormField label="Currency" htmlFor="conversion-currency" required error={errors.currency?.message}>
              <Select id="conversion-currency" required error={Boolean(errors.currency)} aria-describedby={errors.currency ? 'conversion-currency-error' : undefined} options={[{ value: 'USD', label: 'USD' }, { value: 'LKR', label: 'LKR' }]} {...register('currency')} />
            </FormField>
            <FormField label="Email" htmlFor="conversion-email" required error={errors.email?.message}>
              <TextInput id="conversion-email" type="email" required error={Boolean(errors.email)} aria-describedby={errors.email ? 'conversion-email-error' : undefined} {...register('email')} />
            </FormField>
            <FormField label="Phone" htmlFor="conversion-phone" required error={errors.phone?.message}>
              <TextInput id="conversion-phone" type="tel" required error={Boolean(errors.phone)} aria-describedby={errors.phone ? 'conversion-phone-error' : undefined} {...register('phone')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Billing Address">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField className="sm:col-span-2" label="Street Address" htmlFor="conversion-street" error={errors.street?.message}>
              <TextInput id="conversion-street" error={Boolean(errors.street)} aria-describedby={errors.street ? 'conversion-street-error' : undefined} placeholder="Street address" {...register('street')} />
            </FormField>
            <FormField label="City" htmlFor="conversion-city" error={errors.city?.message}>
              <TextInput id="conversion-city" error={Boolean(errors.city)} aria-describedby={errors.city ? 'conversion-city-error' : undefined} placeholder="City" {...register('city')} />
            </FormField>
            <FormField label="Postal Code" htmlFor="conversion-postal-code" error={errors.postalCode?.message}>
              <TextInput id="conversion-postal-code" error={Boolean(errors.postalCode)} aria-describedby={errors.postalCode ? 'conversion-postal-code-error' : undefined} placeholder="Postal code" {...register('postalCode')} />
            </FormField>
            <FormField className="sm:col-span-2" label="Country" htmlFor="conversion-country" required error={errors.country?.message}>
              <TextInput id="conversion-country" required error={Boolean(errors.country)} aria-describedby={errors.country ? 'conversion-country-error' : undefined} placeholder="Country" {...register('country')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Notes">
          <FormField label="Customer Notes" htmlFor="conversion-notes" error={errors.notes?.message}>
            <Textarea id="conversion-notes" rows={4} error={Boolean(errors.notes)} aria-describedby={errors.notes ? 'conversion-notes-error' : undefined} {...register('notes')} />
          </FormField>
        </FormSection>
      </form>
    </Modal>
  );
}
