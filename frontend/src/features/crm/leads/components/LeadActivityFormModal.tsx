import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';

import { leadActivitySchema, type LeadActivityFormValues } from '../schemas/leadActivitySchema';

interface LeadActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LeadActivityFormValues) => Promise<void>;
}

const FORM_ID = 'lead-activity-form';
const defaultValues: LeadActivityFormValues = {
  type: 'call',
  status: 'planned',
  subject: '',
  description: '',
  scheduledAt: '',
  assignedTo: '',
};

export function LeadActivityFormModal({ isOpen, onClose, onSubmit }: LeadActivityFormModalProps) {
  const { users } = useUserOptions();
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadActivityFormValues>({
    resolver: zodResolver(leadActivitySchema),
    defaultValues,
  });

  useEffect(() => {
    if (isOpen) reset(defaultValues);
  }, [isOpen, reset]);

  const submitForm = async (data: LeadActivityFormValues) => {
    try {
      await onSubmit(data);
      appToast.success('Activity added successfully.');
      onClose();
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Unable to add the activity. Please try again.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title="Add Activity"
      maxWidth="620px"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting}>Add Activity</Button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-4" noValidate onSubmit={handleSubmit(submitForm)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Activity Type" htmlFor="activity-type" required error={errors.type?.message}>
            <Select id="activity-type" required error={Boolean(errors.type)} aria-describedby={errors.type ? 'activity-type-error' : undefined} options={[{ value: 'call', label: 'Call' }, { value: 'email', label: 'Email' }, { value: 'meeting', label: 'Meeting' }, { value: 'task', label: 'Task' }, { value: 'note', label: 'Note' }]} {...register('type')} />
          </FormField>
          <FormField label="Status" htmlFor="activity-status" required error={errors.status?.message}>
            <Select id="activity-status" required error={Boolean(errors.status)} aria-describedby={errors.status ? 'activity-status-error' : undefined} options={[{ value: 'planned', label: 'Planned' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} {...register('status')} />
          </FormField>
          <FormField className="sm:col-span-2" label="Subject" htmlFor="activity-subject" required error={errors.subject?.message}>
            <TextInput id="activity-subject" required error={Boolean(errors.subject)} aria-describedby={errors.subject ? 'activity-subject-error' : undefined} placeholder="e.g. Product demonstration" {...register('subject')} />
          </FormField>
          <FormField label="Scheduled Date & Time" htmlFor="activity-scheduled-at" error={errors.scheduledAt?.message}>
            <TextInput id="activity-scheduled-at" type="datetime-local" error={Boolean(errors.scheduledAt)} aria-describedby={errors.scheduledAt ? 'activity-scheduled-at-error' : undefined} {...register('scheduledAt')} />
          </FormField>
          <FormField label="Assigned To" htmlFor="activity-assigned-to" error={errors.assignedTo?.message}>
            <Select id="activity-assigned-to" placeholder="Select user" error={Boolean(errors.assignedTo)} aria-describedby={errors.assignedTo ? 'activity-assigned-to-error' : undefined} options={users.map((user) => ({ value: user.id, label: user.name }))} {...register('assignedTo')} />
          </FormField>
          <FormField className="sm:col-span-2" label="Description" htmlFor="activity-description" error={errors.description?.message}>
            <Textarea id="activity-description" rows={4} error={Boolean(errors.description)} aria-describedby={errors.description ? 'activity-description-error' : undefined} placeholder="Activity notes or follow-up details..." {...register('description')} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
