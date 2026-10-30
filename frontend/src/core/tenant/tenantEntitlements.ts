export const TENANT_MODULES = [
  'hr', 'inventory', 'stock', 'crm', 'customers', 'suppliers', 'products', 'sales',
  'purchases', 'finance', 'projects', 'pos', 'web_store', 'reports', 'documents',
  'notifications', 'settings',
] as const;

export type TenantModule = (typeof TENANT_MODULES)[number];

export interface TenantModuleDefinition {
  id: TenantModule;
  label: string;
  group: 'People' | 'Commerce' | 'Operations' | 'Finance' | 'Workspace';
  description: string;
  dependencies?: TenantModule[];
}

export interface TenantLimits {
  maxUsers: number;
  maxBranches: number;
  maxWarehouses?: number;
  maxStorageGb?: number;
}

export interface TenantUsage {
  currentUsers: number;
  currentBranches: number;
  currentWarehouses?: number;
  storageGb?: number;
}

export interface TenantAdmin {
  name: string;
  email: string;
  status: 'active' | 'invited' | 'locked';
  lastActiveAt?: string;
}

export interface TenantEntitlements {
  enabledModules: TenantModule[];
  limits: TenantLimits;
  usage: TenantUsage;
  admin: TenantAdmin;
}

export const TENANT_MODULE_CATALOG: TenantModuleDefinition[] = [
  { id: 'hr', label: 'HR & Payroll', group: 'People', description: 'Employees, attendance, leave and payroll.' },
  { id: 'crm', label: 'CRM', group: 'Commerce', description: 'Leads, opportunities and pipeline.' },
  { id: 'customers', label: 'Customers', group: 'Commerce', description: 'Customer records and relationships.' },
  { id: 'suppliers', label: 'Suppliers', group: 'Commerce', description: 'Supplier records and relationships.' },
  { id: 'products', label: 'Products & Services', group: 'Commerce', description: 'Product, service and pricing master data.' },
  { id: 'sales', label: 'Sales', group: 'Commerce', description: 'Quotations, orders and invoices.', dependencies: ['customers', 'products'] },
  { id: 'purchases', label: 'Purchases', group: 'Commerce', description: 'Purchase orders and supplier payments.', dependencies: ['suppliers', 'products'] },
  { id: 'inventory', label: 'Inventory', group: 'Operations', description: 'Warehouses, balances and inventory workflows.', dependencies: ['products'] },
  { id: 'stock', label: 'Stock', group: 'Operations', description: 'Stock movements, counts and locations.', dependencies: ['inventory'] },
  { id: 'projects', label: 'Projects', group: 'Operations', description: 'Projects, assignments and delivery tracking.' },
  { id: 'pos', label: 'Point of Sale', group: 'Operations', description: 'Registers, shifts and POS sales.', dependencies: ['sales', 'inventory'] },
  { id: 'web_store', label: 'Web Store', group: 'Operations', description: 'Public catalogue, orders and reviews.', dependencies: ['sales', 'inventory'] },
  { id: 'finance', label: 'Finance & Accounting', group: 'Finance', description: 'Ledgers, journals, banking and tax.' },
  { id: 'reports', label: 'Reports', group: 'Workspace', description: 'Operational and analytical reporting.' },
  { id: 'documents', label: 'Documents', group: 'Workspace', description: 'Company documents and attachments.' },
  { id: 'notifications', label: 'Notifications', group: 'Workspace', description: 'Notifications, notices and templates.' },
  { id: 'settings', label: 'Settings', group: 'Workspace', description: 'Tenant users, roles, branches and company settings.' },
];

const records = new Map<string, TenantEntitlements>([
  ['tenant-001', { enabledModules: [...TENANT_MODULES], limits: { maxUsers: 25, maxBranches: 5, maxWarehouses: 10, maxStorageGb: 50 }, usage: { currentUsers: 9, currentBranches: 2, currentWarehouses: 2, storageGb: 18.4 }, admin: { name: 'John Doe', email: 'admin@acme.test', status: 'active', lastActiveAt: '2026-10-29T08:30:00Z' } }],
  ['tenant-002', { enabledModules: ['hr', 'inventory', 'stock', 'products', 'settings'], limits: { maxUsers: 30, maxBranches: 5 }, usage: { currentUsers: 4, currentBranches: 1 }, admin: { name: 'Maya Perera', email: 'admin@beta.test', status: 'active', lastActiveAt: '2026-10-28T04:15:00Z' } }],
  ['tenant-003', { enabledModules: ['crm', 'customers', 'products', 'sales', 'finance', 'reports', 'settings'], limits: { maxUsers: 50, maxBranches: 10 }, usage: { currentUsers: 42, currentBranches: 8 }, admin: { name: 'Sam Lee', email: 'owner@nexus.test', status: 'locked', lastActiveAt: '2026-09-28T08:00:00Z' } }],
]);

