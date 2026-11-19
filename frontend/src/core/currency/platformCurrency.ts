import type { SystemCurrency } from '@/features/platform/types/platform';

// Fixed rates for the mock platform. Replace with a provider-backed rate lookup
// in production while keeping this conversion function for display and storage.
export const PLATFORM_EXCHANGE_RATES: Record<SystemCurrency, number> = {
  USD: 1,
  LKR: 300,
};

export function convertPlatformCurrency(amount: number, from: SystemCurrency, to: SystemCurrency): number {
  if (from === to) return amount;
  const amountInUsd = amount / PLATFORM_EXCHANGE_RATES[from];
  return amountInUsd * PLATFORM_EXCHANGE_RATES[to];
}
