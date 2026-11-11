import { Target, Banknote, PieChart, CheckCircle2, CircleDot, XCircle } from 'lucide-react';
import { StatCard } from '@/shared/components/cards/StatCard';
import type { Opportunity } from '@/features/crm/opportunities/types/opportunity';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { resolveCrmValueCurrency } from '@/features/crm/valueCurrency';

interface PipelineSummaryProps {
  opportunities: Opportunity[];
}

export function PipelineSummary({ opportunities }: PipelineSummaryProps) {
  const {
    currencyCode,
    convertToBaseAmount,
    formatWholeMoneyInCurrency,
    isLoading: isCurrencyLoading,
    rateDate,
  } = useTenantCurrency();
  const totalCount = opportunities.length;
  const baseTotals = opportunities.reduce(
    (totals, opportunity) => {
      const sourceCurrency = resolveCrmValueCurrency(opportunity.expectedCurrency);
      const baseValue = convertToBaseAmount(opportunity.expectedValue || 0, sourceCurrency);
      if (baseValue === null) {
        totals.unavailableCurrencies.add(sourceCurrency ?? 'unknown');
        return totals;
      }
      totals.total += baseValue;
      totals.weighted += (baseValue * (opportunity.probability || 0)) / 100;
      return totals;
    },
    { total: 0, weighted: 0, unavailableCurrencies: new Set<string>() },
  );
  const hasForeignCurrency = opportunities.some(
    (opportunity) => resolveCrmValueCurrency(opportunity.expectedCurrency) !== currencyCode,
  );
  const isWaitingForRates = isCurrencyLoading && hasForeignCurrency;
  const missingRates = [...baseTotals.unavailableCurrencies].filter((code) => code !== 'unknown');
  const hasMissingRates = baseTotals.unavailableCurrencies.size > 0;
  const formatBaseTotal = (amount: number) => {
    if (isWaitingForRates) return 'Converting…';
    if (hasMissingRates) return 'Rate unavailable';
    return formatWholeMoneyInCurrency(amount, currencyCode);
  };
  const conversionDescription = isWaitingForRates
    ? `Converting to company base currency${currencyCode ? ` (${currencyCode})` : ''}`
    : hasMissingRates
      ? `Missing ${missingRates.join(', ') || 'currency'} exchange rate`
      : `Converted to company base currency${currencyCode ? ` (${currencyCode})` : ''}${rateDate && hasForeignCurrency ? ` using ${rateDate} rates` : ''}`;

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
        value={formatBaseTotal(baseTotals.total)}
        description={conversionDescription}
        icon={<Banknote size={20} />}
      />

      <StatCard
        title="Weighted Forecast"
        value={formatBaseTotal(baseTotals.weighted)}
        description={conversionDescription}
        icon={<PieChart size={20} />}
      />

    </div>
  );
}
