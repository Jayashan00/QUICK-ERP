import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';

import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSection } from '@/shared/components/forms/FormSection';
import { FormSubmitError } from '@/shared/components/forms/FormSubmitError';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { getErrorMessage } from '@/shared/validation';
import { OPPORTUNITY_STAGES, OPPORTUNITY_STATUSES } from '@/features/crm/opportunities/types/opportunity';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';
import { mockCustomers } from '@/features/customers/mocks';
import { mockLeads } from '@/features/crm/leads/mocks';

import { opportunitySchema, type OpportunityFormValues } from '../schemas/opportunitySchema';
import { useOpportunity } from '../hooks/useOpportunity';
import { useOpportunities } from '../hooks/useOpportunities';

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

export function OpportunityFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { users } = useUserOptions({ includeInactive: true });
  const salesOwnerOptions = users.map(user => ({ value: user.id, label: user.name }));
  const initialOwner = users.find(user => user.id === searchParams.get('ownerId'));

  const { opportunity, isLoading: isFetching } = useOpportunity(id);
  const { createOpportunity, updateOpportunity } = useOpportunities();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    getFieldState,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      code: generateCode(),
      name: searchParams.get('opportunityName') ?? '',
      customerId: '',
      customerName: '',
      leadId: searchParams.get('leadId') ?? '',
      leadName: searchParams.get('leadName') ?? '',
      salesOwnerId: initialOwner?.id ?? '',
      salesOwnerName: initialOwner?.name ?? '',
      stage: 'prospecting',
      status: 'open',
      expectedCloseDate: '',
      expectedValue: Number(searchParams.get('expectedValue') ?? 0),
      probability: 20,
      description: '',
      notes: '',
      lostReason: undefined,
      lostNote: '',
    },
  });
  useEffect(() => {
    if (!isEditing && initialOwner && !getFieldState('salesOwnerId').isDirty) {
      setValue('salesOwnerId', initialOwner.id);
      setValue('salesOwnerName', initialOwner.name);
    }
  }, [initialOwner, isEditing, getFieldState, setValue]);
  const selectedStage = watch('stage');
  const selectedStatus = watch('status');
  const isLost = selectedStage === 'closed_lost' || selectedStatus === 'lost';

  useEffect(() => {
    if (opportunity) {
      reset({
        code: opportunity.code,
        name: opportunity.name,
        customerId: opportunity.customerId ?? '',
        customerName: opportunity.customerName ?? '',
        leadId: opportunity.leadId ?? '',
        leadName: opportunity.leadName ?? '',
        salesOwnerId: opportunity.salesOwnerId ?? '',
        salesOwnerName: opportunity.salesOwnerName ?? '',
        stage: opportunity.stage,
        status: opportunity.status,
        expectedCloseDate: opportunity.expectedCloseDate ?? '',
        expectedValue: opportunity.expectedValue,
        probability: opportunity.probability,
        description: opportunity.description ?? '',
        notes: opportunity.notes ?? '',
        lostReason: opportunity.lostReason,
        lostNote: opportunity.lostNote ?? '',
      });
    }
  }, [opportunity, reset]);

  const onCustomerChange = (customerId: string) => {
    const cust = mockCustomers.find((c) => c.id === customerId);
    setValue('customerId', customerId, { shouldDirty: true });
    setValue('customerName', cust ? cust.name : '', { shouldDirty: true, shouldValidate: true });
  };

  const onSalesOwnerChange = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    setValue('salesOwnerId', userId, { shouldDirty: true });
    setValue('salesOwnerName', user ? user.name : '', { shouldDirty: true });
  };

  const onSubmitForm = async (data: OpportunityFormValues) => {
    setSubmitError(null);
    try {
      if (isEditing && id) {
        await updateOpportunity(id, data);
        navigate(`/crm/opportunities/${id}`);
      } else {
        const created = await createOpportunity(data);
        navigate(created ? `/crm/opportunities/${created.id}` : '/crm/opportunities');
      }
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Failed to save opportunity. Please review the form.'));
    }
  };

  if (isEditing && isFetching) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate(isEditing ? `/crm/opportunities/${id}` : '/crm/opportunities')}
        >
          Cancel & Return
        </Button>
      </div>

      <PageHeader
        title={isEditing ? `Edit Opportunity: ${opportunity?.name || ''}` : 'Create Opportunity'}
        description={
          isEditing
            ? `Update opportunity parameters, stage progression, and commercial details.`
            : 'Register a new sales deal, potential revenue, assign reps, and target close dates.'
        }
      />

      <FormSubmitError message={submitError} className="mb-6" />

      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
        <Card>
          <FormSection
            title="General Information"
            description="Core opportunity identification and customer relationship"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Opportunity Code" error={errors.code?.message} required>
                <TextInput
                  {...register('code')}
                  disabled={isEditing}
                  placeholder="e.g. OPP-1024"
                />
              </FormField>

              <FormField label="Opportunity Name" error={errors.name?.message} required>
                <TextInput
                  {...register('name')}
                  placeholder="e.g. Enterprise License Expansion"
                />
              </FormField>

              <FormField
                label="Customer / Account"
                error={errors.customerName?.message}
                required
              >
                <Controller
                  name="customerId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      options={customerOptions}
                      placeholder="Select customer..."
                      value={field.value ?? ''}
                      onChange={(e) => onCustomerChange(e.target.value)}
                    />
                  )}
                />
              </FormField>

              <FormField label="Sales Owner / Representative" error={errors.salesOwnerName?.message}>
                <Controller
                  name="salesOwnerId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      options={salesOwnerOptions}
                      placeholder="Assign sales owner..."
                      value={field.value ?? ''}
                      onChange={(e) => onSalesOwnerChange(e.target.value)}
                    />
                  )}
                />
              </FormField>
            </div>
          </FormSection>

          <div className="my-6 border-t border-slate-100" />

          <FormSection
            title="Commercials & Forecast"
            description="Expected revenue, win probability, and stage progression"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Pipeline Stage" error={errors.stage?.message} required>
                <Controller
                  name="stage"
                  control={control}
                  render={({ field }) => (
                    <Select
                      options={stageOptions}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>

              <FormField label="Deal Status" error={errors.status?.message} required>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select
                      options={statusOptions}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>

              {isLost && (
                <>
                  <FormField label="Lost Reason" error={errors.lostReason?.message} required>
                    <Select options={lostReasonOptions} placeholder="Select reason..." {...register('lostReason')} />
                  </FormField>
                  <FormField label="Lost Note" error={errors.lostNote?.message} className="sm:col-span-2 lg:col-span-3">
                    <Textarea {...register('lostNote')} rows={2} placeholder="Record why this opportunity was lost..." />
                  </FormField>
                </>
              )}

              <FormField label="Expected Value ($)" error={errors.expectedValue?.message} required>
                <Controller
                  name="expectedValue"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      currency="$"
                    />
                  )}
                />
              </FormField>

              <FormField label="Win Probability (%)" error={errors.probability?.message} required>
                <Controller
                  name="probability"
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      value={field.value}
                      onChange={field.onChange}
                      min={0}
                      max={100}
                    />
                  )}
                />
              </FormField>

              <FormField
                label="Target Close Date"
                error={errors.expectedCloseDate?.message}
                className="sm:col-span-2"
              >
                <Controller
                  name="expectedCloseDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>

              <FormField label="Lead Reference" error={errors.leadId?.message} className="sm:col-span-2">
                <Controller
                  name="leadId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      options={leadOptions}
                      placeholder="Select source lead (optional)..."
                      value={field.value ?? ''}
                      onChange={(event) => {
                        const selected = mockLeads.find((lead) => lead.id === event.target.value);
                        field.onChange(event.target.value);
                        setValue('leadName', selected ? `${selected.firstName} ${selected.lastName}` : '', { shouldDirty: true });
                      }}
                    />
                  )}
                />
              </FormField>
            </div>
          </FormSection>

          <div className="my-6 border-t border-slate-100" />

          <FormSection
            title="Scope & Notes"
            description="Opportunity scope of work and internal sales rep remarks"
          >
            <div className="space-y-4">
              <FormField label="Description" error={errors.description?.message}>
                <Textarea
                  {...register('description')}
                  placeholder="Provide scope, client requirements, or tender details..."
                  rows={3}
                />
              </FormField>

              <FormField label="Internal Notes" error={errors.notes?.message}>
                <Textarea
                  {...register('notes')}
                  placeholder="Internal team notes, competitor context, key stakeholder dynamics..."
                  rows={2}
                />
              </FormField>
            </div>
          </FormSection>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(isEditing ? `/crm/opportunities/${id}` : '/crm/opportunities')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting || (isEditing && !isDirty)}
            leftIcon={<Save size={16} />}
          >
            {isEditing ? 'Save Changes' : 'Create Opportunity'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
