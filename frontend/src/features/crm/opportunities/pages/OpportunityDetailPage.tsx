import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Trophy, XCircle, GitBranch, FilePlus2 } from 'lucide-react';

import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Button } from '@/shared/components/common/Button';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { NotFoundState } from '@/shared/components/feedback/NotFoundState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { FormSubmitError } from '@/shared/components/forms/FormSubmitError';
import { Card } from '@/shared/components/common/Card';
import { usePermission } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';
import { getErrorMessage } from '@/shared/validation';

import { useOpportunity } from '../hooks/useOpportunity';
import { useOpportunities } from '../hooks/useOpportunities';
import { OpportunityDetailView } from '../components/OpportunityDetailView';
import { OpportunityFormModal } from '../components/OpportunityFormModal';
import type { OpportunityFormValues } from '../schemas/opportunitySchema';
import { OpportunityLostModal, type LostOpportunityValues } from '../components/OpportunityLostModal';

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const canEdit = usePermission(PERMISSIONS.CRM.OPPORTUNITIES_EDIT);
  const canDelete = usePermission(PERMISSIONS.CRM.OPPORTUNITIES_DELETE);
  const canCreateQuotation = usePermission(PERMISSIONS.SALES.QUOTATIONS_CREATE);

  const { opportunity, isLoading, error, refetch } = useOpportunity(id);
  const { updateOpportunity, deleteOpportunity, isDeleting } = useOpportunities();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLostOpen, setIsLostOpen] = useState(false);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      </PageContainer>
    );
  }

  if (error || !opportunity) {
    return (
      <PageContainer>
        <div className="mb-4">
          <Button
            variant="ghost"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/crm/opportunities')}
          >
            Back to Opportunities
          </Button>
        </div>
        <Card className="p-0">
          {error ? (
            <ErrorState message={error} onRetry={() => void refetch()} />
          ) : (
            <NotFoundState
              title="Opportunity Not Found"
              message={`No opportunity exists with ID "${id}".`}
              actionText="Return to Opportunities"
              actionHref="/crm/opportunities"
            />
          )}
        </Card>
      </PageContainer>
    );
  }

  const handleUpdate = async (data: OpportunityFormValues) => {
    if (!opportunity) return;
    await updateOpportunity(opportunity.id, data);
    await refetch();
  };

  const handleDelete = async () => {
    if (!opportunity) return;
    setActionError(null);
    try {
      await deleteOpportunity(opportunity.id);
      navigate('/crm/opportunities');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to delete opportunity.'));
      setIsDeleteOpen(false);
    }
  };

  const markWon = async () => {
    setActionError(null);
    try {
      await updateOpportunity(opportunity.id, {
        stage: 'closed_won',
        status: 'won',
        probability: 100,
        lostReason: undefined,
        lostNote: undefined,
      });
      await refetch();
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to mark the opportunity as won.'));
    }
  };

  const markLost = async (values: LostOpportunityValues) => {
    await updateOpportunity(opportunity.id, {
      stage: 'closed_lost',
      status: 'lost',
      probability: 0,
      ...values,
    });
    await refetch();
  };

  return (
    <PageContainer>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/crm/opportunities')}
        >
          Back to Opportunities
        </Button>
      </div>

      <PageHeader
        title={opportunity.name}
        description={`Code: ${opportunity.code} · Customer: ${opportunity.customerName}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={<GitBranch size={16} />} onClick={() => navigate('/crm/opportunities?view=pipeline')}>
              View Pipeline
            </Button>
            {canEdit && opportunity.status === 'open' && (
              <>
                <Button variant="secondary" leftIcon={<Trophy size={16} />} onClick={() => void markWon()}>
                  Mark Won
                </Button>
                <Button variant="secondary" leftIcon={<XCircle size={16} />} onClick={() => setIsLostOpen(true)}>
                  Mark Lost
                </Button>
              </>
            )}
            {opportunity.status === 'won' && canCreateQuotation && (
              <Button
                variant="secondary"
                leftIcon={<FilePlus2 size={16} />}
                onClick={() => navigate(`/sales/quotations?opportunityId=${encodeURIComponent(opportunity.id)}&customerId=${encodeURIComponent(opportunity.customerId ?? '')}`)}
              >
                Create Quotation
              </Button>
            )}
            {canEdit && (
              <Button
                variant="primary"
                leftIcon={<Edit size={16} />}
                onClick={() => setIsEditOpen(true)}
              >
                Edit Opportunity
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                leftIcon={<Trash2 size={16} />}
                onClick={() => setIsDeleteOpen(true)}
              >
                Delete
              </Button>
            )}
          </div>
        }
      />

      <FormSubmitError message={actionError} className="mb-4" />

      <OpportunityDetailView opportunity={opportunity} />

      {/* Edit Modal */}
      <OpportunityFormModal
        opportunity={opportunity}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleUpdate}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete Opportunity"
        message={`Are you sure you want to delete "${opportunity.name}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete Opportunity"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteOpen(false)}
      />

      <OpportunityLostModal
        isOpen={isLostOpen}
        opportunityName={opportunity.name}
        onClose={() => setIsLostOpen(false)}
        onSubmit={markLost}
      />
    </PageContainer>
  );
}
