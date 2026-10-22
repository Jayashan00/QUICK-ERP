import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";

export function DefaultReplacementDialog({
  open,
  recordType,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  recordType: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      isOpen={open}
      title={`Replace Default ${recordType}`}
      message={`Saving this record as the default will replace the current default ${recordType.toLowerCase()} for this tenant.`}
      confirmLabel="Replace Default"
      variant="warning"
      isLoading={loading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
