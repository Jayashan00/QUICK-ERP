import type { UOM, UomType } from '../types/product';

const createdAt = '2024-01-01T00:00:00Z';
const updatedAt = '2026-08-01T00:00:00Z';

interface UomSeed {
  id: string;
  code: string;
  name: string;
  symbol: string;
  type: UomType;
  decimalPlaces: number;
  description?: string;
  isDefault?: boolean;
}

const standardUoms: UomSeed[] = [
  { id: 'uom-unit', code: 'UNIT', name: 'Unit', symbol: 'ea', type: 'count', decimalPlaces: 0, description: 'Individual countable item.', isDefault: true },
  { id: 'uom-set', code: 'SET', name: 'Set', symbol: 'set', type: 'count', decimalPlaces: 0 },
  { id: 'uom-pair', code: 'PAIR', name: 'Pair', symbol: 'pair', type: 'count', decimalPlaces: 0 },
  { id: 'uom-box', code: 'BOX', name: 'Box', symbol: 'box', type: 'count', decimalPlaces: 0 },
  { id: 'uom-ream', code: 'REAM', name: 'Ream', symbol: 'ream', type: 'count', decimalPlaces: 0 },
  { id: 'uom-kg', code: 'KG', name: 'Kilogram', symbol: 'kg', type: 'weight', decimalPlaces: 3 },
  { id: 'uom-hour', code: 'HOUR', name: 'Hour', symbol: 'hr', type: 'time', decimalPlaces: 2 },
  { id: 'uom-day', code: 'DAY', name: 'Day', symbol: 'day', type: 'time', decimalPlaces: 2 },
  { id: 'uom-month', code: 'MONTH', name: 'Month', symbol: 'mo', type: 'service', decimalPlaces: 0 },
];

const tenantUoms = (tenantId: string, seeds: UomSeed[]): UOM[] => seeds.map((seed) => ({
  ...seed,
  tenantId,
  isDefault: seed.isDefault ?? false,
  isActive: true,
  createdAt,
  updatedAt,
}));

export const mockUoms: UOM[] = [
  ...tenantUoms('tenant-001', standardUoms),
  ...tenantUoms('tenant-002', standardUoms.filter((uom) => ['uom-unit', 'uom-kg', 'uom-hour'].includes(uom.id))),
];