const clone = (value: TenantEntitlements): TenantEntitlements => structuredClone(value);

export const tenantEntitlementService = {
  get(tenantId: string): TenantEntitlements | null { const value = records.get(tenantId); return value ? clone(value) : null; },
  set(tenantId: string, value: TenantEntitlements): TenantEntitlements { records.set(tenantId, clone(value)); return clone(value); },
  updateUsage(tenantId: string, usage: Partial<TenantUsage>) { const current = records.get(tenantId); if (current) current.usage = { ...current.usage, ...usage }; },
  isModuleEnabled(tenantId: string, module: TenantModule) { return records.get(tenantId)?.enabledModules.includes(module) ?? false; },
};

const permissionModuleAliases: Record<string, TenantModule> = {
  hr: 'hr', payroll: 'hr', employees: 'hr', inventory: 'inventory', stock: 'stock', warehouses: 'inventory',
  crm: 'crm', leads: 'crm', opportunities: 'crm', customers: 'customers', suppliers: 'suppliers',
  products: 'products', sales: 'sales', pos: 'pos', purchases: 'purchases', purchasing: 'purchases',
  finance: 'finance', accounting: 'finance', projects: 'projects', storefront: 'web_store', reports: 'reports',
  documents: 'documents', notifications: 'notifications', notices: 'notifications', settings: 'settings', users: 'settings', roles: 'settings', branches: 'settings',
};

export function moduleForPermission(permission: string): TenantModule | null {
  if (permission === '*') return null;
  if (/^(stock\.|inventory\.(stock|movements|batches|serial_numbers|expiry|adjustments|transfers|requests|counts|returns|velocity|reorder))/.test(permission)) return 'stock';
  return permissionModuleAliases[permission.split('.')[0]] ?? null;
}

export function isPermissionEnabled(permission: string, enabledModules: readonly TenantModule[]): boolean {
  const required = new Set<TenantModule>();
  const primary = moduleForPermission(permission);
  if (primary) required.add(primary);
  if (permission.startsWith('reports.')) {
    required.add('reports');
    const category = permission.split('.')[1];
    const categoryModule = permissionModuleAliases[category];
    if (categoryModule && categoryModule !== 'reports') required.add(categoryModule);
  }
  return [...required].every((module) => enabledModules.includes(module));
}

export function moduleForPath(path: string): TenantModule | null {
  const mappings: Array<[string, TenantModule]> = [
    ['/inventory/stocks', 'stock'], ['/inventory/batches', 'stock'], ['/inventory/serials', 'stock'], ['/inventory/expiry', 'stock'],
    ['/inventory/movements', 'stock'], ['/inventory/adjustments', 'stock'], ['/inventory/transfers', 'stock'], ['/inventory/requests', 'stock'],
    ['/inventory/counts', 'stock'], ['/inventory/returns-wastage', 'stock'], ['/inventory/velocity', 'stock'], ['/inventory/reorder', 'stock'], ['/inventory/reports', 'stock'],
    ['/hr', 'hr'], ['/inventory', 'inventory'], ['/stock', 'stock'], ['/crm', 'crm'], ['/customers', 'customers'],
    ['/suppliers', 'suppliers'], ['/products', 'products'], ['/sales', 'sales'], ['/purchases', 'purchases'],
    ['/accounting', 'finance'], ['/finance', 'finance'], ['/projects', 'projects'], ['/pos', 'pos'], ['/storefront', 'web_store'],
    ['/reports', 'reports'], ['/documents', 'documents'], ['/notifications', 'notifications'], ['/settings', 'settings'],
  ];
  return mappings.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? null;
}

export function expandModuleDependencies(modules: TenantModule[]): TenantModule[] {
  const result = new Set<TenantModule>([...modules, 'settings']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of TENANT_MODULE_CATALOG) if (result.has(definition.id)) {
      for (const dependency of definition.dependencies ?? []) if (!result.has(dependency)) { result.add(dependency); changed = true; }
    }
  }
  return TENANT_MODULES.filter((module) => result.has(module));
}
