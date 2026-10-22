import type { ReactNode } from 'react';
import { StatCard } from '@/shared/components/cards/StatCard';

export interface DashboardMetric {
  key: string;
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
}

export function DashboardMetricGrid({ metrics }: { metrics: DashboardMetric[] }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <StatCard key={metric.key} title={metric.title} value={metric.value} description={metric.description} icon={metric.icon} />)}</div>;
}
