import { useState } from "react";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { downloadCsv, downloadExcel, type ExportColumn } from "@/shared/utils/fileExport";
import { appToast } from "@/shared/utils/toast";
import {
  inventoryExportService,
  type InventoryReportRequest,
} from "../services/inventoryExportService";

export function useInventoryExport() {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const [isExporting, setIsExporting] = useState(false);

  const exportReport = async (
    request: InventoryReportRequest,
    format: "csv" | "excel",
  ) => {
    if (!tenantId || !branchId) {
      appToast.error("Tenant and branch context are required for export.");
      return;
    }
    setIsExporting(true);
    try {
      const dataset = await inventoryExportService.prepare(
        { tenantId, branchId },
        request,
      );
      const columns: ExportColumn<(typeof dataset.rows)[number]>[] =
        dataset.columns.map((column) => ({
          header: column.label,
          value: (row) => row[column.key],
        }));
      if (format === "csv")
        downloadCsv(`${dataset.fileBaseName}.csv`, columns, dataset.rows);
      else
        downloadExcel(
          `${dataset.fileBaseName}.xls`,
          dataset.sheetName,
          columns,
          dataset.rows,
        );
      appToast.success(
        `${dataset.rows.length} filtered inventory record${dataset.rows.length === 1 ? "" : "s"} exported.`,
      );
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to export inventory data.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return { exportReport, isExporting };
}
