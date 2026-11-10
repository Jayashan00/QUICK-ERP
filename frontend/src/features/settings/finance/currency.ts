import { useCallback } from 'react';
import { useTenant } from '@/core/tenant/tenant-context';
import { useLocalizationSettings } from './hooks/useTenantSettings';
import { convertCurrency, useExchangeRates } from './exchangeRates';

function currencySymbol(currencyCode: string, locale: string) {
  if (currencyCode === 'LKR') return 'LKR';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

export function useTenantCurrency() {
  const { currentTenant } = useTenant();
  const localization = useLocalizationSettings();
  const settings = localization.settings;
  const exchange = useExchangeRates(settings?.baseCurrency);
  const storedCurrency = currentTenant?.currency ?? settings?.baseCurrency;

  const formatMoney = useCallback((amount: number, currencyCode?: string) => {
    if (!settings) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
    const sourceCode = currencyCode ?? storedCurrency ?? settings.baseCurrency;
    const converted = convertCurrency(amount, sourceCode, settings.baseCurrency, exchange.rates);
    const code = converted === null ? sourceCode : settings.baseCurrency;
    const value = converted ?? amount;
    const formattedAmount = new Intl.NumberFormat(settings.locale, {
      minimumFractionDigits: settings.decimalPrecision,
      maximumFractionDigits: settings.decimalPrecision,
      useGrouping: true,
    }).formatToParts(value).map((part) => {
      if (part.type === 'group') return settings.thousandsSeparator;
      if (part.type === 'decimal') return settings.decimalSeparator;
      return part.value;
    }).join('');
    const symbol = currencySymbol(code, settings.locale);
    const label = settings.currencyDisplay === 'code'
      ? code
      : settings.currencyDisplay === 'symbol_code'
        ? symbol === code ? code : `${symbol} ${code}`
        : symbol;
    return settings.currencyPosition === 'after'
      ? `${formattedAmount} ${label}`
      : `${label} ${formattedAmount}`;
  }, [exchange.rates, settings, storedCurrency]);

  return {
    currencyCode: settings?.baseCurrency,
    currencyLabel: settings
      ? settings.currencyDisplay === 'code'
        ? settings.baseCurrency
        : currencySymbol(settings.baseCurrency, settings.locale)
      : '…',
    formatMoney,
    rateDate: exchange.rateDate,
    isLoading: localization.isLoading || exchange.isLoading,
    error: localization.error ?? exchange.error,
  };
}
