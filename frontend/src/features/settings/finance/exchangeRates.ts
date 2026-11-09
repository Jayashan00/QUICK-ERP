import { useQuery } from '@tanstack/react-query';

const API_BASE = 'https://api.frankfurter.dev/v2';

export interface ExchangeRateRow {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

const normalize = (currency: string) => currency.trim().toUpperCase();

export const exchangeRateService = {
  async latest(targetCurrency: string): Promise<ExchangeRateRow[]> {
    const target = normalize(targetCurrency);
    const response = await fetch(`${API_BASE}/rates?base=${encodeURIComponent(target)}`);
    if (!response.ok) throw new Error(`Exchange-rate provider returned ${response.status}.`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Exchange-rate provider returned an invalid response.');
    return payload.flatMap((item): ExchangeRateRow[] => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Partial<ExchangeRateRow>;
      if (typeof row.date !== 'string' || typeof row.base !== 'string' || typeof row.quote !== 'string' || typeof row.rate !== 'number' || !Number.isFinite(row.rate) || row.rate <= 0) return [];
      return [{ date: row.date, base: normalize(row.base), quote: normalize(row.quote), rate: row.rate }];
    });
  },
};

export function useExchangeRates(targetCurrency?: string) {
  const target = targetCurrency ? normalize(targetCurrency) : '';
  const query = useQuery({
    queryKey: ['exchange-rates', 'frankfurter', target],
    queryFn: () => exchangeRateService.latest(target),
    enabled: Boolean(target),
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
  const rates = new Map((query.data ?? []).map((row) => [row.quote, row]));
  const dates = (query.data ?? []).map((row) => row.date).sort();
  return {
    rates,
    rateDate: dates[dates.length - 1],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? 'Exchange rates are unavailable.' : null,
  };
}

export function convertCurrency(amount: number, sourceCurrency: string, targetCurrency: string, rates: Map<string, ExchangeRateRow>): number | null {
  const source = normalize(sourceCurrency);
  const target = normalize(targetCurrency);
  if (source === target) return amount;
  const row = rates.get(source);
  if (!row || row.base !== target) return null;
  return amount / row.rate;
}
