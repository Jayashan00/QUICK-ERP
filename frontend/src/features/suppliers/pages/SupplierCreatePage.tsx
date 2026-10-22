import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Button } from '@/shared/components/common/Button';
import { appToast } from '@/shared/utils/toast';

import { SupplierForm } from '../components/SupplierForm';
import { useCreateSupplier } from '../hooks/useCreateSupplier';
import type { SupplierCategory, SupplierPaymentMethod } from '../types/supplier';
import type { CreateSupplierInput } from '../services/supplierService';
import type { SupplierFormValues } from '../schemas/supplier.schema';

export function SupplierCreatePage() {
  const navigate = useNavigate();
  const { createSupplier, isCreating } = useCreateSupplier();

  const handleCreate = async (values: SupplierFormValues) => {
    const payload: CreateSupplierInput = {
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
    };

    const created = await createSupplier(payload);
    appToast.success(`Supplier "${created.name}" created successfully.`);
    navigate(`/suppliers/${created.id}`);
  };

  const handleCancel = () => {
    navigate('/suppliers');
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
          Back to Suppliers
        </Button>
      </div>

      <PageHeader
        title="Add Supplier"
        description="Register a new vendor or supplier profile with contact and payment terms."
      />

      <SupplierForm
        mode="create"
        onSubmit={handleCreate}
        onCancel={handleCancel}
        isLoading={isCreating}
      />
    </PageContainer>
  );
}
