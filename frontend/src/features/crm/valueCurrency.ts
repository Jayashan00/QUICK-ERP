/**
 * CRM values created before per-record currencies were introduced were stored
 * in the original company base currency. Keep that migration currency stable;
 * never infer an old record's currency from the current company setting.
 */
export const LEGACY_CRM_VALUE_CURRENCY = 'LKR';
export const CRM_VALUE_CURRENCY_VERSION = 1 as const;

export function resolveCrmValueCurrency(storedCurrency?: string): string {
  return storedCurrency?.trim().toUpperCase() || LEGACY_CRM_VALUE_CURRENCY;
}
