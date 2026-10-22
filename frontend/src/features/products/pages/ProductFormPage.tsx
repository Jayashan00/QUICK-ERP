import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { usePermission } from '@/core/permissions/permission-context';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { NotFoundState } from '@/shared/components/feedback/NotFoundState';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { getErrorMessage } from '@/shared/validation';
import { appToast } from '@/shared/utils/toast';
import { ProductForm } from '../components/ProductForm';
import { ProductPageSkeleton } from '../components/ProductLoadingStates';
import { useProduct } from '../hooks/useProduct';
import { useProductDocuments } from '../hooks/useProductDocuments';
import { useProductImages } from '../hooks/useProductImages';
import { useProductSpecifications } from '../hooks/useProductSpecifications';
import { useProductMutations } from '../hooks/useProducts';
import type { ProductFormValues } from '../schemas/productSchema';

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [temporaryProductId] = useState(() => `draft-product-${crypto.randomUUID().slice(0, 8)}`);
  const imageProductId = id ?? temporaryProductId;
  const detail = useProduct(id);
  const productImages = useProductImages(imageProductId);
  const { attachToProduct, discardTemporary } = productImages;
  const productDocuments = useProductDocuments(imageProductId);
  const {
    attachToProduct: attachDocumentsToProduct,
    discardTemporary: discardTemporaryDocuments,
  } = productDocuments;
  const productSpecifications = useProductSpecifications(imageProductId);
  const {
    attachToProduct: attachSpecificationsToProduct,
    discardTemporary: discardTemporarySpecifications,
  } = productSpecifications;
  const mutations = useProductMutations();
  const canManageImages = usePermission(
    isEditing ? PERMISSIONS.PRODUCTS.PRODUCTS_EDIT : PERMISSIONS.PRODUCTS.PRODUCTS_CREATE,
  );
  const canDownloadDocuments = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_DOWNLOAD);
  const canManagePrices = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_MANAGE_PRICES);
  const canManageLifecycle = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_ACTIVATE);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const draftResourcesFinalized = useRef(isEditing);

  const returnPath = isEditing && id ? `/products/${id}` : '/products';

  useEffect(() => () => {
    if (!draftResourcesFinalized.current) {
      discardTemporary();
      discardTemporaryDocuments();
      discardTemporarySpecifications();
    }
  }, [discardTemporary, discardTemporaryDocuments, discardTemporarySpecifications]);

  const cancel = () => {
    if (!isEditing) {
      discardTemporary();
      discardTemporaryDocuments();
      discardTemporarySpecifications();
      draftResourcesFinalized.current = true;
    }
    navigate(returnPath);
  };

  const submit = async (values: ProductFormValues) => {
    setSubmitError(null);
    try {
      if (id) {
        const updated = await mutations.updateProduct(id, values);
        appToast.success('Product updated successfully.');
        navigate(`/products/${updated.id}`);
      } else {
        const created = await mutations.createProduct(values);
        await Promise.all([
          attachToProduct(created.id),
          attachDocumentsToProduct(created.id),
          attachSpecificationsToProduct(created.id),
        ]);
        draftResourcesFinalized.current = true;
        appToast.success('Product created successfully.');
        navigate(`/products/${created.id}`);
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Unable to save the product. Review the form and try again.'));
    }
  };

  if (isEditing && detail.isLoading) {
    return <PageContainer><ProductPageSkeleton /></PageContainer>;
  }

  if (isEditing && detail.error) {
    return <PageContainer><Card className="p-0"><ErrorState message={detail.error} onRetry={() => void detail.refetch()} /></Card></PageContainer>;
  }

  if (isEditing && !detail.product) {
    return (
      <PageContainer>
        <Card className="p-0">
          <NotFoundState title="Product Not Found" message={`No product exists with ID "${id}".`} actionText="Return to Products" actionHref="/products" />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-4">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={cancel}>
          Back
        </Button>
      </div>
      <PageHeader
        title={isEditing ? `Edit Product: ${detail.product?.name}` : 'Add Product'}
        description={isEditing ? 'Update tenant product master data while preserving system identity.' : 'Create a tenant product or service for future sales, purchasing and inventory workflows.'}
      />
      <ProductForm
        initialData={detail.product ?? undefined}
        imageProductId={imageProductId}
        canManageImages={canManageImages}
        documentProductId={imageProductId}
        canManageDocuments={canManageImages}
        canDownloadDocuments={canDownloadDocuments}
        specificationProductId={imageProductId}
        canManageSpecifications={canManageImages}
        canManagePrices={canManagePrices}
        canManageLifecycle={canManageLifecycle}
        onSubmit={submit}
        onCancel={cancel}
        isSaving={mutations.isSaving}
        submitError={submitError}
      />
    </PageContainer>
  );
}
