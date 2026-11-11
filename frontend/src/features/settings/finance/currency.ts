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

  const formatConfiguredAmount = useCallback((amount: number, code: string, fractionDigits?: number) => {
    if (!settings) {
      const precision = fractionDigits ?? 2;
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(amount);
    }
    const precision = fractionDigits ?? settings.decimalPrecision;
    const formattedAmount = new Intl.NumberFormat(settings.locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
      useGrouping: true,
    }).formatToParts(amount).map((part) => {
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
  }, [settings]);

  const formatMoney = useCallback((amount: number, currencyCode?: string) => {
    if (!settings) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
    const sourceCode = currencyCode ?? storedCurrency ?? settings.baseCurrency;
    const converted = convertCurrency(amount, sourceCode, settings.baseCurrency, exchange.rates);
    return formatConfiguredAmount(converted ?? amount, converted === null ? sourceCode : settings.baseCurrency);
  }, [exchange.rates, formatConfiguredAmount, settings, storedCurrency]);

  const formatMoneyInCurrency = useCallback((amount: number, currencyCode?: string) => {
    const code = currencyCode ?? storedCurrency ?? settings?.baseCurrency ?? '';
    return formatConfiguredAmount(amount, code);
  }, [formatConfiguredAmount, settings?.baseCurrency, storedCurrency]);

  const formatWholeMoneyInCurrency = useCallback((amount: number, currencyCode?: string) => {
    const code = currencyCode ?? storedCurrency ?? settings?.baseCurrency ?? '';
    return formatConfiguredAmount(Math.round(amount), code, 0);
  }, [formatConfiguredAmount, settings?.baseCurrency, storedCurrency]);

  const convertToBaseAmount = useCallback((amount: number, sourceCurrency?: string) => {
    const baseCurrency = settings?.baseCurrency ?? storedCurrency;
    const sourceCode = sourceCurrency ?? storedCurrency ?? baseCurrency;
    if (!baseCurrency || !sourceCode) return null;
    return convertCurrency(amount, sourceCode, baseCurrency, exchange.rates);
  }, [exchange.rates, settings?.baseCurrency, storedCurrency]);

  return {
    currencyCode: settings?.baseCurrency,
    supportedCurrencies: settings?.supportedCurrencies ?? [],
    currencyLabel: settings
      ? settings.currencyDisplay === 'code'
        ? settings.baseCurrency
        : currencySymbol(settings.baseCurrency, settings.locale)
      : '…',
    formatMoney,
    formatMoneyInCurrency,
    formatWholeMoneyInCurrency,
    convertToBaseAmount,
    rateDate: exchange.rateDate,
    isLoading: localization.isLoading || exchange.isLoading,
    error: localization.error ?? exchange.error,
  };
}
