import type { ProductSpecification } from '../types/product';

const createdAt = '2026-08-12T08:00:00Z';

export const mockProductSpecifications: ProductSpecification[] = [
  { id: 'spec-prod-001-processor', tenantId: 'tenant-001', productId: 'prod-001', name: 'Processor', value: 'Intel Core i7-1360P', group: 'Technical', sortOrder: 0, createdAt, updatedAt: createdAt },
  { id: 'spec-prod-001-ram', tenantId: 'tenant-001', productId: 'prod-001', name: 'RAM', value: '16', unit: 'GB', group: 'Technical', sortOrder: 1, createdAt, updatedAt: createdAt },
  { id: 'spec-prod-001-storage', tenantId: 'tenant-001', productId: 'prod-001', name: 'Storage', value: '512 GB NVMe SSD', group: 'Technical', sortOrder: 2, createdAt, updatedAt: createdAt },
  { id: 'spec-prod-001-weight', tenantId: 'tenant-001', productId: 'prod-001', name: 'Weight', value: '1.42', unit: 'kg', group: 'Dimensions', sortOrder: 0, createdAt, updatedAt: createdAt },
  { id: 'spec-prod-001-warranty', tenantId: 'tenant-001', productId: 'prod-001', name: 'Warranty', value: '3 Years On-site', group: 'Warranty', sortOrder: 0, createdAt, updatedAt: createdAt },
  { id: 'spec-prod-005-material', tenantId: 'tenant-001', productId: 'prod-005', name: 'Material', value: 'Breathable mesh and aluminium base', group: 'General', sortOrder: 0, createdAt, updatedAt: createdAt },
  { id: 'spec-prod-005-capacity', tenantId: 'tenant-001', productId: 'prod-005', name: 'Maximum Load', value: '125', unit: 'kg', group: 'General', sortOrder: 1, createdAt, updatedAt: createdAt },
  { id: 'spec-prod-201-capacity', tenantId: 'tenant-002', productId: 'prod-201', name: 'Pack Size', value: '1', unit: 'kg', group: 'General', sortOrder: 0, createdAt, updatedAt: createdAt },
];
