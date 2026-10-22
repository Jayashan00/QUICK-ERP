import { useState } from 'react';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermission } from '@/core/permissions/permission-context';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { reviewService, type CustomerReview } from '@/features/storefront/reviewService';
import { productStore } from '@/features/products/services/productStore';
import { Button } from '@/shared/components/common/Button';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { appToast } from '@/shared/utils/toast';

export function CustomerReviewsPage() {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const { user } = useAuth();
  const canEdit = usePermission(PERMISSIONS.SALES_WORKFLOW.ORDER_EDIT);
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('pending');
  const [revision, refresh] = useState(0);
  const [confirm, setConfirm] = useState<{ review: CustomerReview; status: 'approved' | 'rejected' } | null>(null);
  const permitted = branches.map(branch => branch.id);
  const rows = reviewService.listForStaff(tenantId ?? '', permitted, branchId).filter(review => status === 'all' || review.status === status);
  const moderate = () => { if (!confirm) return; try { reviewService.moderate(tenantId ?? '', permitted, canEdit, confirm.review.id, confirm.status, user?.name ?? 'Staff'); refresh(value => value + 1); appToast.success(`Review ${confirm.status}.`); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to moderate review.'); } finally { setConfirm(null); } };
  void revision;
  return <PageContainer><PageHeader title="Customer reviews" description="Approve product feedback before it appears in the public shop. Order feedback is kept with the order review queue." /><div className="mb-4 flex flex-wrap gap-3"><label className="text-sm">Branch<select className="ml-2 rounded-lg border p-2" value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">All permitted branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-sm">Status<select className="ml-2 rounded-lg border p-2" value={status} onChange={event => setStatus(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label></div>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Date', 'Branch', 'Order', 'Customer', 'Subject', 'Rating', 'Feedback', 'Status', 'Actions'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map(review => <tr key={review.id} className="border-t align-top"><td className="whitespace-nowrap p-3">{new Date(review.createdAt).toLocaleDateString()}</td><td className="p-3">{branches.find(branch => branch.id === review.branchId)?.name ?? review.branchId}</td><td className="p-3">#{review.orderId.slice(0, 8)}</td><td className="p-3">{review.customerName}</td><td className="p-3">{review.target === 'order' ? 'Order experience' : productStore.all().find(product => product.id === review.productId && product.tenantId === review.tenantId)?.name ?? review.productId}</td><td className="p-3">{review.rating}/5</td><td className="max-w-xs whitespace-pre-wrap p-3">{review.comment}</td><td className="p-3 capitalize">{review.status}</td><td className="whitespace-nowrap p-3">{canEdit && review.status === 'pending' && <><Button size="sm" onClick={() => setConfirm({ review, status: 'approved' })}>Approve</Button><Button size="sm" variant="secondary" onClick={() => setConfirm({ review, status: 'rejected' })}>Reject</Button></>}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No reviews match these filters.</p>}</div>
    <ConfirmDialog isOpen={Boolean(confirm)} title={`${confirm?.status === 'approved' ? 'Approve' : 'Reject'} review`} message={`Change this review to ${confirm?.status ?? ''}?`} onCancel={() => setConfirm(null)} onConfirm={moderate} />
  </PageContainer>;
}
