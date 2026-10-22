export { useTaxRates } from './hooks/useTenantSettings';
export type { TaxRate } from './types/tenant-settings';

import type { TaxRate } from './types/tenant-settings';
import { tenantSettingsService } from './services/tenantSettingsService';

export const getTenantTaxRates = (tenantId: string) => tenantSettingsService.getTaxes(tenantId);

export function isSalesTaxApplicable(tax: TaxRate, at = new Date()) {
  const date = at.toISOString().slice(0, 10);
  return tax.isActive
    && (tax.type === 'sales' || tax.type === 'both')
    && tax.effectiveFrom <= date
    && (!tax.effectiveTo || tax.effectiveTo >= date);
}
