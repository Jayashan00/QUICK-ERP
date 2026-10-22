import {
  mockLeadActivities,
} from "@/features/crm/leads/mocks/leadActivities";

import type { LeadActivity } from '@/features/crm/leads/types/lead-activity';

import type {
  LeadActivityFormValues,
} from "../schemas/leadActivitySchema";
import { belongsToScope, type TenantBranchScope } from "@/core/tenant/dataScope";
import { registerList } from '@/core/persistence/stateRegistry';

let activities: LeadActivity[] = [
  ...mockLeadActivities,
];

const delay = (ms = 200) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const leadActivityService = {
  async getByLeadId(
    scope: TenantBranchScope,
    leadId: string,
  ): Promise<LeadActivity[]> {
    await delay();

    return activities
      .filter(
        (activity) =>
          activity.leadId === leadId &&
          belongsToScope(activity, scope),
      )
      .sort((a, b) => {
        const aDate =
          a.scheduledAt ??
          a.createdAt;

        const bDate =
          b.scheduledAt ??
          b.createdAt;

        return (
          new Date(bDate).getTime() -
          new Date(aDate).getTime()
        );
      });
  },

  async create(
    scope: TenantBranchScope,
    leadId: string,
    data: LeadActivityFormValues,
  ): Promise<LeadActivity> {
    await delay();

    const now =
      new Date().toISOString();

    const activity: LeadActivity = {
      id: crypto.randomUUID(),
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      leadId,

      ...data,

      completedAt:
        data.status === "completed"
          ? now
          : undefined,

      createdAt: now,
      updatedAt: now,
    };

    activities = [
      activity,
      ...activities,
    ];

    return activity;
  },

  async updateStatus(
    scope: TenantBranchScope,
    id: string,
    status:
      LeadActivity["status"],
  ): Promise<LeadActivity> {
    await delay();

    const activity =
      activities.find(
        (item) => item.id === id && belongsToScope(item, scope),
      );

    if (!activity) {
      throw new Error(
        "Lead activity not found",
      );
    }

    const updatedActivity: LeadActivity =
      {
        ...activity,
        status,

        completedAt:
          status === "completed"
            ? new Date().toISOString()
            : undefined,

        updatedAt:
          new Date().toISOString(),
      };

    activities = activities.map(
      (item) =>
        item.id === id
          ? updatedActivity
          : item,
    );

    return updatedActivity;
  },

  async delete(
    scope: TenantBranchScope,
    id: string,
  ): Promise<void> {
    await delay();

    const exists = activities.some(
      (activity) =>
        activity.id === id && belongsToScope(activity, scope),
    );

    if (!exists) {
      throw new Error(
        "Lead activity not found",
      );
    }

    activities = activities.filter(
      (activity) =>
        activity.id !== id,
    );
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('crm.leadActivities', () => activities, (rows) => { activities = rows; });
