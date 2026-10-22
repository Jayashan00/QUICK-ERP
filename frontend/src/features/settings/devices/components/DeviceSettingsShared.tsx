import { GitBranch, ShieldCheck } from 'lucide-react';
import { Card } from '@/shared/components/common/Card';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';

export function BranchDeviceNotice({ branchName }: { branchName: string }) {
  return (
    <Card className="border-sky-200 bg-sky-50/60">
      <div className="flex items-start gap-3">
        <GitBranch className="mt-0.5 shrink-0 text-sky-700" size={20} />
        <div>
          <p className="font-semibold text-sky-900">Branch-specific configuration</p>
          <p className="mt-1 text-sm text-sky-800">These settings apply to <strong>{branchName}</strong>. Use the global branch selector to configure another authorized branch.</p>
        </div>
      </div>
    </Card>
  );
}

export function MockDeviceNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      <ShieldCheck className="mt-0.5 shrink-0 text-slate-500" size={15} />
      Device discovery and actions are simulated in this frontend build. The service boundary is ready for a future backend or local device connector.
    </div>
  );
}

export function DeviceDisableDialog({
  open,
  device,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  device: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return <ConfirmDialog isOpen={open} title={`Disable ${device}`} message={`${device} actions will stop for this branch.`} confirmLabel={`Disable ${device}`} variant="warning" isLoading={loading} onCancel={onCancel} onConfirm={onConfirm} />;
}
