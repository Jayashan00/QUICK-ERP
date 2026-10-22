import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import type { InventorySettingsFormValues } from "../schemas/inventorySchemas";
import { inventoryKeys } from "../queries/inventoryKeys";
import { inventorySettingsService } from "../services/inventorySettingsService";

export function useInventorySettings() {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const client = useQueryClient();
  const scope = { tenantId: tenantId ?? "", branchId: branchId ?? "" };
  const permittedBranchIds = branches.map((item) => item.id);
  const query = useQuery({
    queryKey: inventoryKeys.settings(scope),
    queryFn: () => inventorySettingsService.get(scope, permittedBranchIds),
    enabled: Boolean(tenantId && branchId),
  });
  const mutation = useMutation({
    mutationFn: (values: InventorySettingsFormValues) =>
      inventorySettingsService.save(scope, permittedBranchIds, values),
    onSuccess: (value) => {
      client.setQueryData(inventoryKeys.settings(scope), value);
      return client.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error ? "Failed to load inventory settings." : null,
    refetch: query.refetch,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
