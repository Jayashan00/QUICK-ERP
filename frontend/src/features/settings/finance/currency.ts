import { useCallback } from 'react';
import { useLocalizationSettings } from './hooks/useTenantSettings';

function currencySymbol(currencyCode: string, locale: string) {
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
  const localization = useLocalizationSettings();
  const settings = localization.settings;

  const formatMoney = useCallback((amount: number) => {
    if (!settings) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
    const formattedAmount = new Intl.NumberFormat(settings.locale, {
      minimumFractionDigits: settings.decimalPrecision,
      maximumFractionDigits: settings.decimalPrecision,
      useGrouping: true,
    }).formatToParts(amount).map((part) => {
      if (part.type === 'group') return settings.thousandsSeparator;
      if (part.type === 'decimal') return settings.decimalSeparator;
      return part.value;
    }).join('');
    const symbol = currencySymbol(settings.baseCurrency, settings.locale);
    const label = settings.currencyDisplay === 'code'
      ? settings.baseCurrency
      : settings.currencyDisplay === 'symbol_code'
        ? `${symbol} ${settings.baseCurrency}`
        : symbol;
    return settings.currencyPosition === 'after'
      ? `${formattedAmount} ${label}`
      : `${label} ${formattedAmount}`;
  }, [settings]);

  return {
    currencyCode: settings?.baseCurrency,
    currencyLabel: settings
      ? settings.currencyDisplay === 'code'
        ? settings.baseCurrency
        : currencySymbol(settings.baseCurrency, settings.locale)
      : '…',
    formatMoney,
    isLoading: localization.isLoading,
    error: localization.error,
  };
}
