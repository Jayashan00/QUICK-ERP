import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import type { ImportFieldMapping, ImportPreviewRow } from '@/shared/types/import-record';
import { productKeys } from '../queries/productKeys';
import { productHandoffKeys } from '../queries/productHandoffKeys';
import { productImportService } from '../services/productImportService';

export function useProductImport() {
  const { tenantId } = useTenant(); const client = useQueryClient();
  const requireTenant = () => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return tenantId; };
  const preview = useMutation({ mutationFn: ({ file, mapping }: { file: File; mapping: ImportFieldMapping }) => productImportService.preview(requireTenant(), file, mapping) });
  const execute = useMutation({ mutationFn: (rows: ImportPreviewRow[]) => productImportService.importRows(requireTenant(), rows), onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: productKeys.all }), client.invalidateQueries({ queryKey: productHandoffKeys.all })]) });
  return { prepareFile: productImportService.prepareFile, previewFile: (file: File, mapping: ImportFieldMapping) => preview.mutateAsync({ file, mapping }), importRows: execute.mutateAsync };
}
