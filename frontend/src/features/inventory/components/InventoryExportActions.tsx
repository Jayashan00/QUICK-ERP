import { Download, FileSpreadsheet } from "lucide-react";
import { PERMISSIONS } from "@/core/permissions";
import { usePermission } from "@/core/permissions/permission-context";
import { Button } from "@/shared/components/common/Button";
import { Dropdown } from "@/shared/components/common/Dropdown";
import { useInventoryExport } from "../hooks/useInventoryExport";
import type { InventoryReportRequest } from "../services/inventoryExportService";

export function InventoryExportActions({
  request,
}: {
  request: InventoryReportRequest;
}) {
  const canExport = usePermission(PERMISSIONS.INVENTORY.EXPORT);
  const { exportReport, isExporting } = useInventoryExport();
  if (!canExport) return null;

  return (
    <Dropdown
      align="right"
      trigger={
        <Button
          variant="secondary"
          leftIcon={<Download size={16} />}
          isLoading={isExporting}
          aria-label="Export filtered inventory data"
        >
          Export
        </Button>
      }
      items={[
        {
          key: "csv",
          label: "Export CSV",
          icon: <Download size={14} />,
          onClick: () => void exportReport(request, "csv"),
        },
        {
          key: "excel",
          label: "Export Excel",
          icon: <FileSpreadsheet size={14} />,
          onClick: () => void exportReport(request, "excel"),
        },
      ]}
    />
  );
}
