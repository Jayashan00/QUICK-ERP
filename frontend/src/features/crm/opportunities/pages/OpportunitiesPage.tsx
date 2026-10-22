import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ExternalLink, List, Columns3 } from 'lucide-react';

import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { FormSubmitError } from '@/shared/components/forms/FormSubmitError';
import { Card } from '@/shared/components/common/Card';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { usePermission } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';
import { getErrorMessage } from '@/shared/validation';
import type { Column } from '@/shared/components/tables/TableHeader';
import { OPPORTUNITY_STAGES, type Opportunity, type OpportunityStage } from '@/features/crm/opportunities/types/opportunity';
import type { DropdownItem } from '@/shared/components/common/Dropdown';
import { appToast } from '@/shared/utils/toast';
import { controlBase } from '@/shared/components/forms/controlStyles';
import { cn } from '@/shared/utils/cn';

import { useOpportunities } from '../hooks/useOpportunities';
import { OpportunityFilters } from '../components/OpportunityFilters';
import { OpportunityFormModal } from '../components/OpportunityFormModal';
import { OpportunityDetailView } from '../components/OpportunityDetailView';
import { PipelineBoard } from '../components/PipelineBoard';
import { PipelineSummary } from '../components/PipelineSummary';
import { OpportunityLostModal, type LostOpportunityValues } from '../components/OpportunityLostModal';
import type { OpportunityFormValues } from '../schemas/opportunitySchema';

