import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSection } from '@/shared/components/forms/FormSection';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';
import type { Lead } from '@/features/crm/leads/types/lead';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';

import { leadSchema, type LeadFormValues } from '../schemas/leadSchema';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LeadFormValues) => Promise<void>;
  lead?: Lead | null;
}

const FORM_ID = 'lead-form';

const sourceOptions = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'event', label: 'Event' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'other', label: 'Other' },
];

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'lost', label: 'Lost' },
];


const lostReasonOptions = [
  { value: 'price', label: 'Price' },
  { value: 'competitor', label: 'Lost to competitor' },
  { value: 'timing', label: 'Timing' },
  { value: 'no_budget', label: 'No budget' },
  { value: 'no_response', label: 'No response' },
  { value: 'not_a_fit', label: 'Not a fit' },
  { value: 'other', label: 'Other' },
];

function generateLeadCode() {
  return `LEAD-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getDefaultValues(lead?: Lead | null): LeadFormValues {
  if (lead) {
    return {
      code: lead.code,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company ?? '',
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      status: lead.status,
      assignedTo: lead.assignedTo ?? '',
      estimatedValue: lead.estimatedValue,
      nextFollowUpAt: lead.nextFollowUpAt ?? '',
      notes: lead.notes ?? '',
      lostReason: lead.lostReason,
      lostNote: lead.lostNote ?? '',
    };
  }

  return {
    code: generateLeadCode(),
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    phone: '',
    source: 'website',
    status: 'new',
    assignedTo: '',
    estimatedValue: undefined,
    nextFollowUpAt: '',
    notes: '',
    lostReason: undefined,
    lostNote: '',
  };
}

export function LeadFormModal({ isOpen, onClose, onSubmit, lead }: LeadFormModalProps) {
  const { users } = useUserOptions();
  const assignedUserOptions = users.map(user => ({ value: user.id, label: user.name }));
  const isEditing = Boolean(lead);
  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: getDefaultValues(lead),
  });
  const selectedStatus = watch('status');

  useEffect(() => {
    if (isOpen) reset(getDefaultValues(lead));
  }, [isOpen, lead, reset]);

  const submitForm = async (data: LeadFormValues) => {
    try {
      await onSubmit(data);
      appToast.success(isEditing ? 'Lead updated successfully.' : 'Lead created successfully.');
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Unable to save the lead. Please try again.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title={isEditing ? 'Edit Lead' : 'Create New Lead'}
      maxWidth="720px"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Lead'}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-6" noValidate onSubmit={handleSubmit(submitForm)}>
        <FormSection title="Lead Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Lead Code" htmlFor="lead-code" required error={errors.code?.message}>
              <TextInput id="lead-code" required error={Boolean(errors.code)} aria-describedby={errors.code ? 'lead-code-error' : undefined} placeholder="LEAD-0001" {...register('code')} />
            </FormField>
            <FormField label="Company" htmlFor="lead-company" error={errors.company?.message}>
              <TextInput id="lead-company" error={Boolean(errors.company)} aria-describedby={errors.company ? 'lead-company-error' : undefined} placeholder="Company name" {...register('company')} />
            </FormField>
            <FormField label="First Name" htmlFor="lead-first-name" required error={errors.firstName?.message}>
              <TextInput id="lead-first-name" required error={Boolean(errors.firstName)} aria-describedby={errors.firstName ? 'lead-first-name-error' : undefined} placeholder="First name" {...register('firstName')} />
            </FormField>
            <FormField label="Last Name" htmlFor="lead-last-name" required error={errors.lastName?.message}>
              <TextInput id="lead-last-name" required error={Boolean(errors.lastName)} aria-describedby={errors.lastName ? 'lead-last-name-error' : undefined} placeholder="Last name" {...register('lastName')} />
            </FormField>
            <FormField label="Email Address" htmlFor="lead-email" required error={errors.email?.message}>
              <TextInput id="lead-email" type="email" required error={Boolean(errors.email)} aria-describedby={errors.email ? 'lead-email-error' : undefined} placeholder="lead@example.com" {...register('email')} />
            </FormField>
            <FormField label="Phone Number" htmlFor="lead-phone" required error={errors.phone?.message}>
              <TextInput id="lead-phone" type="tel" required error={Boolean(errors.phone)} aria-describedby={errors.phone ? 'lead-phone-error' : undefined} placeholder="+94 77 123 4567" {...register('phone')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Qualification">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Lead Source" htmlFor="lead-source" required error={errors.source?.message}>
              <Select id="lead-source" required error={Boolean(errors.source)} aria-describedby={errors.source ? 'lead-source-error' : undefined} options={sourceOptions} {...register('source')} />
            </FormField>
            <FormField label="Status" htmlFor="lead-status" required error={errors.status?.message}>
              <Select
                id="lead-status"
                required
                error={Boolean(errors.status)}
                aria-describedby={errors.status ? 'lead-status-error' : undefined}
                options={lead?.status === 'converted' ? [{ value: 'converted', label: 'Converted' }] : statusOptions}
                {...register('status')}
              />
            </FormField>
            <FormField label="Assigned To" htmlFor="lead-assigned-to" error={errors.assignedTo?.message}>
              <Select id="lead-assigned-to" placeholder="Select salesperson" error={Boolean(errors.assignedTo)} aria-describedby={errors.assignedTo ? 'lead-assigned-to-error' : undefined} options={assignedUserOptions} {...register('assignedTo')} />
            </FormField>
            <FormField label="Next Follow-up" htmlFor="lead-next-follow-up" error={errors.nextFollowUpAt?.message}>
              <DatePicker id="lead-next-follow-up" error={Boolean(errors.nextFollowUpAt)} aria-describedby={errors.nextFollowUpAt ? 'lead-next-follow-up-error' : undefined} {...register('nextFollowUpAt')} />
            </FormField>
            <FormField label="Estimated Value" htmlFor="lead-estimated-value" error={errors.estimatedValue?.message}>
              <Controller name="estimatedValue" control={control} render={({ field: { value, onChange, ...field } }) => (
                <CurrencyInput {...field} id="lead-estimated-value" min={0} value={value ?? ''} error={Boolean(errors.estimatedValue)} aria-describedby={errors.estimatedValue ? 'lead-estimated-value-error' : undefined} placeholder="0.00" onChange={(nextValue) => onChange(nextValue === '' ? undefined : nextValue)} />
              )} />
            </FormField>
            {selectedStatus === 'lost' && (
              <>
                <FormField label="Lost Reason" htmlFor="lead-lost-reason" required error={errors.lostReason?.message}>
                  <Select id="lead-lost-reason" placeholder="Select reason" error={Boolean(errors.lostReason)} options={lostReasonOptions} {...register('lostReason')} />
                </FormField>
                <FormField className="sm:col-span-2" label="Lost Note" htmlFor="lead-lost-note" error={errors.lostNote?.message}>
                  <Textarea id="lead-lost-note" rows={3} error={Boolean(errors.lostNote)} placeholder="Record what was learned and any future follow-up..." {...register('lostNote')} />
                </FormField>
              </>
            )}
          </div>
        </FormSection>

        <FormSection title="Notes">
          <FormField label="Lead Notes" htmlFor="lead-notes" error={errors.notes?.message}>
            <Textarea id="lead-notes" rows={4} error={Boolean(errors.notes)} aria-describedby={errors.notes ? 'lead-notes-error' : undefined} placeholder="Add notes about this lead..." {...register('notes')} />
          </FormField>
        </FormSection>
      </form>
    </Modal>
  );
}
