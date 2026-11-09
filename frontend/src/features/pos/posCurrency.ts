import { useCallback } from 'react';
import { convertCurrency, useExchangeRates } from '@/features/settings/finance/exchangeRates';
import { posSettingsService } from './posSettings';

export const POS_STORED_CURRENCY = 'LKR';

const display = (amount: number, currency: string) => new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency,
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(amount);

export function usePosCurrency(tenantId: string, branchId: string) {
  const currencyCode = posSettingsService.get(tenantId, branchId).currency;
  const exchange = useExchangeRates(currencyCode);
  const toDisplayValue = useCallback((amount: number) => convertCurrency(amount, POS_STORED_CURRENCY, currencyCode, exchange.rates), [currencyCode, exchange.rates]);
  const toStoredValue = useCallback((amount: number) => {
    if (currencyCode === POS_STORED_CURRENCY) return amount;
    const row = exchange.rates.get(POS_STORED_CURRENCY);
    return row?.base === currencyCode ? amount * row.rate : null;
  }, [currencyCode, exchange.rates]);
  const formatMoney = useCallback((amount: number) => {
    const converted = toDisplayValue(amount);
    return converted === null ? display(amount, POS_STORED_CURRENCY) : display(converted, currencyCode);
  }, [currencyCode, toDisplayValue]);
  const formatDisplayMoney = useCallback((amount: number) => display(amount, currencyCode), [currencyCode]);
  return { currencyCode, formatMoney, formatDisplayMoney, toDisplayValue, toStoredValue, rateDate: exchange.rateDate, isLoading: exchange.isLoading, error: exchange.error };
}
