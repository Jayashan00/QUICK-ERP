import type { EntityId } from "@/shared/types/common";

export type StockVelocityClass = "fast" | "medium" | "slow" | "no_movement";
export type StockVelocitySortField =
  | "productName"
  | "sku"
  | "stockOnHand"
  | "movementQuantity"
  | "inboundQuantity"
  | "outboundQuantity"
  | "inboundPerDay"
  | "outboundPerDay"
  | "movementCount"
  | "lastMovementAt"
  | "velocityClass";

export interface StockVelocityItem {
  id: string;
  tenantId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  productName: string;
  sku: string;
  categoryId: EntityId;
  categoryName: string;
  stockOnHand: number;
  movementQuantity: number;
  inboundQuantity: number;
  outboundQuantity: number;
  inboundPerDay: number;
  outboundPerDay: number;
  movementCount: number;
  lastMovementAt?: string;
  velocityClass: StockVelocityClass;
}
