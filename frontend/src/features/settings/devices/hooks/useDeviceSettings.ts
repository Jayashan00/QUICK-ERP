import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import type {
  BarcodeScannerValues,
  BiometricDeviceValues,
  CashDrawerValues,
  CustomerDisplayValues,
  PrinterSettingsValues,
} from '@/features/settings/devices/schemas/deviceSettingsSchemas';
import { deviceSettingsKeys } from '@/features/settings/devices/queries/deviceSettingsKeys';
import { deviceSettingsService } from '@/features/settings/devices/services/deviceSettingsService';

function useDeviceScope() {
  const { tenantId } = useTenant();
  const { branchId, currentBranch } = useBranch();
  const required = () => {
    if (!tenantId || !branchId) throw new Error('Tenant or branch context is unavailable.');
    return { tenantId, branchId };
  };
  return { tenantId, branchId, branchName: currentBranch?.name ?? 'Current branch', required, enabled: Boolean(tenantId && branchId) };
}

export function useBarcodeScannerSettings() {
  const scope = useDeviceScope(); const client = useQueryClient(); const key = deviceSettingsKeys.detail(scope.tenantId ?? '', scope.branchId ?? '', 'barcode-scanner');
  const query = useQuery({ queryKey: key, queryFn: () => { const value = scope.required(); return deviceSettingsService.getScanner(value.tenantId, value.branchId); }, enabled: scope.enabled });
  const save = useMutation({ mutationFn: (values: BarcodeScannerValues) => { const value = scope.required(); return deviceSettingsService.saveScanner(value.tenantId, value.branchId, values); }, onSuccess: (value) => client.setQueryData(deviceSettingsKeys.detail(value.tenantId, value.branchId, 'barcode-scanner'), value) });
  const test = useMutation({ mutationFn: (barcode: string) => { const value = scope.required(); return deviceSettingsService.testScanner(value.tenantId, value.branchId, barcode); } });
  return { settings: query.data, branchName: scope.branchName, isLoading: query.isLoading, error: query.error ? 'Failed to load barcode scanner settings.' : null, refetch: query.refetch, save: save.mutateAsync, test: test.mutateAsync, isSaving: save.isPending, isTesting: test.isPending };
}

export function usePrinterSettings() {
  const scope = useDeviceScope(); const client = useQueryClient(); const key = deviceSettingsKeys.detail(scope.tenantId ?? '', scope.branchId ?? '', 'printer');
  const query = useQuery({ queryKey: key, queryFn: () => { const value = scope.required(); return deviceSettingsService.getPrinter(value.tenantId, value.branchId); }, enabled: scope.enabled });
  const options = useQuery({ queryKey: deviceSettingsKeys.options(scope.tenantId ?? '', scope.branchId ?? '', 'printer'), queryFn: () => { const value = scope.required(); return deviceSettingsService.getDeviceOptions(value.tenantId, value.branchId, 'printer'); }, enabled: scope.enabled });
  const save = useMutation({ mutationFn: (values: PrinterSettingsValues) => { const value = scope.required(); return deviceSettingsService.savePrinter(value.tenantId, value.branchId, values); }, onSuccess: (value) => client.setQueryData(deviceSettingsKeys.detail(value.tenantId, value.branchId, 'printer'), value) });
  const test = useMutation({ mutationFn: () => { const value = scope.required(); return deviceSettingsService.testPrinter(value.tenantId, value.branchId); } });
  return { settings: query.data, options: options.data ?? [], branchName: scope.branchName, isLoading: query.isLoading || options.isLoading, error: query.error || options.error ? 'Failed to load printer settings.' : null, refetch: query.refetch, save: save.mutateAsync, test: test.mutateAsync, isSaving: save.isPending, isTesting: test.isPending };
}

