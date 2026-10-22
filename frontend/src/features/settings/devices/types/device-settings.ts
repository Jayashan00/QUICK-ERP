import type { EntityId } from '@/shared/types/common';

export interface BranchDeviceScope {
  tenantId: EntityId;
  branchId: EntityId;
  updatedAt: string;
}

export interface DeviceOption {
  id: string;
  name: string;
  type: string;
  status: 'available' | 'unavailable';
}

export interface DeviceActionResult {
  success: boolean;
  message: string;
  testedAt: string;
}

export type ScannerMode = 'keyboard_wedge' | 'camera' | 'serial' | 'mock';
export type BarcodeFormat = 'code_128' | 'code_39' | 'ean_13' | 'ean_8' | 'upc_a' | 'qr_code';
export interface BarcodeScannerSettings extends BranchDeviceScope {
  enabled: boolean;
  mode: ScannerMode;
  inputBehavior: 'append' | 'replace';
  barcodeFormats: BarcodeFormat[];
  autoSubmit: boolean;
  scanSuffix: 'enter' | 'tab' | 'none';
}
export type BarcodeScannerInput = Omit<BarcodeScannerSettings, keyof BranchDeviceScope>;

export interface PrinterSettings extends BranchDeviceScope {
  enabled: boolean;
  printerId: string;
  printerName: string;
  printerType: 'receipt' | 'document' | 'label';
  paperSize: '58mm' | '80mm' | 'a4' | 'letter';
  copies: number;
  isDefault: boolean;
  autoPrintReceipts: boolean;
  autoPrintInvoices: boolean;
  cutPaper: boolean;
}
export type PrinterSettingsInput = Omit<PrinterSettings, keyof BranchDeviceScope | 'printerName'>;

export interface CashDrawerSettings extends BranchDeviceScope {
  enabled: boolean;
  deviceName: string;
  linkedPrinterId: string;
  openingMethod: 'printer_kick' | 'usb' | 'serial' | 'manual';
  autoOpenOnCashSale: boolean;
  autoOpenOnCashRefund: boolean;
  autoOpenOnCashMovement: boolean;
}
export type CashDrawerInput = Omit<CashDrawerSettings, keyof BranchDeviceScope>;

export interface CustomerDisplaySettings extends BranchDeviceScope {
  enabled: boolean;
  displayId: string;
  idleMessage: string;
  showCartItems: boolean;
  showTotals: boolean;
  showPaymentDetails: boolean;
}
export type CustomerDisplayInput = Omit<CustomerDisplaySettings, keyof BranchDeviceScope>;

export type BiometricStatus = 'connected' | 'disconnected' | 'syncing' | 'synced' | 'failed';
export interface BiometricDeviceSettings extends BranchDeviceScope {
  enabled: boolean;
  deviceName: string;
  deviceType: 'fingerprint' | 'face' | 'card' | 'hybrid';
  connectionMethod: 'network' | 'usb' | 'cloud';
  deviceId: string;
  ipAddress: string;
  port: number;
  autoSync: boolean;
  importAttendance: boolean;
  importUsers: boolean;
  status: BiometricStatus;
  lastSyncedAt?: string;
}
export type BiometricDeviceInput = Omit<BiometricDeviceSettings, keyof BranchDeviceScope | 'status' | 'lastSyncedAt'>;
