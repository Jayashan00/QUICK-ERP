import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSection } from '@/shared/components/forms/FormSection';
import { FormSubmitError } from '@/shared/components/forms/FormSubmitError';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { getErrorMessage } from '@/shared/validation';
import type { Opportunity } from '@/features/crm/opportunities/types/opportunity';
import { OPPORTUNITY_STAGES, OPPORTUNITY_STATUSES } from '@/features/crm/opportunities/types/opportunity';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';
import { mockCustomers } from '@/features/customers/mocks';
import { mockLeads } from '@/features/crm/leads/mocks';

import { opportunitySchema, type OpportunityFormValues } from '../schemas/opportunitySchema';

interface OpportunityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OpportunityFormValues) => Promise<void>;
  opportunity?: Opportunity | null;
}

const FORM_ID = 'opportunity-form';

const stageOptions = OPPORTUNITY_STAGES.map((s) => ({ value: s.value, label: s.label }));
const statusOptions = OPPORTUNITY_STATUSES.map((s) => ({ value: s.value, label: s.label }));
const lostReasonOptions = [
  { value: 'price', label: 'Price' },
  { value: 'competitor', label: 'Lost to competitor' },
  { value: 'timing', label: 'Timing' },
  { value: 'no_budget', label: 'No budget' },
  { value: 'no_decision', label: 'No decision' },
  { value: 'other', label: 'Other' },
];


const customerOptions = mockCustomers.map((c) => ({ value: c.id, label: c.name }));
const leadOptions = mockLeads.map((lead) => ({
  value: lead.id,
  label: `${lead.firstName} ${lead.lastName}${lead.company ? ` - ${lead.company}` : ''}`,
}));

