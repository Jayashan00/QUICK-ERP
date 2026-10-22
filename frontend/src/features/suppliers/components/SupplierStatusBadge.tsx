import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { SupplierStatus } from '../types/supplier';

interface SupplierStatusBadgeProps {
  status: SupplierStatus;
  className?: string;
}

export function SupplierStatusBadge({ status, className }: SupplierStatusBadgeProps) {
  return <StatusBadge status={status} className={className} />;
}