export function useCashDrawerSettings() {
  const scope = useDeviceScope(); const client = useQueryClient(); const key = deviceSettingsKeys.detail(scope.tenantId ?? '', scope.branchId ?? '', 'cash-drawer');
  const query = useQuery({ queryKey: key, queryFn: () => { const value = scope.required(); return deviceSettingsService.getCashDrawer(value.tenantId, value.branchId); }, enabled: scope.enabled });
  const options = useQuery({ queryKey: deviceSettingsKeys.options(scope.tenantId ?? '', scope.branchId ?? '', 'printer'), queryFn: () => { const value = scope.required(); return deviceSettingsService.getDeviceOptions(value.tenantId, value.branchId, 'printer'); }, enabled: scope.enabled });
  const save = useMutation({ mutationFn: (values: CashDrawerValues) => { const value = scope.required(); return deviceSettingsService.saveCashDrawer(value.tenantId, value.branchId, values); }, onSuccess: (value) => client.setQueryData(deviceSettingsKeys.detail(value.tenantId, value.branchId, 'cash-drawer'), value) });
  const test = useMutation({ mutationFn: () => { const value = scope.required(); return deviceSettingsService.testCashDrawer(value.tenantId, value.branchId); } });
  return { settings: query.data, options: options.data ?? [], branchName: scope.branchName, isLoading: query.isLoading || options.isLoading, error: query.error || options.error ? 'Failed to load cash drawer settings.' : null, refetch: query.refetch, save: save.mutateAsync, test: test.mutateAsync, isSaving: save.isPending, isTesting: test.isPending };
}

export function useCustomerDisplaySettings() {
  const scope = useDeviceScope(); const client = useQueryClient(); const key = deviceSettingsKeys.detail(scope.tenantId ?? '', scope.branchId ?? '', 'customer-display');
  const query = useQuery({ queryKey: key, queryFn: () => { const value = scope.required(); return deviceSettingsService.getCustomerDisplay(value.tenantId, value.branchId); }, enabled: scope.enabled });
  const options = useQuery({ queryKey: deviceSettingsKeys.options(scope.tenantId ?? '', scope.branchId ?? '', 'display'), queryFn: () => { const value = scope.required(); return deviceSettingsService.getDeviceOptions(value.tenantId, value.branchId, 'display'); }, enabled: scope.enabled });
  const save = useMutation({ mutationFn: (values: CustomerDisplayValues) => { const value = scope.required(); return deviceSettingsService.saveCustomerDisplay(value.tenantId, value.branchId, values); }, onSuccess: (value) => client.setQueryData(deviceSettingsKeys.detail(value.tenantId, value.branchId, 'customer-display'), value) });
  const test = useMutation({ mutationFn: () => { const value = scope.required(); return deviceSettingsService.previewCustomerDisplay(value.tenantId, value.branchId); } });
  return { settings: query.data, options: options.data ?? [], branchName: scope.branchName, isLoading: query.isLoading || options.isLoading, error: query.error || options.error ? 'Failed to load customer display settings.' : null, refetch: query.refetch, save: save.mutateAsync, test: test.mutateAsync, isSaving: save.isPending, isTesting: test.isPending };
}

export function useBiometricDeviceSettings() {
  const scope = useDeviceScope(); const client = useQueryClient(); const key = deviceSettingsKeys.detail(scope.tenantId ?? '', scope.branchId ?? '', 'biometric');
  const query = useQuery({ queryKey: key, queryFn: () => { const value = scope.required(); return deviceSettingsService.getBiometric(value.tenantId, value.branchId); }, enabled: scope.enabled });
  const update = (value: NonNullable<typeof query.data>) => client.setQueryData(deviceSettingsKeys.detail(value.tenantId, value.branchId, 'biometric'), value);
  const save = useMutation({ mutationFn: (values: BiometricDeviceValues) => { const value = scope.required(); return deviceSettingsService.saveBiometric(value.tenantId, value.branchId, values); }, onSuccess: update });
  const test = useMutation({ mutationFn: () => { const value = scope.required(); return deviceSettingsService.testBiometric(value.tenantId, value.branchId); }, onSuccess: update });
  const sync = useMutation({ mutationFn: () => { const value = scope.required(); return deviceSettingsService.syncBiometric(value.tenantId, value.branchId); }, onSuccess: update });
  return { settings: query.data, branchName: scope.branchName, isLoading: query.isLoading, error: query.error ? 'Failed to load biometric device settings.' : null, refetch: query.refetch, save: save.mutateAsync, test: test.mutateAsync, sync: sync.mutateAsync, isSaving: save.isPending, isTesting: test.isPending, isSyncing: sync.isPending };
}
