import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { appToast } from '@/shared/utils/toast';
import type { StoreOrder } from './storefrontService';
import { reviewSchema, reviewService, type ReviewInput } from './reviewService';

export function ProductReviewSummary({ scope, productId }: { scope: TenantBranchScope; productId: string }) {
  const reviews = reviewService.publicProduct(scope, productId);
  if (!reviews.length) return <p className="text-xs text-slate-500">No reviews yet</p>;
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return <details className="text-xs"><summary className="cursor-pointer text-amber-700">★ {average.toFixed(1)} ({reviews.length} reviews)</summary><ul className="mt-2 space-y-2">{reviews.map(review => <li key={review.id} className="rounded border p-2"><strong>{review.rating}/5 · {review.customerName}</strong><p className="mt-1 text-slate-600">{review.comment}</p></li>)}</ul></details>;
}

export function CustomerReviews({ scope, order, token }: { scope: TenantBranchScope; order: StoreOrder; token: string }) {
  const [revision, refresh] = useState(0);
  const form = useForm<ReviewInput>({ resolver: zodResolver(reviewSchema), defaultValues: { target: 'product', productId: order.items[0]?.productId ?? '', rating: 5, comment: '' } });
  const submitted = reviewService.forOrder(scope, order.id, token);
  const target = form.watch('target');
  const save = form.handleSubmit(value => { try { reviewService.submit(scope, order.id, token, value); form.reset({ target: 'product', productId: order.items[0]?.productId ?? '', rating: 5, comment: '' }); refresh(n => n + 1); appToast.success('Review submitted for approval.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to submit review.'); } });
  void revision;
  if (order.status !== 'completed') return null;
  return <section className="mt-6 border-t pt-5"><h2 className="text-lg font-semibold">Review this order</h2><p className="mt-1 text-sm text-slate-600">You can leave one review for the order and one for each purchased product. Reviews appear in the shop after approval.</p>
    {submitted.length > 0 && <ul className="mt-3 space-y-2 text-sm">{submitted.map(review => <li key={review.id} className="rounded-lg border p-3"><strong>{review.target === 'order' ? 'Order' : order.items.find(item => item.productId === review.productId)?.name} · {review.rating}/5</strong><span className="ml-2 capitalize text-slate-500">{review.status}</span><p className="mt-1">{review.comment}</p></li>)}</ul>}
    <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Review type<select className="mt-1 w-full rounded-lg border p-2" {...form.register('target')}><option value="product">Product</option><option value="order">Order experience</option></select></label>{target === 'product' && <label className="text-sm">Product<select className="mt-1 w-full rounded-lg border p-2" {...form.register('productId')}>{order.items.map(item => <option key={item.productId} value={item.productId}>{item.name}</option>)}</select><span className="text-xs text-red-700">{form.formState.errors.productId?.message}</span></label>}<label className="text-sm">Rating<select className="mt-1 w-full rounded-lg border p-2" {...form.register('rating', { valueAsNumber: true })}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label><label className="text-sm sm:col-span-2">Feedback<textarea className="mt-1 min-h-24 w-full rounded-lg border p-2" maxLength={1000} {...form.register('comment')} /><span className="text-xs text-red-700">{form.formState.errors.comment?.message}</span></label><button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white sm:col-span-2">Submit review</button></form>
  </section>;
}
