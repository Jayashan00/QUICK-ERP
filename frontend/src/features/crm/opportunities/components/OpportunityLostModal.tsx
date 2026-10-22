import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';

const lostOpportunitySchema = z.object({
  lostReason: z.enum(['price', 'competitor', 'timing', 'no_budget', 'no_decision', 'other'], {
    error: 'Select a lost reason.',
  }),
  lostNote: z.string().trim().max(1000, 'Lost note must be 1000 characters or less.'),
}).superRefine((data, context) => {
  if (data.lostReason === 'other' && !data.lostNote) {
    context.addIssue({ code: 'custom', path: ['lostNote'], message: 'Add a note for the lost reason.' });
  }
});

export type LostOpportunityValues = z.infer<typeof lostOpportunitySchema>;

interface OpportunityLostModalProps {
  isOpen: boolean;
  opportunityName?: string;
  onClose: () => void;
  onSubmit: (values: LostOpportunityValues) => Promise<void>;
}

const reasonOptions = [
  { value: 'price', label: 'Price' },
  { value: 'competitor', label: 'Lost to competitor' },
  { value: 'timing', label: 'Timing' },
  { value: 'no_budget', label: 'No budget' },
  { value: 'no_decision', label: 'No decision' },
  { value: 'other', label: 'Other' },
];

export function OpportunityLostModal({ isOpen, opportunityName, onClose, onSubmit }: OpportunityLostModalProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LostOpportunityValues>({
    resolver: zodResolver(lostOpportunitySchema),
    defaultValues: { lostNote: '' },
  });

  useEffect(() => {
    if (isOpen) reset({ lostReason: undefined, lostNote: '' });
  }, [isOpen, reset]);

  const submit = async (values: LostOpportunityValues) => {
    try {
      await onSubmit(values);
      appToast.success('Opportunity marked as lost.');
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Unable to close the opportunity.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title="Mark Opportunity as Lost"
      maxWidth="520px"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="danger" type="submit" form="opportunity-lost-form" isLoading={isSubmitting}>Mark Lost</Button>
        </div>
      }
    >
      <form id="opportunity-lost-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <p className="text-sm text-slate-600">Record why {opportunityName || 'this opportunity'} was lost so the pipeline history remains useful.</p>
        <FormField label="Lost Reason" required error={errors.lostReason?.message}>
          <Select options={reasonOptions} placeholder="Select reason..." error={Boolean(errors.lostReason)} {...register('lostReason')} />
        </FormField>
        <FormField label="Lost Note" error={errors.lostNote?.message}>
          <Textarea rows={4} placeholder="Competitor, pricing feedback, or future follow-up..." error={Boolean(errors.lostNote)} {...register('lostNote')} />
        </FormField>
      </form>
    </Modal>
  );
}
