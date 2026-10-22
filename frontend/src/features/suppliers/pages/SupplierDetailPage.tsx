import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Power, PowerOff, Trash2 } from 'lucide-react';

import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { NotFoundState } from '@/shared/components/feedback/NotFoundState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { appToast } from '@/shared/utils/toast';
import { getErrorMessage } from '@/shared/utils/errors';
import { usePermissions } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';

import { useSupplier } from '../hooks/useSupplier';
import { useSuppliers } from '../hooks/useSuppliers';
import { SupplierOverview } from '../components/SupplierOverview';
import { SupplierDocuments } from '../components/SupplierDocuments';
import { SupplierNotes } from '../components/SupplierNotes';
import { SupplierStatusBadge } from '../components/SupplierStatusBadge';
import { SupplierBalanceSummary } from '../components/SupplierBalanceSummary';
import { SupplierActivityTimeline } from '../components/SupplierActivity';
import { SupplierPurchaseHistory } from '../components/SupplierPurchaseHistory';
import { SupplierTransactionHistory } from '../components/SupplierTransactionHistory';
import { SupplierStatement } from '../components/SupplierStatement';
import { SupplierPerformance } from '../components/SupplierPerformance';


export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const canEdit = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_DELETE);

  const { supplier, isLoading, error, refetch } = useSupplier(id);
  const { deleteSupplier, updateSupplier, isDeleting, isUpdating } = useSuppliers();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  const handleActivate = async () => {
    if (!supplier) return;
    try {
      await updateSupplier(supplier.id, { status: 'active' });
      appToast.success(`Supplier "${supplier.name}" is now active.`);
    } catch (err) {
      appToast.error(getErrorMessage(err, 'Failed to activate supplier. Please try again.'));
    }
  };

  const handleDeactivate = async () => {
    if (!supplier) return;
    try {
      await updateSupplier(supplier.id, { status: 'inactive' });
      setIsDeactivateOpen(false);
      appToast.success(`Supplier "${supplier.name}" has been deactivated.`);
    } catch (err) {
      appToast.error(getErrorMessage(err, 'Failed to deactivate supplier. Please try again.'));
    }
  };

  const handleDelete = async () => {
    if (!supplier) return;
    try {
      await deleteSupplier(supplier.id);
      appToast.success(`Supplier "${supplier.name}" has been deleted.`);
      setIsDeleteOpen(false);
      navigate('/suppliers');
    } catch (err) {
      appToast.error(getErrorMessage(err, 'Failed to delete supplier. Please try again.'));
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      </PageContainer>
    );
  }

  if (error || !supplier) {
    return (
      <PageContainer>
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/suppliers')}
          >
            Back to Suppliers
          </Button>
        </div>
        <Card className="p-0">
          {error ? (
            <ErrorState
              title="Failed to Load Supplier"
              message={error}
              onRetry={() => void refetch()}
            />
          ) : (
            <NotFoundState
              title="Supplier Not Found"
              message={`No supplier exists with ID "${id}".`}
              actionText="Back to Suppliers"
              actionHref="/suppliers"
            />
          )}
        </Card>
      </PageContainer>
    );
  }

  const location = [supplier.address.city, supplier.address.state, supplier.address.country]
    .filter(Boolean)
    .join(', ');

  return (
    <PageContainer>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/suppliers')}
        >
          Back to Suppliers
        </Button>
      </div>

      <PageHeader
        title={supplier.name}
        description={`Code: ${supplier.code} • ${location || 'Location unassigned'}`}
        actions={
          <div className="flex items-center gap-2">
            <SupplierStatusBadge status={supplier.status} />

            {canEdit && supplier.status === 'active' && (
              <Button
                variant="secondary"
                leftIcon={<PowerOff size={16} />}
                onClick={() => setIsDeactivateOpen(true)}
              >
                Deactivate
              </Button>
            )}

            {canEdit && supplier.status === 'inactive' && (
              <Button
                variant="secondary"
                leftIcon={<Power size={16} />}
                onClick={() => void handleActivate()}
                isLoading={isUpdating}
              >
                Activate
              </Button>
            )}

            {canEdit && (
              <Button
                variant="secondary"
                leftIcon={<Edit size={16} />}
                onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
              >
                Edit Supplier
              </Button>
            )}

            {canDelete && (
              <Button
                variant="secondary"
                leftIcon={<Trash2 size={16} />}
                onClick={() => setIsDeleteOpen(true)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        <SupplierOverview supplier={supplier} />
        <SupplierBalanceSummary supplier={supplier} />
        <SupplierPurchaseHistory supplier={supplier} />
        <SupplierTransactionHistory supplier={supplier} />
        <SupplierStatement supplier={supplier} />
        <SupplierPerformance supplier={supplier} />
        <SupplierActivityTimeline supplier={supplier} />
        <SupplierDocuments supplier={supplier} />
        <SupplierNotes supplier={supplier} />
      </div>


      {canDelete && (
        <ConfirmDialog
          isOpen={isDeleteOpen}
          title="Delete Supplier"
          message={`Are you sure you want to delete supplier "${supplier.name}" (${supplier.code})? This action cannot be undone.`}
          variant="danger"
          confirmLabel="Delete Supplier"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setIsDeleteOpen(false)}
        />
      )}

      {canEdit && supplier.status === 'active' && (
        <ConfirmDialog
          isOpen={isDeactivateOpen}
          title="Deactivate Supplier"
          message={`Deactivate "${supplier.name}" (${supplier.code})? The supplier record will remain in the directory and can be activated again.`}
          variant="warning"
          confirmLabel="Deactivate Supplier"
          isLoading={isUpdating}
          onConfirm={handleDeactivate}
          onCancel={() => setIsDeactivateOpen(false)}
        />
      )}
    </PageContainer>
  );
}
