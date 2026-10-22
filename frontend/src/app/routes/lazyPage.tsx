import { lazy, Suspense, type ComponentType } from 'react';
import { LoadingState } from '@/shared/components/feedback/LoadingSpinner';

export function lazyPage(loader: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(loader);

  return function LazyRoutePage() {
    return (
      <Suspense fallback={<LoadingState message="Loading module..." />}>
        <Page />
      </Suspense>
    );
  };
}
