import { StatusBadge } from "@/shared/components/common/StatusBadge";
import type { SyncItemStatus } from "../types/sync";

export function SyncStatusBadge({ status }: { status?: SyncItemStatus }) {
  if (!status) return <StatusBadge status="synced" />;
  return <StatusBadge status={status} />;
}
