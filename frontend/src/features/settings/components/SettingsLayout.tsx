import { Outlet } from 'react-router-dom';
import { PageContainer } from '@/shared/components/layout/PageContainer';

export function SettingsLayout() {
  return (
    <PageContainer>
      <main className="min-w-0">
        <Outlet />
      </main>
    </PageContainer>
  );
}
