import type { ProductAttribute } from '../types/product';

const createdAt = '2026-06-01T08:00:00Z';

export const mockProductAttributes: ProductAttribute[] = [
  {
    id: 'attr-color', tenantId: 'tenant-001', name: 'Color', code: 'COLOR',
    description: 'Reusable product finish and color choices.', isActive: true,
    options: [
      { id: 'attr-color-graphite', code: 'GRAPHITE', value: 'Graphite', sortOrder: 0 },
      { id: 'attr-color-black', code: 'BLACK', value: 'Black', sortOrder: 1 },
      { id: 'attr-color-white', code: 'WHITE', value: 'White', sortOrder: 2 },
      { id: 'attr-color-blue', code: 'BLUE', value: 'Blue', sortOrder: 3 },
    ],
    createdAt, updatedAt: createdAt,
  },
  {
    id: 'attr-size', tenantId: 'tenant-001', name: 'Size', code: 'SIZE',
    description: 'Standard product size options.', isActive: true,
    options: [
      { id: 'attr-size-small', code: 'S', value: 'Small', sortOrder: 0 },
      { id: 'attr-size-medium', code: 'M', value: 'Medium', sortOrder: 1 },
      { id: 'attr-size-large', code: 'L', value: 'Large', sortOrder: 2 },
      { id: 'attr-size-xl', code: 'XL', value: 'Extra Large', sortOrder: 3 },
    ],
    createdAt, updatedAt: createdAt,
  },
  {
    id: 'attr-material', tenantId: 'tenant-001', name: 'Material', code: 'MATERIAL',
    description: 'Primary material or construction.', isActive: true,
    options: [
      { id: 'attr-material-mesh', code: 'MESH', value: 'Mesh', sortOrder: 0 },
      { id: 'attr-material-leather', code: 'LEATHER', value: 'Leather', sortOrder: 1 },
      { id: 'attr-material-steel', code: 'STEEL', value: 'Steel', sortOrder: 2 },
    ],
    createdAt, updatedAt: createdAt,
  },
  {
    id: 'attr-capacity', tenantId: 'tenant-001', name: 'Capacity', code: 'CAPACITY',
    isActive: false,
    options: [
      { id: 'attr-capacity-500', code: '500ML', value: '500 ml', sortOrder: 0 },
      { id: 'attr-capacity-1l', code: '1L', value: '1 litre', sortOrder: 1 },
    ],
    createdAt, updatedAt: createdAt,
  },
  {
    id: 'attr-t2-roast', tenantId: 'tenant-002', name: 'Roast', code: 'ROAST',
    isActive: true,
    options: [
      { id: 'attr-t2-roast-medium', code: 'MED', value: 'Medium', sortOrder: 0 },
      { id: 'attr-t2-roast-dark', code: 'DARK', value: 'Dark', sortOrder: 1 },
    ],
    createdAt, updatedAt: createdAt,
  },
];
