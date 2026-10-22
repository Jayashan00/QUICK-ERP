import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { NotFoundState } from '@/shared/components/feedback/NotFoundState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';

import { SupplierForm } from '../components/SupplierForm';
import { useSupplier } from '../hooks/useSupplier';
import { useUpdateSupplier } from '../hooks/useUpdateSupplier';
import type { SupplierCategory, SupplierPaymentMethod } from '../types/supplier';
import type { SupplierFormValues } from '../schemas/supplier.schema';


export function SupplierEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const canEditStatus = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT);

  const { supplier, isLoading, error, refetch } = useSupplier(id);
  const { updateSupplier, isUpdating } = useUpdateSupplier();

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

  const handleUpdate = async (values: SupplierFormValues) => {
    if (!id) return;
    await updateSupplier(id, {
      ...values,
      category: values.category ? (values.category as SupplierCategory) : undefined,
      paymentMethod: values.paymentMethod ? (values.paymentMethod as SupplierPaymentMethod) : undefined,
      bankDetails: values.bankDetails
        ? {
            bankName: values.bankDetails.bankName || undefined,
            accountName: values.bankDetails.accountName || undefined,
            accountNumber: values.bankDetails.accountNumber || undefined,
            branch: values.bankDetails.branch || undefined,
            branchCode: values.bankDetails.branchCode || undefined,
            swiftCode: values.bankDetails.swiftCode || undefined,
            iban: values.bankDetails.iban || undefined,
            currency: values.bankDetails.currency || undefined,
          }
        : undefined,
      mobile: values.mobile || undefined,
      website: values.website || undefined,
      taxNumber: values.taxNumber || undefined,
      vatNumber: values.vatNumber || undefined,
      taxCategory: values.taxCategory || undefined,
      registrationNumber: values.registrationNumber || undefined,
      notes: values.notes || undefined,
      address: {
        ...values.address,
        street2: values.address.street2 || undefined,
        state: values.address.state || undefined,
      },
    });
    appToast.success(`Supplier "${values.name}" updated successfully.`);
    navigate(`/suppliers/${id}`);
  };

  const handleCancel = () => {
    navigate(id ? `/suppliers/${id}` : '/suppliers');
  };

  const initialValues: Partial<SupplierFormValues> = {
    code: supplier.code,
    name: supplier.name,
    category: supplier.category ?? '',
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    mobile: supplier.mobile ?? '',
    website: supplier.website ?? '',
    taxNumber: supplier.taxNumber ?? '',
    vatNumber: supplier.vatNumber ?? '',
    taxCategory: supplier.taxCategory ?? '',
    registrationNumber: supplier.registrationNumber ?? '',
    currency: supplier.currency,
    paymentTermsDays: supplier.paymentTermsDays,
    paymentMethod: supplier.paymentMethod ?? 'bank_transfer',
    bankDetails: {
      bankName: supplier.bankDetails?.bankName ?? '',
      accountName: supplier.bankDetails?.accountName ?? '',
      accountNumber: supplier.bankDetails?.accountNumber ?? '',
      branch: supplier.bankDetails?.branch ?? '',
      branchCode: supplier.bankDetails?.branchCode ?? '',
      swiftCode: supplier.bankDetails?.swiftCode ?? '',
      iban: supplier.bankDetails?.iban ?? '',
      currency: supplier.bankDetails?.currency ?? supplier.currency ?? 'USD',
    },
    status: supplier.status,
    address: {
      street: supplier.address.street,
      street2: supplier.address.street2 ?? '',
      city: supplier.address.city,
      state: supplier.address.state ?? '',
      postalCode: supplier.address.postalCode,
      country: supplier.address.country,
    },
    notes: supplier.notes ?? '',
  };


  return (
    <PageContainer>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={handleCancel}
        >
          Back to Supplier
        </Button>
      </div>

      <PageHeader
        title={`Edit Supplier — ${supplier.name}`}
        description={`Modify information, payment terms, or contact coordinates for code ${supplier.code}.`}
      />

      <SupplierForm
        mode="edit"
        initialValues={initialValues}
        onSubmit={handleUpdate}
        onCancel={handleCancel}
        isLoading={isUpdating}
        canEditStatus={canEditStatus}
      />
    </PageContainer>
  );
}
