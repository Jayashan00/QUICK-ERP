import type { ReportCategory, ReportDefinition } from './types/report';

const common = ['dateFrom', 'dateTo', 'branchId'] as const;
const define = (category: ReportCategory, permission: string, detailRoute: string, reports: Array<[string, string, string, Array<'dateFrom' | 'dateTo' | 'branchId' | 'customerId' | 'supplierId' | 'productId' | 'userId' | 'warehouseId' | 'locationId' | 'status'>?]>): ReportDefinition[] =>
  reports.map(([id, title, description, filters]) => ({ id, category, title, description, permission, detailRoute, filters: filters ?? [...common] }));

export const reportCatalog: ReportDefinition[] = [
  ...define('sales', 'reports.sales.view', '/sales', [
    ['lead-conversion', 'Lead Conversion', 'Lead sources, qualification and conversion outcomes.', [...common, 'userId', 'status']],
    ['pipeline-performance', 'Opportunity & Pipeline Performance', 'Pipeline value, probability and stage performance.', [...common, 'customerId', 'userId', 'status']],
    ['quotation-conversion', 'Quotation Conversion', 'Accepted, pending and expired quotation performance.', [...common, 'customerId', 'userId', 'status']],
    ['sales-summary', 'Sales Summary', 'Invoiced sales and collection overview.', [...common, 'customerId', 'userId', 'status']],
    ['sales-by-customer', 'Sales by Customer', 'Invoiced sales grouped by customer.', [...common, 'customerId']],
    ['sales-by-product', 'Sales by Product', 'Quantity and revenue grouped by product.', [...common, 'productId']],
    ['sales-by-salesperson', 'Sales by Salesperson', 'Revenue and collections grouped by salesperson.', [...common, 'userId']],
    ['sales-by-branch', 'Sales by Branch', 'Revenue and outstanding amounts by permitted branch.'],
    ['invoice-payment-status', 'Invoice & Payment Status', 'Invoice value, paid amount and balance.', [...common, 'customerId', 'status']],
    ['customer-outstanding', 'Customer Outstanding', 'Open receivable balances by customer.', [...common, 'customerId']],
    ['customer-ageing', 'Customer Ageing', 'Receivable balances grouped into ageing buckets.', [...common, 'customerId']],
    ['customer-statement', 'Customer Statement', 'Customer invoices and payments in date order.', [...common, 'customerId']],
  ]),
  ...define('purchases', 'reports.purchases.view', '/purchases', [
    ['purchase-summary', 'Purchase Summary', 'Purchase value and payable overview.', [...common, 'supplierId', 'status']],
    ['purchase-orders', 'Purchase Orders', 'Purchase order status and expected receipt dates.', [...common, 'supplierId', 'warehouseId', 'status']],
    ['grn-receiving', 'GRN & Receiving', 'Accepted, damaged and rejected received quantities.', [...common, 'supplierId', 'warehouseId', 'status']],
    ['supplier-performance', 'Supplier Performance', 'Order completion, delivery and receipt quality.', [...common, 'supplierId']],
    ['supplier-outstanding', 'Supplier Outstanding', 'Open supplier invoice balances.', [...common, 'supplierId']],
    ['supplier-ageing', 'Supplier Ageing', 'Supplier payables grouped into ageing buckets.', [...common, 'supplierId']],
    ['supplier-statements', 'Supplier Statements', 'Supplier orders, invoices and payment position.', [...common, 'supplierId']],
  ]),
  ...define('inventory', 'reports.inventory.view', '/inventory/stock', [
    ['stock-on-hand', 'Stock on Hand', 'Current branch and location-owned stock balances.', [...common, 'productId', 'warehouseId', 'locationId', 'status']],
    ['available-committed', 'Available vs Committed', 'On-hand, committed and available quantities.', [...common, 'productId', 'warehouseId', 'locationId']],
    ['stock-movement', 'Stock Movement', 'Inventory movement ledger for the selected period.', [...common, 'productId', 'warehouseId', 'locationId', 'status']],
    ['stock-by-location', 'Stock by Branch / Warehouse / Location', 'Stock quantities grouped by storage location.', [...common, 'productId', 'warehouseId', 'locationId']],
    ['low-stock', 'Low Stock & Reorder', 'Items at reorder point or out of stock.', [...common, 'productId', 'warehouseId']],
    ['stock-valuation', 'Stock Valuation', 'Existing inventory quantities valued using product cost.', [...common, 'productId', 'warehouseId']],
    ['stock-ageing', 'Stock Ageing', 'Batch inventory grouped by age.', [...common, 'productId']],
    ['expiry', 'Expiry', 'Expired and expiring batch inventory.', [...common, 'productId']],
    ['dead-stock', 'Dead Stock', 'Stock without recent movements.', [...common, 'productId', 'warehouseId']],
    ['wastage', 'Wastage', 'Posted inventory wastage workflows.', [...common, 'productId', 'status']],
    ['in-transit', 'In-transit Stock', 'Dispatched transfers awaiting receipt.', [...common, 'productId', 'status']],
    ['batch-serial', 'Batch & Serial', 'Traceable inventory batch and serial references.', [...common, 'productId', 'warehouseId', 'locationId', 'status']],
  ]),
  ...define('finance', 'reports.finance.view', '/finance/dashboard', [
    ['general-ledger', 'General Ledger', 'Posted account movements from the accounting ledger.'],
    ['trial-balance', 'Trial Balance', 'Debit and credit balances by account.'],
    ['profit-loss', 'Profit & Loss', 'Revenue and expense balances from posted journals.'],
    ['balance-sheet', 'Balance Sheet', 'Asset, liability and equity balances.'],
    ['cash-flow', 'Cash Flow', 'Operating, investing and financing movement.'],
    ['income-expense', 'Income & Expense Summary', 'Revenue and approved expense overview.'],
    ['receivables', 'Receivables', 'Customer balances from the accounting receivables model.'],
    ['payables', 'Payables', 'Supplier balances from the accounting payables model.'],
    ['cash-bank-movement', 'Cash & Bank Movement', 'Receipts, payments and imported bank lines.'],
    ['reconciliation', 'Reconciliation', 'Matched and unmatched bank movements.', [...common, 'status']],
    ['vat-tax', 'VAT & Tax', 'VAT returns and withholding records.'],
  ]),
  ...define('hr', 'reports.hr.view', '/hr', [
    ['headcount', 'Employee & Headcount', 'Headcount by employment and employee status.', [...common, 'status']],
    ['attendance', 'Attendance', 'Attendance exceptions and daily status.', [...common, 'userId', 'status']],
    ['leave', 'Leave', 'Leave requests and approved leave days.', [...common, 'userId', 'status']],
    ['overtime', 'Overtime', 'Requested and approved overtime hours.', [...common, 'userId', 'status']],
    ['payroll-summary', 'Payroll Summary', 'Gross, deductions and net payroll totals.', [...common, 'status']],
    ['payslip-records', 'Payslip Records', 'Approved employee payroll records.', [...common, 'userId']],
    ['hr-analytics', 'HR Analytics', 'Existing HR dashboard and workforce analytics.'],
  ]),
  ...define('projects', 'reports.projects.view', '/projects', [
    ['project-progress', 'Project Progress', 'Delivery status and progress indicators.', [...common, 'customerId', 'status']],
    ['milestone-task-status', 'Milestone & Task Status', 'Milestone progress and task workflow status.', [...common, 'userId', 'status']],
    ['timesheets', 'Timesheets', 'Submitted and approved project hours.', [...common, 'userId', 'status']],
    ['billable-hours', 'Billable vs Non-billable Hours', 'Approved hours split by billing eligibility.', [...common, 'userId']],
    ['project-expenses', 'Project Expenses', 'Submitted and approved project costs.', [...common, 'status']],
    ['project-billing', 'Project Billing', 'Prepared billing records and unbilled value.', [...common, 'customerId', 'status']],
    ['project-profitability', 'Project Profitability', 'Billable value, project cost and estimated profit.', [...common, 'customerId']],
  ]),
  ...define('pos', 'reports.pos.view', '/pos/reports', [
    ['daily-pos-sales', 'Daily POS Sales', 'POS transaction totals by day.'],
    ['payment-methods', 'Payment Method Breakdown', 'Tender totals by payment method.'],
    ['cashier-performance', 'Cashier Performance', 'Transaction and revenue totals by cashier.', [...common, 'userId']],
    ['shift-z-history', 'Shift / Z-report History', 'Till opening, expected cash and close status.', [...common, 'userId', 'status']],
    ['web-order-summary', 'Web Order Summary', 'Online order value and fulfilment status.', [...common, 'status']],
    ['store-analytics', 'Store Analytics', 'Store order and conversion overview.'],
    ['online-vs-store', 'Online vs In-store Sales', 'Available channel revenue comparison.'],
  ]),
];

export const reportCategories: Array<{ id: ReportCategory; label: string; permission: string }> = [
  { id: 'sales', label: 'CRM, Sales & Customers', permission: 'reports.sales.view' },
  { id: 'purchases', label: 'Purchases & Suppliers', permission: 'reports.purchases.view' },
  { id: 'inventory', label: 'Inventory & Stock', permission: 'reports.inventory.view' },
  { id: 'finance', label: 'Accounting & Finance', permission: 'reports.finance.view' },
  { id: 'hr', label: 'HR & Payroll', permission: 'reports.hr.view' },
  { id: 'projects', label: 'Projects', permission: 'reports.projects.view' },
  { id: 'pos', label: 'POS & Web Store', permission: 'reports.pos.view' },
];

export const findReport = (id: string) => reportCatalog.find((report) => report.id === id);
