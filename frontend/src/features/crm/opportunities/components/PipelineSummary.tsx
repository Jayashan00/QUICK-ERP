import { Target, DollarSign, PieChart, CheckCircle2, CircleDot, XCircle } from 'lucide-react';
import { StatCard } from '@/shared/components/cards/StatCard';
import type { Opportunity } from '@/features/crm/opportunities/types/opportunity';

interface PipelineSummaryProps {
  opportunities: Opportunity[];
}

export function PipelineSummary({ opportunities }: PipelineSummaryProps) {
  const totalCount = opportunities.length;

  const totalValue = opportunities.reduce(
    (sum, opp) => sum + (opp.expectedValue || 0),
    0
  );

  const weightedValue = Math.round(
    opportunities.reduce(
      (sum, opp) => sum + ((opp.expectedValue || 0) * (opp.probability || 0)) / 100,
      0
    )
  );

  const openCount = opportunities.filter((opp) => opp.status === 'open').length;
  const wonCount = opportunities.filter(
    (opp) => opp.stage === 'closed_won' || opp.status === 'won'
  ).length;
  const lostCount = opportunities.filter(
    (opp) => opp.stage === 'closed_lost' || opp.status === 'lost'
  ).length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        title="Total Opportunities"
        value={totalCount}
        description="Filtered opportunity records"
        icon={<Target size={20} />}
      />

      <StatCard
        title="Open"
        value={openCount}
        description="Currently active deals"
        icon={<CircleDot size={20} />}
      />

      <StatCard
        title="Won"
        value={wonCount}
        description="Successfully closed"
        icon={<CheckCircle2 size={20} />}
      />

      <StatCard
        title="Lost"
        value={lostCount}
        description="Closed without a sale"
        icon={<XCircle size={20} />}
      />

      <StatCard
        title="Pipeline Value"
        value={`$${totalValue.toLocaleString()}`}
        description="Gross expected revenue"
        icon={<DollarSign size={20} />}
      />

      <StatCard
        title="Weighted Forecast"
        value={`$${weightedValue.toLocaleString()}`}
        description="Probability-adjusted value"
        icon={<PieChart size={20} />}
      />

    </div>
  );
}
