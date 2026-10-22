import {
  mockBarcodeScannerSettings,
  mockBiometricDeviceSettings,
  mockCashDrawerSettings,
  mockCustomerDisplaySettings,
  mockDisplayOptions,
  mockPrinterOptions,
  mockPrinterSettings,
} from '@/features/settings/devices/mocks/deviceSettings';
import type { BarcodeScannerInput, BarcodeScannerSettings, BiometricDeviceInput, BiometricDeviceSettings, CashDrawerInput, CashDrawerSettings, CustomerDisplayInput, CustomerDisplaySettings, DeviceActionResult, DeviceOption, PrinterSettings, PrinterSettingsInput } from '@/features/settings/devices/types/device-settings';
import { registerList } from '@/core/persistence/stateRegistry';

type ScopedSetting = { tenantId: string; branchId: string };
type DeviceKind = 'printer' | 'display';

let scannerStore = [{ ...mockBarcodeScannerSettings }];
let printerStore = [{ ...mockPrinterSettings }];
let drawerStore = [{ ...mockCashDrawerSettings }];
let displayStore = [{ ...mockCustomerDisplaySettings }];
let biometricStore = [{ ...mockBiometricDeviceSettings }];

const wait = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration));
const now = () => new Date().toISOString();
const matches = (item: ScopedSetting, tenantId: string, branchId: string) => item.tenantId === tenantId && item.branchId === branchId;

function scoped<T extends ScopedSetting>(store: T[], fallback: T, tenantId: string, branchId: string): T {
  const existing = store.find((item) => matches(item, tenantId, branchId));
  if (existing) return existing;
  const created = { ...fallback, tenantId, branchId };
  store.push(created);
  return created;
}

function action(message: string): DeviceActionResult {
  return { success: true, message, testedAt: now() };
}

