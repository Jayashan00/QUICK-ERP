import { useMemo, useState } from "react";
import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/shared/components/common/Button";
import type { DropdownItem } from "@/shared/components/common/Dropdown";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { Select } from "@/shared/components/forms/Select";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import type { Column } from "@/shared/components/tables/TableHeader";
import { PERMISSIONS } from "@/core/permissions";
import { appToast } from "@/shared/utils/toast";
import { usePermissions } from "@/core/permissions/permission-context";
import type { LoginSession } from '@/features/settings/security/types/login-session';
import { useLoginSessions } from '@/features/settings/security/hooks/useLoginActivity';

const columns: Column<LoginSession>[] = [
  {
    key: "userName",
    header: "User",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-900">
          {row.userName}
          {row.isCurrent && (
            <span className="ml-2 text-xs font-semibold text-blue-600">
              Current
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">{row.userEmail}</p>
      </div>
    ),
  },
  {
    key: "device",
    header: "Device / Browser",
    render: (row) => (
      <div>
        <p>{row.device}</p>
        <p className="text-xs text-slate-500">{row.browser}</p>
      </div>
    ),
  },
  {
    key: "ipAddress",
    header: "IP / Location",
    render: (row) => (
      <div>
        <p className="font-mono text-xs">{row.ipAddress}</p>
        <p className="text-xs text-slate-500">{row.location}</p>
      </div>
    ),
  },
  {
    key: "loginAt",
    header: "Login time",
    render: (row) => new Date(row.loginAt).toLocaleString(),
  },
  {
    key: "lastActivityAt",
    header: "Last activity",
    render: (row) => new Date(row.lastActivityAt).toLocaleString(),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export function LoginActivityPage() {
  const data = useLoginSessions();
  const { hasPermission } = usePermissions();
  const canRevoke =
    hasPermission(PERMISSIONS.SETTINGS.LOGIN_ACTIVITY_DELETE) ||
    hasPermission(PERMISSIONS.SETTINGS.LOGIN_ACTIVITY_CONFIGURE);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [target, setTarget] = useState<LoginSession | null>(null);
  const [revokeOthers, setRevokeOthers] = useState(false);
  const filtered = useMemo(
    () =>
      data.sessions.filter(
        (session) =>
          (status === "all" || session.status === status) &&
          `${session.userName} ${session.userEmail} ${session.device} ${session.browser} ${session.ipAddress} ${session.location}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data.sessions, search, status],
  );
  const hasOtherCurrentUserSessions = data.sessions.some(
    (session) =>
      session.userId === data.currentUserId &&
      !session.isCurrent &&
      session.status === "active",
  );
  const actions = (session: LoginSession): DropdownItem[] =>
    canRevoke && !session.isCurrent && session.status === "active"
      ? [
          {
            key: "revoke",
            label: "Revoke Session",
            icon: <LogOut size={15} />,
            danger: true,
            onClick: () => setTarget(session),
          },
        ]
      : [];
  if (data.error)
    return (
      <ErrorState message={data.error} onRetry={() => void data.refetch()} />
    );
  const revoke = async () => {
    if (!target) return;
    try {
      await data.revoke(target.id);
      appToast.success(`Session revoked for ${target.userName}.`);
      setTarget(null);
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to revoke session.",
      );
    }
  };
  const revokeMyOthers = async () => {
    try {
      const count = await data.revokeOthers();
      appToast.success(
        count
          ? `${count} other session${count === 1 ? "" : "s"} signed out.`
          : "No other active sessions found.",
      );
      setRevokeOthers(false);
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Unable to sign out other sessions.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Login Activity & Sessions"
        description="Review tenant login activity and revoke active sessions."
        actions={
          canRevoke && hasOtherCurrentUserSessions ? (
            <Button
              variant="secondary"
              leftIcon={<ShieldAlert size={16} />}
              onClick={() => setRevokeOthers(true)}
            >
              Sign Out My Other Sessions
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        isLoading={data.isLoading}
        emptyTitle="No login activity found"
        emptyMessage="No tenant sessions match the current search and status filter."
        rowActions={actions}
        toolbar={
          <TableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search user, device, IP, or location..."
            filters={
              <Select
                className="w-36"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "active", label: "Active" },
                  { value: "revoked", label: "Revoked" },
                  { value: "expired", label: "Expired" },
                  { value: "failed", label: "Failed" },
                ]}
              />
            }
          />
        }
      />
      <ConfirmDialog
        isOpen={Boolean(target)}
        title="Revoke Session"
        message={`Sign out ${target?.userName ?? "this user"} from ${target?.device ?? "this device"}?`}
        confirmLabel="Revoke Session"
        variant="danger"
        isLoading={data.isRevoking}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
      />
      <ConfirmDialog
        isOpen={revokeOthers}
        title="Sign Out Other Sessions"
        message="Sign out all other active sessions for your user account? Your current session will remain active."
        confirmLabel="Sign Out Others"
        variant="warning"
        isLoading={data.isRevoking}
        onCancel={() => setRevokeOthers(false)}
        onConfirm={() => void revokeMyOthers()}
      />
    </div>
  );
}
