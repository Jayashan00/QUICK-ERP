import { useState } from 'react';
import { useTenant } from '@/core/tenant/tenant-context';
import { downloadCsv, downloadExcel, type ExportColumn } from '@/shared/utils/fileExport';
import { appToast } from '@/shared/utils/toast';
import { supplierService, type GetSuppliersParams } from '../services/supplierService';
import type { Supplier } from '../types/supplier';

const columns: ExportColumn<Supplier>[] = [
  { header: 'Code', value: (supplier) => supplier.code },
  { header: 'Name', value: (supplier) => supplier.name },
  { header: 'Contact Person', value: (supplier) => supplier.contactPerson },
  { header: 'Email', value: (supplier) => supplier.email },
  { header: 'Phone', value: (supplier) => supplier.phone },
  { header: 'City', value: (supplier) => supplier.address.city },
  { header: 'Country', value: (supplier) => supplier.address.country },
  { header: 'Currency', value: (supplier) => supplier.currency },
  { header: 'Payment Terms (Days)', value: (supplier) => supplier.paymentTermsDays ?? 0 },
  { header: 'Status', value: (supplier) => supplier.status },
];

export function useSupplierExport() {
  const { tenantId } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportSuppliers = async (params: GetSuppliersParams, format: 'csv' | 'excel') => {
    if (!tenantId || isExporting) return;
    setIsExporting(true);
    try {
      const result = await supplierService.getSuppliers(tenantId, {
        ...params,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      });
      const base = `suppliers-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') downloadCsv(`${base}.csv`, columns, result.data);
      else downloadExcel(`${base}.xls`, 'Suppliers', columns, result.data);
      appToast.success(`${result.data.length} supplier${result.data.length === 1 ? '' : 's'} exported.`);
    } catch {
      appToast.error('Unable to export suppliers. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportSuppliers, isExporting };
}
