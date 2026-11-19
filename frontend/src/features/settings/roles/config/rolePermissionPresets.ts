import type { TenantModule } from '@/core/tenant/tenantEntitlements';
import { isPermissionEnabled } from '@/core/tenant/tenantEntitlements';
import { TENANT_PERMISSIONS } from '@/core/permissions/tenantPermissionConstants';

export interface RolePresetDefinition {
  id: string;
  name: string;
  roleCode?: string;
  description: string;
  category: 'Administration' | 'Sales' | 'Point of Sale' | 'Operations' | 'Finance' | 'HR' | 'Audit';
  badge: string;
  resolvePermissions: (enabledModules: readonly TenantModule[]) => string[];
}

const allTenantPermissionStrings = Object.values(TENANT_PERMISSIONS)
  .flatMap((group) => Object.values(group))
  .filter((perm): perm is string => typeof perm === 'string');

// Helper to filter permissions by tenant enabled modules
function filterEnabled(permissions: readonly string[], enabledModules: readonly TenantModule[]): string[] {
  return [...new Set(permissions.filter((p) => p !== '*' && !p.startsWith('platform.') && isPermissionEnabled(p, enabledModules)))];
}

export const ROLE_PERMISSION_PRESETS: RolePresetDefinition[] = [
  {
    id: 'admin',
    name: 'Administrator',
    roleCode: 'admin',
    category: 'Administration',
    badge: 'Maximum Access',
    description: 'Full tenant-level access across all modules enabled by Super Admin (no platform permissions).',
    resolvePermissions: (enabledModules) => {
      // Maximum tenant-level permissions allowed by Super Admin, never platform permissions
      const tenantPerms = allTenantPermissionStrings.filter((p) => !p.startsWith('platform.'));
      return filterEnabled(tenantPerms, enabledModules);
    },
  },
  {
    id: 'sales_manager',
    name: 'Sales Manager',
    roleCode: 'sales_manager',
    category: 'Sales',
    badge: 'Sales Management',
    description: 'Comprehensive access to CRM leads, opportunities, quotations, sales orders, deliveries, invoices, returns, and sales reporting.',
    resolvePermissions: (enabledModules) => {
      const perms = [
        // CRM
        'leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'leads.export', 'leads.convert',
        'crm.leads.view', 'crm.leads.create', 'crm.leads.edit', 'crm.leads.delete',
        'crm.opportunities.view', 'crm.opportunities.create', 'crm.opportunities.edit', 'crm.opportunities.delete',
        'crm.pipeline.view', 'crm.pipeline.edit', 'crm.activities.view', 'crm.activities.create', 'crm.activities.edit',
        'customers.view', 'customers.create', 'customers.edit', 'customers.export',
        // Sales
        'sales.view', 'sales.quotations.view', 'sales.quotations.create', 'sales.quotations.edit', 'sales.quotations.delete', 'sales.quotations.approve', 'sales.quotations.export', 'sales.quotations.print',
        'quotation.create', 'quotation.edit', 'quotation.approve', 'quotation.print',
        'sales.orders.view', 'sales.orders.create', 'sales.orders.edit', 'sales.orders.delete', 'sales.orders.print', 'sales.orders.export',
        'salesOrder.create', 'salesOrder.edit', 'salesOrder.print', 'salesOrder.confirm', 'salesOrder.process',
        'sales.invoices.view', 'sales.invoices.create', 'sales.invoices.edit', 'sales.invoices.print', 'sales.invoices.export',
        'invoice.create', 'invoice.edit', 'invoice.submit', 'invoice.approve', 'invoice.send',
        'sales.deliveries.view', 'sales.deliveries.create', 'sales.deliveries.edit', 'sales.deliveries.print', 'sales.deliveries.export',
        'delivery.create',
        'sales.returns.view', 'sales.returns.create', 'sales.returns.edit', 'sales.returns.print', 'sales.returns.export',
        'salesReturn.create',
        'creditNote.approve',
        'sales.flash_sales.view', 'sales.flash_sales.create', 'sales.flash_sales.edit', 'sales.flash_sales.submit', 'sales.flash_sales.approve', 'sales.flash_sales.disable',
        'sales.export',
        // Products
        'products.view', 'products.download',
        // Reports & Workspace
        'reports.sales.view', 'reports.sales.export',
        'documents.view', 'documents.upload', 'documents.download', 'documents.archive',
        'notifications.view', 'notifications.manage', 'notices.view', 'notificationPreferences.manage',
        'support.view', 'support.create',
      ];
      return filterEnabled(perms, enabledModules);
    },
  },
  {
    id: 'sales_executive',
    name: 'Sales Executive',
    roleCode: 'sales_executive',
    category: 'Sales',
    badge: 'Operations',
    description: 'Standard sales operations for leads, customer relationships, quotations, orders, and deliveries without sensitive approval or deletion authority.',
    resolvePermissions: (enabledModules) => {
      const perms = [
        'leads.view', 'leads.create', 'leads.edit', 'leads.convert',
        'crm.leads.view', 'crm.leads.create', 'crm.leads.edit',
        'customers.view', 'customers.create', 'customers.edit',
        'crm.opportunities.view', 'crm.opportunities.create', 'crm.opportunities.edit', 'crm.pipeline.view',
        'sales.view', 'sales.quotations.view', 'sales.quotations.create', 'sales.quotations.edit', 'sales.quotations.print',
        'quotation.create', 'quotation.edit', 'quotation.print',
        'sales.orders.view', 'sales.orders.create', 'sales.orders.edit', 'sales.orders.print',
        'salesOrder.create', 'salesOrder.edit', 'salesOrder.print',
        'sales.invoices.view', 'invoice.create',
        'sales.deliveries.view', 'sales.deliveries.create', 'delivery.create',
        'sales.returns.view', 'salesReturn.create',
        'sales.flash_sales.view', 'sales.flash_sales.create', 'sales.flash_sales.edit', 'sales.flash_sales.submit',
        'products.view', 'products.download',
        'documents.view', 'documents.upload', 'documents.download',
        'notifications.view', 'notices.view', 'notificationPreferences.manage',
        'support.view', 'support.create',
      ];
      return filterEnabled(perms, enabledModules);
    },
  },
  {
    id: 'pos_cashier',
    name: 'POS Cashier',
    roleCode: 'pos_cashier',
    category: 'Point of Sale',
    badge: 'POS Checkout',
    description: 'Front-desk point-of-sale checkout, open/close register shifts, and receipt printing without discount or refund authority.',
    resolvePermissions: (enabledModules) => {
      const perms = [
        'pos.view', 'pos.terminal.view', 'pos.sell',
        'pos.shifts.view', 'pos.shift.open', 'pos.shift.close',
        'pos.receipt.reprint',
        'customers.view', 'products.view',
        'sync.view',
        'notifications.view', 'notices.view',
        'support.view', 'support.create',
      ];
      return filterEnabled(perms, enabledModules);
    },
  },
  {
    id: 'pos_supervisor',
    name: 'POS Supervisor',
    roleCode: 'pos_supervisor',
    category: 'Point of Sale',
    badge: 'POS Supervisory',
    description: 'Shift approvals, overrides, discounts, refunds, POS report analytics, and register configuration.',
    resolvePermissions: (enabledModules) => {
      const perms = [
        'pos.view', 'pos.terminal.view', 'pos.sell', 'pos.discount',
        'pos.shifts.view', 'pos.shift.open', 'pos.shift.close', 'pos.shift.approve',
        'pos.transactions.view', 'pos.refund',
        'pos.receipt.reprint', 'pos.report.view', 'reports.pos.view', 'reports.pos.export',
        'pos.settings.manage',
        'settings.customer_display.view', 'settings.cash_drawer.view', 'settings.printers.view', 'settings.barcode_scanner.view',
        'customers.view', 'customers.create', 'customers.edit',
        'products.view', 'sales.orders.view',
        'sync.view', 'sync.manage',
        'notifications.view', 'notifications.manage', 'notices.view', 'notificationPreferences.manage',
        'support.view', 'support.create',
      ];
      return filterEnabled(perms, enabledModules);
    },
  },
  {
    id: 'inventory_manager',
    name: 'Inventory Manager',
    roleCode: 'inventory_manager',
    category: 'Operations',
    badge: 'Warehousing & Stock',
    description: 'Item catalog, stock adjustments, warehouse transfers, batch/serial tracking, stock counts, velocity, and reorder management.',
    resolvePermissions: (enabledModules) => {
      const perms = [
        // Products Master Data
        'products.view', 'products.create', 'products.edit', 'products.delete', 'products.export',
        'products.activate', 'products.import', 'products.manage_prices', 'products.download',
        'products.categories.view', 'products.categories.create', 'products.categories.edit', 'products.categories.delete',
        'products.brands.view', 'products.brands.create', 'products.brands.edit', 'products.brands.delete',
        'products.uoms.view', 'products.uoms.create', 'products.uoms.edit', 'products.uoms.delete',
        // Inventory & Warehouses
        'inventory.view', 'inventory.export',
        'inventory.manage_warehouses', 'inventory.manage_locations',
        'inventory.warehouses.view', 'inventory.warehouses.create', 'inventory.warehouses.edit', 'inventory.warehouses.delete',
        'inventory.locations.view', 'inventory.locations.create', 'inventory.locations.edit', 'inventory.locations.delete',
        'inventory.stock.view', 'inventory.stock.view_all_branches',
        'inventory.view_batches', 'inventory.batches.view', 'inventory.batches.create', 'inventory.batches.edit', 'inventory.batches.delete',
        'inventory.view_serials', 'inventory.serial_numbers.view', 'inventory.serial_numbers.create', 'inventory.serial_numbers.edit', 'inventory.serial_numbers.delete',
        'inventory.view_expiry', 'inventory.expiry.view',
        'inventory.view_movements', 'inventory.movements.view', 'inventory.movements.create',
        'salesOrder.fulfillment.view', 'salesOrder.process', 'delivery.create',
        'inventory.transfers.view', 'inventory.transfers.create', 'inventory.transfers.edit', 'inventory.transfers.delete',
        'inventory.adjustments.view', 'inventory.adjustments.create', 'inventory.adjustments.edit', 'inventory.adjustments.delete',
        'stock.adjust', 'stock.transfer', 'stock.request', 'stock.count', 'stock.approve', 'stock.receive',
        'inventory.stock_counts.view', 'inventory.stock_counts.create', 'inventory.stock_counts.edit', 'inventory.stock_counts.delete',
        'inventory.settings.view', 'inventory.settings.manage',
        'inventory.velocity.view',
        // Reports
        'reports.inventory.view', 'reports.inventory.export',
        'reports.purchases.view', 'reports.purchases.export',
        // Purchases integration
        'purchase.view', 'purchase.export',
        'purchases.requests.view', 'purchases.requests.create', 'purchases.requests.edit', 'purchases.requests.submit', 'purchases.requests.cancel',
        'grn.view', 'grn.create', 'purchases.grns.view', 'purchases.grns.create',
        // Workspace
        'sync.view', 'sync.manage',
        'documents.view', 'documents.upload', 'documents.download',
        'notifications.view', 'notifications.manage', 'notices.view', 'notificationPreferences.manage',
        'support.view', 'support.create',
      ];
      return filterEnabled(perms, enabledModules);
    },
  },
  {
    id: 'accountant',
    name: 'Accountant',
    roleCode: 'accountant',
    category: 'Finance',
    badge: 'Accounting & Ledger',
    description: 'General ledger, charts of accounts, journal vouchers, invoice postings, credit note settlements, tax, and financial statements.',
    resolvePermissions: (enabledModules) => {
      const perms = [
        // Chart of Accounts & Journals
        'finance.chart_of_accounts.view', 'finance.chart_of_accounts.create', 'finance.chart_of_accounts.edit', 'finance.chart_of_accounts.export',
        'finance.journals.view', 'finance.journals.create', 'finance.journals.edit', 'finance.journals.approve', 'finance.journals.post',
        // Receivables & Payables
        'finance.receivables.view', 'finance.receivables.create', 'finance.receivables.edit',
        'finance.payables.view', 'finance.payables.create', 'finance.payables.edit',
        'finance.expenses.view', 'finance.expenses.create', 'finance.expenses.edit', 'finance.expenses.approve',
        'finance.cash.view', 'finance.cash.create', 'finance.cash.edit',
        'finance.bank.view', 'finance.bank.create', 'finance.bank.edit',
        'finance.reconciliation.view', 'finance.reconciliation.reconcile',
        'finance.reports.view', 'finance.reports.export',
        'reports.finance.view', 'reports.finance.export',
        // Sales Invoices & Credit Notes
        'sales.invoices.view', 'sales.invoices.create', 'sales.invoices.edit',
        'invoice.create', 'invoice.edit', 'invoice.submit', 'invoice.approve', 'invoice.post', 'invoice.return', 'invoice.void',
        'creditNote.approve', 'creditNote.post', 'creditNote.return', 'creditNote.void', 'creditNote.refund',
        // Purchases
        'purchaseInvoice.view', 'purchaseInvoice.create', 'purchases.invoices.view', 'purchases.invoices.create',
        // Taxes & Financial Year
        'settings.taxes.view', 'settings.financial_year.view',
        // Documents & Workspace
        'documents.view', 'documents.upload', 'documents.download', 'documents.view_sensitive',
        'notifications.view', 'notifications.manage', 'notices.view', 'notificationPreferences.manage',
        'support.view', 'support.create',
      ];
      return filterEnabled(perms, enabledModules);
    },
  },
  {
    id: 'hr_manager',
    name: 'HR Manager',
    roleCode: 'hr_manager',
    category: 'HR',
    badge: 'People & Payroll',
    description: 'Employee profiles, shift rosters, biometric attendance, leave approvals, payroll processing, and recruitment workflows.',
    resolvePermissions: (enabledModules) => {
      const perms = [
        'hr.employees.view', 'hr.employees.create', 'hr.employees.edit', 'hr.employees.delete', 'hr.employees.export',
        'hr.departments.view', 'hr.designations.view',
        'settings.departments.view', 'settings.departments.create', 'settings.departments.edit',
        'settings.designations.view', 'settings.designations.create', 'settings.designations.edit',
        'hr.attendance.view', 'hr.attendance.create', 'hr.attendance.edit', 'hr.attendance.approve',
        'hr.shifts.view', 'hr.shifts.create', 'hr.shifts.edit', 'hr.shifts.delete',
        'hr.leave.view', 'hr.leave.create', 'hr.leave.edit', 'hr.leave.approve',
        'hr.overtime.view', 'hr.overtime.create', 'hr.overtime.edit', 'hr.overtime.approve',
        'hr.payroll.view', 'hr.payroll.create', 'hr.payroll.edit', 'hr.payroll.process', 'hr.payroll.approve',
        'hr.payslips.view', 'hr.payslips.export',
        'hr.documents.view', 'hr.documents.create',
        'documents.view', 'documents.upload', 'documents.download', 'documents.view_sensitive',
        'hr.recruitment.view', 'hr.recruitment.create', 'hr.recruitment.edit',
        'hr.onboarding.view', 'hr.onboarding.create', 'hr.onboarding.edit',
        'hr.training.view', 'hr.training.create', 'hr.training.edit',
        'hr.performance.view', 'hr.performance.create', 'hr.performance.edit',
        'hr.okr.view', 'hr.okr.create', 'hr.okr.edit',
        'hr.feedback.view', 'hr.feedback.create',
        'hr.policies.view', 'hr.policies.create', 'hr.policies.edit',
        'hr.tickets.view', 'hr.tickets.create', 'hr.tickets.edit',
        'hr.assets.view', 'hr.assets.create', 'hr.assets.edit',
        'hr.exits.view', 'hr.exits.create', 'hr.exits.edit',
        'settings.biometric_device.view', 'settings.biometric_device.edit', 'settings.biometric_device.test',
        'hr.reports.view', 'hr.reports.export', 'reports.hr.view', 'reports.hr.export',
        'notifications.view', 'notifications.manage', 'notices.view',
        'support.view', 'support.create',
      ];
      return filterEnabled(perms, enabledModules);
    },
  },
  {
    id: 'viewer',
    name: 'Viewer / Auditor (Read-Only)',
    roleCode: 'viewer',
    category: 'Audit',
    badge: 'Read-Only Access',
    description: 'Strict read-only access across all enabled ERP modules without create, edit, delete, approve, or modifying actions.',
    resolvePermissions: (enabledModules) => {
      // Collect only view permissions across all enabled modules
      const viewPerms = [
        // CRM & Relationships
        'leads.view', 'crm.leads.view', 'crm.opportunities.view', 'crm.pipeline.view', 'crm.activities.view',
        'customers.view', 'suppliers.suppliers.view', 'suppliers.view',
        // Commerce
        'products.view', 'products.categories.view', 'products.brands.view', 'products.uoms.view',
        'sales.view', 'sales.quotations.view', 'sales.orders.view', 'sales.invoices.view', 'sales.deliveries.view', 'sales.returns.view', 'sales.flash_sales.view',
        'purchase.view', 'purchases.requests.view', 'rfq.view', 'purchases.rfqs.view', 'purchases.supplier_quotations.view', 'purchases.orders.view', 'grn.view', 'purchases.grns.view', 'purchaseInvoice.view', 'purchases.invoices.view', 'purchases.returns.view',
        // Operations
        'inventory.view', 'inventory.stock.view', 'inventory.stock.view_all_branches', 'inventory.warehouses.view', 'inventory.locations.view', 'inventory.view_batches', 'inventory.batches.view', 'inventory.view_serials', 'inventory.serial_numbers.view', 'inventory.view_expiry', 'inventory.expiry.view', 'inventory.view_movements', 'inventory.movements.view', 'inventory.adjustments.view', 'inventory.transfers.view', 'inventory.velocity.view', 'inventory.settings.view',
        'pos.view', 'pos.terminal.view', 'pos.shifts.view', 'pos.transactions.view', 'pos.report.view',
        // Finance & HR
        'finance.chart_of_accounts.view', 'finance.journals.view', 'finance.receivables.view', 'finance.payables.view', 'finance.cash.view', 'finance.bank.view', 'finance.reconciliation.view', 'finance.reports.view',
        'hr.employees.view', 'hr.departments.view', 'hr.designations.view', 'hr.attendance.view', 'hr.shifts.view', 'hr.leave.view', 'hr.overtime.view', 'hr.payroll.view', 'hr.payslips.view', 'hr.recruitment.view', 'hr.onboarding.view', 'hr.training.view', 'hr.performance.view', 'hr.reports.view',
        // Projects & Documents & System
        'projects.projects.view', 'projects.milestones.view', 'projects.tasks.view', 'projects.timesheets.view', 'projects.expenses.view', 'projects.billing.view', 'projects.reports.view',
        'documents.view',
        'support.view',
        'notifications.view', 'notices.view',
        'settings.company.view', 'settings.branches.view', 'settings.departments.view', 'settings.roles.view', 'settings.designations.view',
        'reports.view', 'reports.sales.view', 'reports.purchases.view', 'reports.inventory.view', 'reports.finance.view', 'reports.hr.view', 'reports.projects.view', 'reports.pos.view',
      ];
      // Explicitly ensure no modifying permissions leak into the read-only preset
      const modifyingWords = ['create', 'edit', 'delete', 'approve', 'post', 'void', 'refund', 'process', 'confirm', 'manage', 'cancel', 'adjust', 'transfer', 'sell', 'discount'];
      const safeViewPerms = viewPerms.filter((p) => {
        const action = p.split('.').pop() ?? '';
        return !modifyingWords.includes(action);
      });
      return filterEnabled(safeViewPerms, enabledModules);
    },
  },
];
