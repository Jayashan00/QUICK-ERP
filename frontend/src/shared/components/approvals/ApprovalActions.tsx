import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { FormField } from '@/shared/components/forms/FormField';
import { Textarea } from '@/shared/components/forms/Textarea';
import { appToast } from '@/shared/utils/toast';
import { getErrorMessage } from '@/shared/utils/errors';
import type { ApprovalStatus } from '@/shared/types/approval';

const decisionSchema = z.object({ remarks: z.string().trim().max(1000, 'Remarks must be 1000 characters or less.') });
type DecisionValues = z.infer<typeof decisionSchema>;

interface ApprovalActionsProps {
  status: ApprovalStatus;
  canApprove?: boolean;
  canReject?: boolean;
  onDecision: (status: Extract<ApprovalStatus, 'approved' | 'rejected'>, remarks?: string) => Promise<void>;
}

export function ApprovalActions({ status, canApprove = false, canReject = false, onDecision }: ApprovalActionsProps) {
  const [decision, setDecision] = useState<Extract<ApprovalStatus, 'approved' | 'rejected'> | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DecisionValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { remarks: '' },
  });

  if (status !== 'pending') return null;

  const close = () => {
    setDecision(null);
    reset({ remarks: '' });
  };

  const submit = async ({ remarks }: DecisionValues) => {
    if (!decision) return;
    try {
      await onDecision(decision, remarks || undefined);
      appToast.success(decision === 'approved' ? 'Request approved.' : 'Request rejected.');
      close();
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Unable to record the approval decision.'));
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canReject && <Button variant="danger" size="sm" leftIcon={<XCircle size={15} />} onClick={() => setDecision('rejected')}>Reject</Button>}
        {canApprove && <Button size="sm" leftIcon={<CheckCircle2 size={15} />} onClick={() => setDecision('approved')}>Approve</Button>}
      </div>
      <Modal
        isOpen={Boolean(decision)}
        onClose={isSubmitting ? () => undefined : close}
        title={decision === 'approved' ? 'Approve Request' : 'Reject Request'}
        maxWidth="520px"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={close}>Cancel</Button><Button variant={decision === 'rejected' ? 'danger' : 'primary'} type="submit" form="approval-decision-form" isLoading={isSubmitting}>Confirm</Button></div>}
      >
        <form id="approval-decision-form" onSubmit={handleSubmit(submit)} noValidate>
          <FormField label="Remarks" error={errors.remarks?.message} hint="Optional context retained in approval history.">
            <Textarea rows={4} placeholder="Add decision remarks..." error={Boolean(errors.remarks)} {...register('remarks')} />
          </FormField>
        </form>
      </Modal>
    </>
  );
}
