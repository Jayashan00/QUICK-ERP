import { z } from 'zod';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { storefrontService } from './storefrontService';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

export const reviewSchema = z.object({
  target: z.enum(['order', 'product']), productId: z.string(),
  rating: z.number().int().min(1).max(5), comment: z.string().trim().min(10).max(1000),
}).refine(value => value.target !== 'product' || Boolean(value.productId), { path: ['productId'], message: 'Choose a product.' });
export type ReviewInput = z.infer<typeof reviewSchema>;
export type CustomerReview = ReviewInput & { id: string; tenantId: string; branchId: string; orderId: string; customerName: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string; moderatedAt?: string; moderatedBy?: string };
const reviews: CustomerReview[] = [];

export const reviewService = {
  submit(scope: TenantBranchScope, orderId: string, token: string, input: ReviewInput) {
    const order = storefrontService.track(scope, orderId, token);
    if (!order || order.status !== 'completed') throw new Error('A completed order and its tracking link are required to leave a review.');
    const value = reviewSchema.parse(input);
    if (value.target === 'product' && !order.items.some(item => item.productId === value.productId)) throw new Error('You can only review products in this order.');
    if (reviews.some(review => review.tenantId === scope.tenantId && review.branchId === scope.branchId && review.orderId === orderId && review.target === value.target && review.productId === (value.target === 'product' ? value.productId : ''))) throw new Error('You already reviewed this item or order.');
    const review: CustomerReview = { ...value, productId: value.target === 'order' ? '' : value.productId, id: crypto.randomUUID(), tenantId: scope.tenantId, branchId: scope.branchId, orderId, customerName: order.customer.name, status: 'pending', createdAt: new Date().toISOString() };
    reviews.unshift(review); return review;
  },
  forOrder(scope: TenantBranchScope, orderId: string, token: string) {
    if (!storefrontService.track(scope, orderId, token)) return [];
    return reviews.filter(review => review.tenantId === scope.tenantId && review.branchId === scope.branchId && review.orderId === orderId);
  },
  publicProduct(scope: TenantBranchScope, productId: string) { return reviews.filter(review => review.tenantId === scope.tenantId && review.branchId === scope.branchId && review.productId === productId && review.target === 'product' && review.status === 'approved'); },
  listForStaff(tenantId: string, permittedBranches: string[], branchId = '') { return reviews.filter(review => review.tenantId === tenantId && permittedBranches.includes(review.branchId) && (!branchId || review.branchId === branchId)); },
  moderate(tenantId: string, permittedBranches: string[], canEdit: boolean, id: string, status: 'approved' | 'rejected', actor: string) {
    if (!canEdit) throw new Error('Review moderation permission is required.');
    const review = reviews.find(row => row.id === id && row.tenantId === tenantId && permittedBranches.includes(row.branchId));
    if (!review || review.status !== 'pending') throw new Error('Only pending reviews can be moderated.');
    review.status = status; review.moderatedAt = new Date().toISOString(); review.moderatedBy = actor; return review;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('storefront.reviews', () => reviews, (rows) => replaceArray(reviews, rows));
