import type { LeadActivity } from '@/features/crm/leads/types/lead-activity';

export const mockLeadActivities: LeadActivity[] = [
  {
    id: "activity-001",
    tenantId: "tenant-001",
    branchId: "branch-001",
    leadId: "lead-001",

    type: "call",
    status: "completed",

    subject: "Initial discovery call",
    description:
      "Discussed inventory and POS requirements.",

    scheduledAt:
      "2026-09-16T09:30:00.000Z",

    completedAt:
      "2026-09-16T09:45:00.000Z",

    assignedTo: "usr-002",

    createdAt:
      "2026-09-15T08:45:00.000Z",

    updatedAt:
      "2026-09-16T09:45:00.000Z",
  },

  {
    id: "activity-002",
    tenantId: "tenant-001",
    branchId: "branch-001",
    leadId: "lead-001",

    type: "meeting",
    status: "planned",

    subject: "ERP product demonstration",
    description:
      "Demonstrate CRM, inventory and POS modules.",

    scheduledAt:
      "2026-09-22T05:30:00.000Z",

    assignedTo: "usr-002",

    createdAt:
      "2026-09-16T10:00:00.000Z",

    updatedAt:
      "2026-09-16T10:00:00.000Z",
  },

  {
    id: "activity-003",
    tenantId: "tenant-001",
    branchId: "branch-002",
    leadId: "lead-002",

    type: "email",
    status: "completed",

    subject: "Product information sent",
    description:
      "Sent requested ERP product information.",

    completedAt:
      "2026-09-17T06:00:00.000Z",

    assignedTo: "usr-004",

    createdAt:
      "2026-09-17T05:50:00.000Z",

    updatedAt:
      "2026-09-17T06:00:00.000Z",
  },
];
