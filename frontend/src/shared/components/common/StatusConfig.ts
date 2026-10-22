export type StatusVariant =
  "default" | "primary" | "success" | "warning" | "danger" | "info";

export interface StatusStyleConfig {
  label: string;
  variant: StatusVariant;
}

export const STATUS_CONFIG: Record<string, StatusStyleConfig> = {
  // Generic / Lifecycle
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "default" },
  draft: { label: "Draft", variant: "default" },
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "primary" },
  rejected: { label: "Rejected", variant: "danger" },
  archived: { label: "Archived", variant: "default" },
  cancelled: { label: "Cancelled", variant: "danger" },
  completed: { label: "Completed", variant: "success" },
  new: { label: "New", variant: "primary" },
  contacted: { label: "Contacted", variant: "info" },
  qualified: { label: "Qualified", variant: "success" },
  unqualified: { label: "Unqualified", variant: "warning" },
  converted: { label: "Converted", variant: "success" },
  lost: { label: "Lost", variant: "danger" },

  // Invoices & Payments
  paid: { label: "Paid", variant: "success" },
  unpaid: { label: "Unpaid", variant: "warning" },
  partially_paid: { label: "Partially Paid", variant: "info" },
  overdue: { label: "Overdue", variant: "danger" },
  refunded: { label: "Refunded", variant: "default" },

  // Orders
  confirmed: { label: "Confirmed", variant: "primary" },
  processing: { label: "Processing", variant: "info" },
  shipped: { label: "Shipped", variant: "info" },
  delivered: { label: "Delivered", variant: "success" },
  sent: { label: "Sent", variant: "info" },
  responses_received: { label: "Responses Received", variant: "info" },
  preferred: { label: "Preferred", variant: "success" },
  partially_received: { label: "Partially Received", variant: "warning" },
  partially_delivered: { label: "Partially Delivered", variant: "warning" },
  void: { label: "Void", variant: "danger" },
  matched: { label: "Matched", variant: "success" },
  mismatch: { label: "Discrepancy", variant: "danger" },

  // Inventory
  in_stock: { label: "In Stock", variant: "success" },
  low_stock: { label: "Low Stock", variant: "warning" },
  out_of_stock: { label: "Out of Stock", variant: "danger" },
  pending_approval: { label: "Pending Approval", variant: "warning" },
  pending_review: { label: "Pending Review", variant: "warning" },
  dispatched: { label: "Dispatched", variant: "info" },
  in_transit: { label: "In Transit", variant: "info" },
  received: { label: "Received", variant: "primary" },
  prepared: { label: "Prepared", variant: "success" },
  ready: { label: "Ready", variant: "warning" },

  // Subscriptions
  trial: { label: "Trial", variant: "info" },
  expired: { label: "Expired", variant: "danger" },
  revoked: { label: "Revoked", variant: "danger" },
  suspended: { label: "Suspended", variant: "danger" },

  // Opportunities
  open: { label: "Open", variant: "primary" },
  in_progress: { label: "In Progress", variant: "info" },
  waiting_for_user: { label: "Waiting for User", variant: "warning" },
  won: { label: "Won", variant: "success" },
  closed: { label: "Closed", variant: "default" },
  prospecting: { label: "Prospecting", variant: "info" },
  qualification: { label: "Qualification", variant: "primary" },
  proposal: { label: "Proposal", variant: "warning" },
  negotiation: { label: "Negotiation", variant: "info" },
  closed_won: { label: "Closed Won", variant: "success" },
  closed_lost: { label: "Closed Lost", variant: "danger" },
  valid: { label: "Valid", variant: "success" },
  skipped: { label: "Skipped", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
  operational: { label: "Operational", variant: "success" },
  degraded: { label: "Degraded", variant: "warning" },
  offline: { label: "Offline", variant: "danger" },
  connected: { label: "Connected", variant: "success" },
  disconnected: { label: "Disconnected", variant: "default" },
  syncing: { label: "Syncing", variant: "info" },
  synced: { label: "Synced", variant: "success" },
  pending_sync: { label: "Pending Sync", variant: "warning" },
  conflict: { label: "Conflict", variant: "danger" },
  resolved: { label: "Resolved", variant: "success" },
  high: { label: "High", variant: "danger" },
  urgent: { label: "Urgent", variant: "danger" },
  medium: { label: "Medium", variant: "warning" },
  low: { label: "Low", variant: "info" },
};
