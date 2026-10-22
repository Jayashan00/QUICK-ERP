import type { Brand } from '../types/product';

const createdAt = '2024-01-01T00:00:00Z';
const updatedAt = '2026-08-01T00:00:00Z';

export const mockProductBrands: Brand[] = [
  { id: 'brand-northstar', tenantId: 'tenant-001', code: 'NORTH', name: 'Northstar', description: 'Business computing and display hardware.', websiteUrl: 'https://example.com/northstar', isActive: true, createdAt, updatedAt },
  { id: 'brand-keystone', tenantId: 'tenant-001', code: 'KEY', name: 'Keystone', description: 'Office input devices and accessories.', isActive: true, createdAt, updatedAt },
  { id: 'brand-printmax', tenantId: 'tenant-001', code: 'PMAX', name: 'PrintMax', isActive: false, createdAt, updatedAt },
  { id: 'brand-workform', tenantId: 'tenant-001', code: 'WORK', name: 'WorkForm', description: 'Ergonomic workplace furniture.', isActive: true, createdAt, updatedAt },
  { id: 'brand-clearpage', tenantId: 'tenant-001', code: 'CLEAR', name: 'ClearPage', isActive: true, createdAt, updatedAt },
  { id: 'brand-forgeline', tenantId: 'tenant-001', code: 'FORGE', name: 'ForgeLine', isActive: true, createdAt, updatedAt },
  { id: 'brand-safeworks', tenantId: 'tenant-001', code: 'SAFE', name: 'SafeWorks', isActive: true, createdAt, updatedAt },
  { id: 'brand-scanpro', tenantId: 'tenant-001', code: 'SCAN', name: 'ScanPro', isActive: false, createdAt, updatedAt },
  { id: 'brand-connectix', tenantId: 'tenant-001', code: 'CONN', name: 'Connectix', isActive: true, createdAt, updatedAt },
  { id: 'brand-t2-roastery', tenantId: 'tenant-002', code: 'ROAST', name: 'Island Roastery', isActive: true, createdAt, updatedAt },
];
