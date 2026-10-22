import type { Category } from '../types/product';

const createdAt = '2024-01-01T00:00:00Z';
const updatedAt = '2026-08-01T00:00:00Z';

export const mockProductCategories: Category[] = [
  { id: 'cat-electronics', tenantId: 'tenant-001', code: 'ELEC', name: 'Electronics', description: 'Computers, peripherals and electronic equipment.', isActive: true, sortOrder: 10, createdAt, updatedAt },
  { id: 'cat-office', tenantId: 'tenant-001', code: 'OFF', name: 'Office Supplies', description: 'Paper, toner and daily office consumables.', isActive: true, sortOrder: 20, createdAt, updatedAt },
  { id: 'cat-furniture', tenantId: 'tenant-001', code: 'FUR', name: 'Office Furniture', isActive: true, sortOrder: 30, createdAt, updatedAt },
  { id: 'cat-tools', tenantId: 'tenant-001', code: 'TLS', name: 'Tools & Equipment', isActive: true, sortOrder: 40, createdAt, updatedAt },
  { id: 'cat-safety', tenantId: 'tenant-001', code: 'SAF', name: 'Safety Supplies', isActive: true, sortOrder: 50, createdAt, updatedAt },
  { id: 'cat-services', tenantId: 'tenant-001', code: 'SRV', name: 'Professional Services', isActive: true, sortOrder: 60, createdAt, updatedAt },
  { id: 'cat-bundles', tenantId: 'tenant-001', code: 'BND', name: 'Bundles & Kits', isActive: true, sortOrder: 70, createdAt, updatedAt },
  { id: 'cat-t2-consumables', tenantId: 'tenant-002', code: 'CON', name: 'Consumables', isActive: true, sortOrder: 10, createdAt, updatedAt },
  { id: 'cat-t2-services', tenantId: 'tenant-002', code: 'SRV', name: 'Services', isActive: true, sortOrder: 20, createdAt, updatedAt },
];
