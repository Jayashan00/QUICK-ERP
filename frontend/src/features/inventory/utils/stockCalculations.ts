import type { ExpiryStatus, StockAlertStatus } from "../types/inventory";

export function calculateAvailableQuantity(
  onHand: number,
  committed: number,
) {
  return Math.max(0, onHand - committed);
}

export function getStockAlertStatus(
  available: number,
  minLevel = 0,
  reorderLevel = minLevel,
): StockAlertStatus {
  if (available <= 0) return "out_of_stock";
  if (available <= minLevel) return "reorder_required";
  if (available <= reorderLevel) return "low_stock";
  return "healthy";
}

export function getExpiryState(
  expiryDate: string,
  alertThresholdDays: number,
  today = new Date(),
) {
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const daysRemaining = Math.ceil((expiry.getTime() - start) / 86_400_000);
  const status: ExpiryStatus =
    daysRemaining < 0
      ? "expired"
      : daysRemaining <= alertThresholdDays
        ? "expiring_soon"
        : "healthy";
  return { daysRemaining, status };
}
