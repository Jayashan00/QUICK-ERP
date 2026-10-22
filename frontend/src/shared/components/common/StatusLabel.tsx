import { STATUS_CONFIG } from './StatusConfig';

interface StatusLabelProps {
  status: string;
  className?: string;
}

export function StatusLabel({ status, className }: StatusLabelProps) {
  const config = STATUS_CONFIG[status.toLowerCase()];
  const displayLabel = config?.label || status;

  return <span className={className}>{displayLabel}</span>;
}