export function OpportunitiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'pipeline' ? 'pipeline' : 'list';
  const canCreate = usePermission(PERMISSIONS.CRM.OPPORTUNITIES_CREATE);
  const canEdit = usePermission(PERMISSIONS.CRM.OPPORTUNITIES_EDIT);
  const canDelete = usePermission(PERMISSIONS.CRM.OPPORTUNITIES_DELETE);

  const {
    opportunities,
    total,
    isLoading,
    error,
    refetch,
    search,
    setSearch,
    stage,
    setStage,
    status,
    setStatus,
    salesOwnerId,
    setSalesOwnerId,
    customerId,
    setCustomerId,
    closeDateFrom,
    setCloseDateFrom,
    closeDateTo,
    setCloseDateTo,
    resetFilters,
    createOpportunity,
    updateOpportunity,
    deleteOpportunity,
    isDeleting,
  } = useOpportunities({ pageSize: 1000 });

  // Modals state
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingLostOpportunity, setPendingLostOpportunity] = useState<Opportunity | null>(null);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const paginatedOpportunities = opportunities.slice(
    (listPage - 1) * listPageSize,
    listPage * listPageSize,
  );

  const setView = (view: 'list' | 'pipeline') => {
    const nextParams = new URLSearchParams(searchParams);
    if (view === 'pipeline') nextParams.set('view', 'pipeline');
    else nextParams.delete('view');
    setSearchParams(nextParams, { replace: true });
  };

  const handleMoveStage = async (opportunity: Opportunity, newStage: OpportunityStage) => {
    if (newStage === opportunity.stage) return;
    if (newStage === 'closed_lost') {
      setPendingLostOpportunity(opportunity);
      return;
    }

    setActionError(null);
    try {
      const status: Opportunity['status'] = newStage === 'closed_won'
        ? 'won'
        : opportunity.status === 'won' || opportunity.status === 'lost'
          ? 'open'
          : opportunity.status;
      await updateOpportunity(opportunity.id, {
        stage: newStage,
        status,
        ...(newStage === 'closed_won' ? { probability: 100, lostReason: undefined, lostNote: undefined } : {}),
      });
      appToast.success(newStage === 'closed_won' ? 'Opportunity marked as won.' : 'Opportunity stage updated.');
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to update the opportunity stage.');
      setActionError(message);
      appToast.error(message);
    }
  };

  const reopenOpportunity = async (opportunity: Opportunity) => {
    setActionError(null);
    try {
      await updateOpportunity(opportunity.id, {
        stage: 'prospecting',
        status: 'open',
        probability: 20,
        lostReason: undefined,
        lostNote: undefined,
      });
      appToast.success('Opportunity reopened.');
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to reopen the opportunity.');
      setActionError(message);
      appToast.error(message);
    }
  };

  const columns: Column<Opportunity>[] = [
    {
      key: 'code',
      header: 'Code',
      width: '110px',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Opportunity Name',
      sortable: true,
      render: (row) => (
        <div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOpportunity(row);
              setIsDetailOpen(true);
            }}
            className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.name}
          </button>
          <div className="text-xs text-slate-500">
            {row.customerName}
            {row.leadName ? ` · Lead: ${row.leadName}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      width: '160px',
      render: (row) => canEdit ? (
        <select
          className={cn(controlBase, 'h-8 py-0 text-xs')}
          value={row.stage}
          aria-label={`Update stage for ${row.name}`}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            void handleMoveStage(row, event.target.value as OpportunityStage);
          }}
        >
          {OPPORTUNITY_STAGES.map((stageOption) => (
            <option key={stageOption.value} value={stageOption.value}>{stageOption.label}</option>
          ))}
        </select>
      ) : <StatusBadge status={row.stage} />,
    },
    {
      key: 'expectedValue',
      header: 'Expected Value',
      align: 'right',
      width: '140px',
      sortable: true,
      render: (row) => (
        <div className="text-right font-semibold text-slate-900">
          ${row.expectedValue.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'probability',
      header: 'Probability',
      align: 'center',
      width: '120px',
      render: (row) => (
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-14 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, row.probability))}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-600">{row.probability}%</span>
        </div>
      ),
    },
    {
      key: 'expectedCloseDate',
      header: 'Close Date',
      width: '120px',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.expectedCloseDate
            ? new Date(row.expectedCloseDate).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
    {
      key: 'salesOwnerName',
      header: 'Owner',
      width: '140px',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.salesOwnerName || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const handleCreateOrUpdate = async (data: OpportunityFormValues) => {
    if (editingOpportunity) {
      await updateOpportunity(editingOpportunity.id, data);
    } else {
      await createOpportunity(data);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      setActionError(null);
      try {
        await deleteOpportunity(deletingId);
        setDeletingId(null);
      } catch (err) {
        setActionError(getErrorMessage(err, 'Unable to delete opportunity. Please try again.'));
      }
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Opportunities"
        description="Manage opportunities in a detailed list or move deals through the visual pipeline."
        actions={
          canCreate && (
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={() => {
                setEditingOpportunity(null);
                setIsFormOpen(true);
              }}
            >
              Create Opportunity
            </Button>
          )
        }
      />

      <div className="mb-6">
        <PipelineSummary opportunities={opportunities} />
      </div>

      <FormSubmitError message={actionError} className="mb-4" />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1" role="group" aria-label="Opportunity view">
          <Button
            size="sm"
            variant={activeView === 'list' ? 'primary' : 'ghost'}
            leftIcon={<List size={15} />}
            onClick={() => setView('list')}
          >
            List View
          </Button>
          <Button
            size="sm"
            variant={activeView === 'pipeline' ? 'primary' : 'ghost'}
            leftIcon={<Columns3 size={15} />}
            onClick={() => setView('pipeline')}
          >
            Pipeline View
          </Button>
        </div>
        <span className="text-xs text-slate-500">{total} matching opportunity record(s)</span>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <TableToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setListPage(1);
          }}
          searchPlaceholder="Search opportunities, customers, leads..."
          filters={
            <OpportunityFilters
              stage={stage}
              onStageChange={(value) => { setStage(value); setListPage(1); }}
              status={status}
              onStatusChange={(value) => { setStatus(value); setListPage(1); }}
              salesOwnerId={salesOwnerId}
              onSalesOwnerChange={(value) => { setSalesOwnerId(value); setListPage(1); }}
              customerId={customerId}
              onCustomerChange={(value) => { setCustomerId(value); setListPage(1); }}
              closeDateFrom={closeDateFrom}
              onCloseDateFromChange={(value) => { setCloseDateFrom(value); setListPage(1); }}
              closeDateTo={closeDateTo}
              onCloseDateToChange={(value) => { setCloseDateTo(value); setListPage(1); }}
              onReset={() => { resetFilters(); setListPage(1); }}
            />
          }
        />
      </div>

      {error ? (
        <Card className="p-0">
          <ErrorState message={error} onRetry={() => void refetch()} />
        </Card>
      ) : activeView === 'list' ? (
        <DataTable<Opportunity>
          columns={columns}
          data={paginatedOpportunities}
          keyField="id"
          isLoading={isLoading}
          emptyTitle="No opportunities found"
          emptyMessage="Try adjusting your search query or filter options."
          emptyAction={
            canCreate ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingOpportunity(null);
                  setIsFormOpen(true);
                }}
              >
                Add First Opportunity
              </Button>
            ) : undefined
          }
          onRowClick={(opp) => {
            setSelectedOpportunity(opp);
            setIsDetailOpen(true);
          }}
          rowActions={(opp) => {
            const actions: DropdownItem[] = [
              {
                key: 'view',
                label: 'Quick View',
                onClick: () => {
                  setSelectedOpportunity(opp);
                  setIsDetailOpen(true);
                },
              },
              {
                key: 'full-page',
                label: 'Open Full Page',
                onClick: () => {
                  navigate(`/crm/opportunities/${opp.id}`);
                },
              },
            ];

            if (canEdit) {
              actions.push({
                key: 'edit',
                label: 'Edit Opportunity',
                onClick: () => {
                  setEditingOpportunity(opp);
                  setIsFormOpen(true);
                },
              });

              if (opp.status === 'open') {
                actions.push({
                  key: 'mark-won',
                  label: 'Mark Won',
                  onClick: () => void handleMoveStage(opp, 'closed_won'),
                });
                actions.push({
                  key: 'mark-lost',
                  label: 'Mark Lost',
                  onClick: () => setPendingLostOpportunity(opp),
                });
              } else {
                actions.push({
                  key: 'reopen',
                  label: 'Reopen Opportunity',
                  onClick: () => void reopenOpportunity(opp),
                });
              }
            }

            if (canDelete) {
              actions.push({
                key: 'delete',
                label: 'Delete Opportunity',
                danger: true,
                onClick: () => setDeletingId(opp.id),
              });
            }

            return actions;
          }}
          pagination={{
            page: listPage,
            pageSize: listPageSize,
            total,
            onPageChange: setListPage,
            onPageSizeChange: (value) => { setListPageSize(value); setListPage(1); },
          }}
        />
      ) : isLoading ? (
        <div className="flex h-96 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <LoadingSpinner />
        </div>
      ) : (
        <PipelineBoard
          opportunities={opportunities}
          onViewOpportunity={(opportunity) => {
            setSelectedOpportunity(opportunity);
            setIsDetailOpen(true);
          }}
          onEditOpportunity={canEdit ? (opportunity) => {
            setEditingOpportunity(opportunity);
            setIsFormOpen(true);
          } : undefined}
          onMoveStage={canEdit ? handleMoveStage : undefined}
        />
      )}

      {/* Quick View Detail Modal */}
      <Modal
        isOpen={isDetailOpen && !!selectedOpportunity}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedOpportunity(null);
        }}
        title={`Opportunity: ${selectedOpportunity?.name || ''}`}
        maxWidth="900px"
        footer={
          <div className="flex w-full flex-wrap justify-between gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDetailOpen(false);
                setSelectedOpportunity(null);
              }}
            >
              Close
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                leftIcon={<ExternalLink size={14} />}
                onClick={() => {
                  if (selectedOpportunity) {
                    navigate(`/crm/opportunities/${selectedOpportunity.id}`);
                  }
                }}
              >
                View Full Page
              </Button>
              {canEdit && selectedOpportunity && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const opp = selectedOpportunity;
                    setIsDetailOpen(false);
                    setSelectedOpportunity(null);
                    setEditingOpportunity(opp);
                    setIsFormOpen(true);
                  }}
                >
                  Edit Opportunity
                </Button>
              )}
            </div>
          </div>
        }
      >
        {selectedOpportunity && <OpportunityDetailView opportunity={selectedOpportunity} />}
      </Modal>

      {/* Form Modal (Create / Edit) */}
      <OpportunityFormModal
        opportunity={editingOpportunity}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingOpportunity(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete Opportunity"
        message="Are you sure you want to delete this opportunity? All associated deal values and forecast data will be removed. This action cannot be undone."
        variant="danger"
        confirmLabel="Delete Opportunity"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />

      <OpportunityLostModal
        isOpen={Boolean(pendingLostOpportunity)}
        opportunityName={pendingLostOpportunity?.name}
        onClose={() => setPendingLostOpportunity(null)}
        onSubmit={async (values: LostOpportunityValues) => {
          if (!pendingLostOpportunity) return;
          await updateOpportunity(pendingLostOpportunity.id, {
            stage: 'closed_lost',
            status: 'lost',
            probability: 0,
            ...values,
          });
        }}
      />
    </PageContainer>
  );
}
