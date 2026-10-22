import { BaseEntity } from '@/shared/types/common';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';
export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlan extends BaseEntity {
  name: string;
  code: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxUsers: number;
  maxBranches: number;
  maxStorageGb: number;
  features: string[];
  isActive: boolean;
}

export interface Subscription extends BaseEntity {
  tenantId: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  userCount: number;
  branchCount: number;
}
