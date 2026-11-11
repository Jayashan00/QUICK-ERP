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
    globalThis.setTimeout(resolve, ms);
  });

interface SystemActivityInput {
  subject: string;
  description?: string;
  status?: LeadActivity["status"];
  scheduledAt?: string;
  assignedTo?: string;
  systemEventKey?: string;
}

const buildActivity = (
  scope: TenantBranchScope,
  leadId: string,
  data: Omit<LeadActivity, "id" | "tenantId" | "branchId" | "leadId" | "createdAt" | "updatedAt">,
): LeadActivity => {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    tenantId: scope.tenantId,
    branchId: scope.branchId,
    leadId,
    ...data,
    completedAt: data.status === "completed" ? now : data.completedAt,
    createdAt: now,
    updatedAt: now,
  };
};

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

    const activity = buildActivity(scope, leadId, {
      ...data,
      origin: "manual",
    });

    activities = [
      activity,
      ...activities,
    ];

    return activity;
  },

  async recordSystemActivity(
    scope: TenantBranchScope,
    leadId: string,
    data: SystemActivityInput,
  ): Promise<LeadActivity> {
    await delay();

    if (data.systemEventKey) {
      const existing = activities.find(
        (activity) =>
          activity.leadId === leadId &&
          activity.systemEventKey === data.systemEventKey &&
          belongsToScope(activity, scope),
      );
      if (existing) return existing;
    }

    const activity = buildActivity(scope, leadId, {
      type: "note",
      status: data.status ?? "completed",
      subject: data.subject,
      description: data.description,
      scheduledAt: data.scheduledAt,
      assignedTo: data.assignedTo,
      origin: "system",
      systemEventKey: data.systemEventKey,
    });

    activities = [activity, ...activities];
    return activity;
  },

  async syncNextFollowUp(
    scope: TenantBranchScope,
    leadId: string,
    scheduledAt?: string,
    assignedTo?: string,
  ): Promise<LeadActivity | null> {
    await delay();

    const existingIndex = activities.findIndex(
      (activity) =>
        activity.leadId === leadId &&
        activity.systemEventKey === "next-follow-up" &&
        activity.status === "planned" &&
        belongsToScope(activity, scope),
    );

    if (!scheduledAt) {
      if (existingIndex === -1) return null;

      const cancelled: LeadActivity = {
        ...activities[existingIndex],
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      };
      activities = activities.map((activity, index) => index === existingIndex ? cancelled : activity);
      return cancelled;
    }

    if (existingIndex >= 0) {
      const updated: LeadActivity = {
        ...activities[existingIndex],
        scheduledAt,
        assignedTo,
        description: "Follow-up synchronized from the lead's Next Follow-up field.",
        updatedAt: new Date().toISOString(),
      };
      activities = activities.map((activity, index) => index === existingIndex ? updated : activity);
      return updated;
    }

    const activity = buildActivity(scope, leadId, {
      type: "task",
      status: "planned",
      subject: "Lead follow-up",
      description: "Follow-up synchronized from the lead's Next Follow-up field.",
      scheduledAt,
      assignedTo,
      origin: "system",
      systemEventKey: "next-follow-up",
    });
    activities = [activity, ...activities];
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

  async deleteByLeadId(scope: TenantBranchScope, leadId: string): Promise<void> {
    await delay();
    activities = activities.filter(
      (activity) => !(activity.leadId === leadId && belongsToScope(activity, scope)),
    );
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('crm.leadActivities', () => activities, (rows) => { activities = rows; });
