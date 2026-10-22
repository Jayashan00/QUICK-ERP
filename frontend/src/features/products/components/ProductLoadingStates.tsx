import { Skeleton } from '@/shared/components/feedback/Skeleton';

export function ProductSectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-5 space-y-3" role="status" aria-label="Loading product information">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-4">
          <Skeleton width={index % 2 ? '45%' : '60%'} height={16} />
          <div className="mt-3"><Skeleton height={12} /></div>
        </div>
      ))}
    </div>
  );
}

export function ProductPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading product page">
      <div className="space-y-3"><Skeleton width="35%" height={30} /><Skeleton width="55%" height={16} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={96} />)}
      </div>
      <Skeleton height={280} />
    </div>
  );
}
