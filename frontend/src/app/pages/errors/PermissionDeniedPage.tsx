import { PermissionDenied } from '@/shared/components/feedback/PermissionDenied';

export function PermissionDeniedPage() {
  return (
    <PermissionDenied message="You don't have permission to access this page. Contact your administrator if you need access." />
  );
}