export const deviceSettingsService = {
  async getScanner(tenantId: string, branchId: string): Promise<BarcodeScannerSettings> {
    await wait(); return { ...scoped(scannerStore, mockBarcodeScannerSettings, tenantId, branchId) };
  },
  async saveScanner(tenantId: string, branchId: string, input: BarcodeScannerInput): Promise<BarcodeScannerSettings> {
    await wait(240); const next = { ...input, tenantId, branchId, updatedAt: now() }; scannerStore = [...scannerStore.filter((item) => !matches(item, tenantId, branchId)), next]; return { ...next };
  },
  async testScanner(tenantId: string, branchId: string, barcode: string): Promise<DeviceActionResult> {
    await wait(450); const settings = scoped(scannerStore, mockBarcodeScannerSettings, tenantId, branchId); if (!settings.enabled) throw new Error('Enable the barcode scanner before testing.'); if (barcode.trim().length < 3) throw new Error('Scan or enter a valid barcode.'); return action(`Mock scan received: ${barcode.trim()}`);
  },

  async getPrinter(tenantId: string, branchId: string): Promise<PrinterSettings> {
    await wait(); return { ...scoped(printerStore, mockPrinterSettings, tenantId, branchId) };
  },
  async savePrinter(tenantId: string, branchId: string, input: PrinterSettingsInput): Promise<PrinterSettings> {
    await wait(240); const option = mockPrinterOptions.find((item) => item.id === input.printerId); if (input.enabled && !option) throw new Error('Select an available printer.'); const next = { ...input, printerName: option?.name ?? '', tenantId, branchId, updatedAt: now() }; printerStore = [...printerStore.filter((item) => !matches(item, tenantId, branchId)), next]; return { ...next };
  },
  async testPrinter(tenantId: string, branchId: string): Promise<DeviceActionResult> {
    await wait(550); const settings = scoped(printerStore, mockPrinterSettings, tenantId, branchId); if (!settings.enabled || !settings.printerId) throw new Error('Enable and select a printer before testing.'); return action(`Mock test page sent to ${settings.printerName}.`);
  },

  async getCashDrawer(tenantId: string, branchId: string): Promise<CashDrawerSettings> {
    await wait(); return { ...scoped(drawerStore, mockCashDrawerSettings, tenantId, branchId) };
  },
  async saveCashDrawer(tenantId: string, branchId: string, input: CashDrawerInput): Promise<CashDrawerSettings> {
    await wait(240); if (input.enabled && input.openingMethod === 'printer_kick' && !input.linkedPrinterId) throw new Error('Select a linked printer.'); const next = { ...input, tenantId, branchId, updatedAt: now() }; drawerStore = [...drawerStore.filter((item) => !matches(item, tenantId, branchId)), next]; return { ...next };
  },
  async testCashDrawer(tenantId: string, branchId: string): Promise<DeviceActionResult> {
    await wait(500); const settings = scoped(drawerStore, mockCashDrawerSettings, tenantId, branchId); if (!settings.enabled) throw new Error('Enable the cash drawer before testing.'); return action(`Mock open signal sent to ${settings.deviceName}.`);
  },

  async getCustomerDisplay(tenantId: string, branchId: string): Promise<CustomerDisplaySettings> {
    await wait(); return { ...scoped(displayStore, mockCustomerDisplaySettings, tenantId, branchId) };
  },
  async saveCustomerDisplay(tenantId: string, branchId: string, input: CustomerDisplayInput): Promise<CustomerDisplaySettings> {
    await wait(240); const next = { ...input, tenantId, branchId, updatedAt: now() }; displayStore = [...displayStore.filter((item) => !matches(item, tenantId, branchId)), next]; return { ...next };
  },
  async previewCustomerDisplay(tenantId: string, branchId: string): Promise<DeviceActionResult> {
    await wait(400); const settings = scoped(displayStore, mockCustomerDisplaySettings, tenantId, branchId); if (!settings.enabled || !settings.displayId) throw new Error('Enable and select a customer display before previewing.'); return action('Mock customer display preview opened with sample cart totals.');
  },

  async getBiometric(tenantId: string, branchId: string): Promise<BiometricDeviceSettings> {
    await wait(); return { ...scoped(biometricStore, mockBiometricDeviceSettings, tenantId, branchId) };
  },
  async saveBiometric(tenantId: string, branchId: string, input: BiometricDeviceInput): Promise<BiometricDeviceSettings> {
    await wait(240); const current = scoped(biometricStore, mockBiometricDeviceSettings, tenantId, branchId); const next = { ...input, tenantId, branchId, status: input.enabled ? current.status : 'disconnected' as const, lastSyncedAt: current.lastSyncedAt, updatedAt: now() }; biometricStore = [...biometricStore.filter((item) => !matches(item, tenantId, branchId)), next]; return { ...next };
  },
  async testBiometric(tenantId: string, branchId: string): Promise<BiometricDeviceSettings> {
    await wait(650); const current = scoped(biometricStore, mockBiometricDeviceSettings, tenantId, branchId); if (!current.enabled) throw new Error('Enable the biometric device before testing.'); const next = { ...current, status: 'connected' as const, updatedAt: now() }; biometricStore = [...biometricStore.filter((item) => !matches(item, tenantId, branchId)), next]; return { ...next };
  },
  async syncBiometric(tenantId: string, branchId: string): Promise<BiometricDeviceSettings> {
    await wait(750); const current = scoped(biometricStore, mockBiometricDeviceSettings, tenantId, branchId); if (!current.enabled) throw new Error('Enable the biometric device before syncing.'); const syncedAt = now(); const next = { ...current, status: 'synced' as const, lastSyncedAt: syncedAt, updatedAt: syncedAt }; biometricStore = [...biometricStore.filter((item) => !matches(item, tenantId, branchId)), next]; return { ...next };
  },

  async getDeviceOptions(_tenantId: string, _branchId: string, kind: DeviceKind): Promise<DeviceOption[]> {
    await wait(120); const source = kind === 'printer' ? mockPrinterOptions : mockDisplayOptions; return source.map((item) => ({ ...item }));
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('settings.devices.scanner', () => scannerStore, (rows) => { scannerStore = rows; });
registerList('settings.devices.printer', () => printerStore, (rows) => { printerStore = rows; });
registerList('settings.devices.cashDrawer', () => drawerStore, (rows) => { drawerStore = rows; });
registerList('settings.devices.customerDisplay', () => displayStore, (rows) => { displayStore = rows; });
registerList('settings.devices.biometric', () => biometricStore, (rows) => { biometricStore = rows; });
