import { useState } from 'react';
import { Archive, ArrowLeft, Edit, Layers3, MoreHorizontal, Power, PowerOff, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { usePermission } from '@/core/permissions/permission-context';
import { useBranch } from '@/core/branch/branch-context';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { Dropdown } from '@/shared/components/common/Dropdown';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { NotFoundState } from '@/shared/components/feedback/NotFoundState';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { formatDate } from '@/shared/utils/formatters';
import { appToast } from '@/shared/utils/toast';
import { ProductOverview } from '../components/ProductOverview';
import { ProductPageSkeleton } from '../components/ProductLoadingStates';
import { ProductLabelPreview } from '../components/ProductLabelPreview';
import { ProductImagesSection } from '../components/ProductImagesSection';
import { ProductDocumentsSection } from '../components/ProductDocumentsSection';
import { ProductVariantsSection } from '../components/ProductVariantsSection';
import { ProductSpecificationsSection } from '../components/ProductSpecificationsSection';
import { ProductBundleSection, ProductSuppliersSection, RelatedProductsSection } from '../components/ProductRelationshipsSections';
import { useProduct } from '../hooks/useProduct';
import { useProductMutations } from '../hooks/useProducts';

const futureSections = ['Purchasing', 'Batches & Serials', 'Audit History'];

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentBranch } = useBranch();
  const canEdit = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_EDIT);
  const canPrint = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_PRINT);
  const canDownload = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_DOWNLOAD);
  const canDelete = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_DELETE);
  const canActivate = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_ACTIVATE);
  const canManagePrices = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_MANAGE_PRICES);
  const detail = useProduct(id);
  const mutations = useProductMutations();
  const [pendingAction, setPendingAction] = useState<'activate' | 'deactivate' | 'archive' | 'delete' | null>(null);

  if (detail.isLoading) {
    return <PageContainer><ProductPageSkeleton /></PageContainer>;
  }

  if (detail.error || !detail.product) {
    return (
      <PageContainer>
        <div className="mb-4"><Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/products')}>Back to Products</Button></div>
        <Card className="p-0">
          {detail.error ? (
            <ErrorState message={detail.error} onRetry={() => void detail.refetch()} />
          ) : (
            <NotFoundState title="Product Not Found" message={`No product exists with ID "${id}".`} actionText="Return to Products" actionHref="/products" />
          )}
        </Card>
      </PageContainer>
    );
  }

  const product = detail.product;
  const confirmAction = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction === 'activate') await mutations.setProductStatus(product.id, 'active');
      if (pendingAction === 'deactivate') await mutations.setProductStatus(product.id, 'inactive');
      if (pendingAction === 'archive') await mutations.archiveProduct(product.id);
      if (pendingAction === 'delete') {
        await mutations.deleteProduct(product.id);
        appToast.success('Product permanently deleted.');
        navigate('/products');
        return;
      }
      appToast.success(`Product ${pendingAction}d successfully.`);
      setPendingAction(null);
      await detail.refetch();
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to update the product.');
    }
  };
  return (
    <PageContainer>
      <div className="mb-4"><Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/products')}>Back to Products</Button></div>
      <PageHeader
        title={product.name}
        description={`${product.sku} · Created ${formatDate(product.createdAt)}`}
        actions={
          <>
            <StatusBadge status={product.status} />
            {canEdit && <Button leftIcon={<Edit size={16} />} onClick={() => navigate(`/products/${product.id}/edit`)}>Edit Product</Button>}
            {(canActivate || canDelete) && <Dropdown align="right" trigger={<Button variant="secondary" leftIcon={<MoreHorizontal size={16} />}>More Actions</Button>} items={[
              ...(canActivate && product.status !== 'archived' ? [{ key: product.status === 'active' ? 'deactivate' : 'activate', label: product.status === 'active' ? 'Deactivate Product' : 'Activate Product', icon: product.status === 'active' ? <PowerOff size={14} /> : <Power size={14} />, onClick: () => setPendingAction(product.status === 'active' ? 'deactivate' : 'activate') }] : []),
              ...(canDelete && product.status !== 'archived' ? [{ key: 'archive', label: 'Archive Product', icon: <Archive size={14} />, onClick: () => setPendingAction('archive') }] : []),
              ...(canDelete ? [{ key: 'delete', label: 'Delete Permanently', icon: <Trash2 size={14} />, danger: true, onClick: () => setPendingAction('delete') }] : []),
            ]} />}
          </>
        }
      />

      {product.status !== 'active' && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This product is {product.status} and is excluded from normal sales and purchasing selectors.
        </div>
      )}

      <ProductOverview product={product} branchName={currentBranch?.name} />

      <div className="mt-6"><ProductSuppliersSection productId={product.id} canManage={canEdit} canManagePrices={canManagePrices} /></div>

      <div className="mt-6"><ProductBundleSection product={product} canManage={canEdit} canManagePrices={canManagePrices} /></div>

      <div className="mt-6"><RelatedProductsSection productId={product.id} canManage={canEdit} /></div>

      <div className="mt-6"><ProductSpecificationsSection productId={product.id} canManage={canEdit} /></div>

      <div className="mt-6"><ProductImagesSection productId={product.id} canManage={canEdit} /></div>

      <div className="mt-6"><ProductDocumentsSection productId={product.id} canManage={canEdit} canDownload={canDownload} /></div>

      <div className="mt-6"><ProductVariantsSection product={product} canManage={canEdit} canManagePrices={canManagePrices} /></div>

      <div className="mt-6"><ProductLabelPreview product={product} canPrint={canPrint} /></div>

      <Card className="mt-6">
        <div className="flex items-center gap-2"><Layers3 size={20} className="text-slate-500" /><h2 className="text-base font-semibold text-slate-900">Extended Product Information</h2></div>
        <p className="mt-1 text-sm text-slate-500">Reserved areas for upcoming product and inventory capabilities.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {futureSections.map((section) => <div key={section} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs font-medium text-slate-500">{section}</div>)}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        title={pendingAction ? `${pendingAction[0].toUpperCase()}${pendingAction.slice(1)} Product` : 'Update Product'}
        message={pendingAction === 'delete'
          ? `Permanently delete ${product.name}? Products with variants, relationships, stock or other dependent records cannot be deleted and should be archived instead.`
          : pendingAction === 'archive'
            ? `Archive ${product.name}? It will remain visible to authorized users but will be excluded from normal transaction selectors.`
            : `${pendingAction === 'activate' ? 'Activate' : 'Deactivate'} ${product.name}?`}
        confirmLabel={pendingAction === 'delete' ? 'Delete Permanently' : pendingAction === 'archive' ? 'Archive Product' : pendingAction === 'activate' ? 'Activate Product' : 'Deactivate Product'}
        variant={pendingAction === 'delete' ? 'danger' : 'warning'}
        isLoading={mutations.isChangingStatus || mutations.isArchiving || mutations.isDeleting}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void confirmAction()}
      />
    </PageContainer>
  );
}