function generateCode() {
  return `OPP-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getDefaultValues(opp?: Opportunity | null): OpportunityFormValues {
  if (opp) {
    return {
      code: opp.code,
      name: opp.name,
      customerId: opp.customerId ?? '',
      customerName: opp.customerName ?? '',
      leadId: opp.leadId ?? '',
      leadName: opp.leadName ?? '',
      salesOwnerId: opp.salesOwnerId ?? '',
      salesOwnerName: opp.salesOwnerName ?? '',
      stage: opp.stage,
      status: opp.status,
      expectedCloseDate: opp.expectedCloseDate ?? '',
      expectedValue: opp.expectedValue,
      probability: opp.probability,
      description: opp.description ?? '',
      notes: opp.notes ?? '',
      lostReason: opp.lostReason,
      lostNote: opp.lostNote ?? '',
    };
  }

  return {
    code: generateCode(),
    name: '',
    customerId: '',
    customerName: '',
    leadId: '',
    leadName: '',
    salesOwnerId: '',
    salesOwnerName: '',
    stage: 'prospecting',
    status: 'open',
    expectedCloseDate: '',
    expectedValue: 0,
    probability: 20,
    description: '',
    notes: '',
    lostReason: undefined,
    lostNote: '',
  };
}

export function OpportunityFormModal({
  isOpen,
  onClose,
  onSubmit,
  opportunity,
}: OpportunityFormModalProps) {
  const { users } = useUserOptions({ includeInactive: true });
  const salesOwnerOptions = users.map(user => ({ value: user.id, label: user.name }));
  const isEditing = Boolean(opportunity);
  const {
    control,
    handleSubmit,
    register,
    reset,
    setError,
    clearErrors,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: getDefaultValues(opportunity),
  });
  const selectedStage = watch('stage');
  const selectedStatus = watch('status');
  const isLost = selectedStage === 'closed_lost' || selectedStatus === 'lost';

  useEffect(() => {
    if (isOpen) reset(getDefaultValues(opportunity));
  }, [isOpen, opportunity, reset]);

  const submitForm = async (data: OpportunityFormValues) => {
    clearErrors('root.server');
    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      setError('root.server', {
        type: 'server',
        message: getErrorMessage(error, 'Unable to save the opportunity. Please try again.'),
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title={isEditing ? 'Edit Opportunity' : 'Create New Opportunity'}
      maxWidth="720px"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Opportunity'}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-6" noValidate onSubmit={handleSubmit(submitForm)}>
        <FormSubmitError message={errors.root?.server?.message} />

        <FormSection title="Opportunity Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Opportunity Code" htmlFor="opp-code" required error={errors.code?.message}>
              <TextInput id="opp-code" required error={Boolean(errors.code)} placeholder="OPP-0001" {...register('code')} />
            </FormField>
            <FormField label="Opportunity Name" htmlFor="opp-name" required error={errors.name?.message}>
              <TextInput id="opp-name" required error={Boolean(errors.name)} placeholder="Enter opportunity name" {...register('name')} />
            </FormField>
            <FormField label="Customer" htmlFor="opp-customer" error={errors.customerId?.message}>
              <Select
                id="opp-customer"
                placeholder="Select customer"
                error={Boolean(errors.customerId)}
                options={customerOptions}
                {...register('customerId')}
                onChange={(e) => {
                  const selected = customerOptions.find((c) => c.value === e.target.value);
                  setValue('customerId', e.target.value);
                  setValue('customerName', selected?.label ?? '');
                }}
              />
            </FormField>
            <FormField label="Source Lead" htmlFor="opp-lead" error={errors.leadId?.message}>
              <Select
                id="opp-lead"
                placeholder="Select lead (optional)"
                error={Boolean(errors.leadId)}
                options={leadOptions}
                {...register('leadId')}
                onChange={(event) => {
                  const selected = mockLeads.find((lead) => lead.id === event.target.value);
                  setValue('leadId', event.target.value);
                  setValue('leadName', selected ? `${selected.firstName} ${selected.lastName}` : '');
                }}
              />
            </FormField>
            <FormField label="Sales Owner" htmlFor="opp-sales-owner" error={errors.salesOwnerId?.message}>
              <Select
                id="opp-sales-owner"
                placeholder="Select sales owner"
                error={Boolean(errors.salesOwnerId)}
                options={salesOwnerOptions}
                {...register('salesOwnerId')}
                onChange={(e) => {
                  const selected = salesOwnerOptions.find((o) => o.value === e.target.value);
                  setValue('salesOwnerId', e.target.value);
                  setValue('salesOwnerName', selected?.label ?? '');
                }}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Sales Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Stage" htmlFor="opp-stage" required error={errors.stage?.message}>
              <Select id="opp-stage" required error={Boolean(errors.stage)} options={stageOptions} {...register('stage')} />
            </FormField>
            <FormField label="Status" htmlFor="opp-status" required error={errors.status?.message}>
              <Select id="opp-status" required error={Boolean(errors.status)} options={statusOptions} {...register('status')} />
            </FormField>
            {isLost && (
              <>
                <FormField label="Lost Reason" htmlFor="opp-lost-reason" required error={errors.lostReason?.message}>
                  <Select id="opp-lost-reason" placeholder="Select reason" error={Boolean(errors.lostReason)} options={lostReasonOptions} {...register('lostReason')} />
                </FormField>
                <FormField className="sm:col-span-2" label="Lost Note" htmlFor="opp-lost-note" error={errors.lostNote?.message}>
                  <Textarea id="opp-lost-note" rows={3} error={Boolean(errors.lostNote)} placeholder="Record why the opportunity was lost..." {...register('lostNote')} />
                </FormField>
              </>
            )}
            <FormField label="Expected Value" htmlFor="opp-value" required error={errors.expectedValue?.message}>
              <Controller
                name="expectedValue"
                control={control}
                render={({ field: { value, onChange, ...field } }) => (
                  <CurrencyInput
                    {...field}
                    id="opp-value"
                    min={0}
                    value={value ?? ''}
                    error={Boolean(errors.expectedValue)}
                    placeholder="0.00"
                    onChange={(nextValue) => onChange(nextValue === '' ? 0 : nextValue)}
                  />
                )}
              />
            </FormField>
            <FormField label="Probability (%)" htmlFor="opp-probability" required error={errors.probability?.message}>
              <Controller
                name="probability"
                control={control}
                render={({ field: { value, onChange, ...field } }) => (
                  <NumberInput
                    {...field}
                    id="opp-probability"
                    min={0}
                    max={100}
                    value={value ?? ''}
                    error={Boolean(errors.probability)}
                    placeholder="0"
                    onChange={(nextValue) => onChange(nextValue === '' ? 0 : nextValue)}
                  />
                )}
              />
            </FormField>
            <FormField label="Expected Close Date" htmlFor="opp-close-date" error={errors.expectedCloseDate?.message}>
              <DatePicker id="opp-close-date" error={Boolean(errors.expectedCloseDate)} {...register('expectedCloseDate')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Additional Information">
          <div className="space-y-4">
            <FormField label="Description" htmlFor="opp-description" error={errors.description?.message}>
              <Textarea id="opp-description" rows={3} error={Boolean(errors.description)} placeholder="Describe the opportunity..." {...register('description')} />
            </FormField>
            <FormField label="Notes" htmlFor="opp-notes" error={errors.notes?.message}>
              <Textarea id="opp-notes" rows={3} error={Boolean(errors.notes)} placeholder="Internal notes..." {...register('notes')} />
            </FormField>
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}
