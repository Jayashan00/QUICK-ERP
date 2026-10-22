import type { BarcodeScannerSettings, BiometricDeviceSettings, CashDrawerSettings, CustomerDisplaySettings, DeviceOption, PrinterSettings } from '@/features/settings/devices/types/device-settings';

const scope = { tenantId: 'tenant-001', branchId: 'branch-main', updatedAt: '2026-09-23T08:00:00.000Z' };

export const mockBarcodeScannerSettings: BarcodeScannerSettings = {
  ...scope,
  enabled: true,
  mode: 'keyboard_wedge',
  inputBehavior: 'replace',
  barcodeFormats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'qr_code'],
  autoSubmit: true,
  scanSuffix: 'enter',
};

export const mockPrinterSettings: PrinterSettings = {
  ...scope,
  enabled: true,
  printerId: 'printer-pos-01',
  printerName: 'Front Counter Thermal Printer',
  printerType: 'receipt',
  paperSize: '80mm',
  copies: 1,
  isDefault: true,
  autoPrintReceipts: true,
  autoPrintInvoices: false,
  cutPaper: true,
};

export const mockCashDrawerSettings: CashDrawerSettings = {
  ...scope,
  enabled: true,
  deviceName: 'Front Counter Cash Drawer',
  linkedPrinterId: 'printer-pos-01',
  openingMethod: 'printer_kick',
  autoOpenOnCashSale: true,
  autoOpenOnCashRefund: false,
  autoOpenOnCashMovement: true,
};

export const mockCustomerDisplaySettings: CustomerDisplaySettings = {
  ...scope,
  enabled: false,
  displayId: 'display-pos-01',
  idleMessage: 'Welcome to Acme Corporation',
  showCartItems: true,
  showTotals: true,
  showPaymentDetails: true,
};

export const mockBiometricDeviceSettings: BiometricDeviceSettings = {
  ...scope,
  enabled: true,
  deviceName: 'Main Office Attendance Terminal',
  deviceType: 'fingerprint',
  connectionMethod: 'network',
  deviceId: 'BIO-MAIN-01',
  ipAddress: '192.168.1.120',
  port: 4370,
  autoSync: true,
  importAttendance: true,
  importUsers: false,
  status: 'synced',
  lastSyncedAt: '2026-09-23T07:45:00.000Z',
};

export const mockPrinterOptions: DeviceOption[] = [
  { id: 'printer-pos-01', name: 'Front Counter Thermal Printer', type: 'Thermal receipt', status: 'available' },
  { id: 'printer-office-01', name: 'Office A4 Printer', type: 'Document', status: 'available' },
];

export const mockDisplayOptions: DeviceOption[] = [
  { id: 'display-pos-01', name: 'Front Counter Customer Display', type: 'Secondary browser display', status: 'available' },
  { id: 'display-pos-02', name: 'Checkout Pole Display', type: 'Pole display', status: 'unavailable' },
];
