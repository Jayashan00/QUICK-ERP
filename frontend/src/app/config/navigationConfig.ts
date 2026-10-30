import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Truck,
  Package,
  ShoppingCart,
  Receipt,
  Layers,
  DollarSign,
  Briefcase,
  FolderKanban,
  Store,
  BarChart3,
  FileText,
  Bell,
  Settings,
  ShieldAlert,
  Building,
  Activity,
  HeartPulse,
  Headphones,
  ScrollText,
  CloudCog,
} from "lucide-react";
import { SETTINGS_NAV_GROUPS } from "@/features/settings/config/settingsNavConfig";

export interface NavigationItemConfig {
  label: string;
  path?: string;
  icon?: LucideIcon;
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  badge?: string | number;
  children?: NavigationItemConfig[];
}

export interface NavigationSectionConfig {
  title?: string;
  items: NavigationItemConfig[];
}

export const ERP_NAVIGATION_SECTIONS: NavigationSectionConfig[] = [
  {
    title: "MAIN",
    items: [
      {
        label: "Sync Queue",
        path: "/sync",
        icon: CloudCog,
        permission: "sync.view",
      },
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "RELATIONSHIPS",
    items: [
      {
        label: "CRM",
        path: "/crm",
        icon: Users,
        children: [
          { label: "Leads", path: "/crm/leads", permission: "leads.view" },
          {
            label: "Opportunities",
            path: "/crm/opportunities",
            permission: "crm.opportunities.view",
          },
        ],
      },
      {
        label: "Customers",
        path: "/customers",
        icon: UserCheck,
        permission: "customers.view",
      },
      {
        label: "Suppliers",
        path: "/suppliers",
        icon: Truck,
        permission: "suppliers.suppliers.view",
      },
    ],
  },
  {
    title: "COMMERCE & OPERATIONS",
    items: [
      {
        label: "Products & Services",
        path: "/products",
        icon: Package,
        children: [
          {
            label: "Item Catalog",
            path: "/products",
            permission: "products.view",
          },
          {
            label: "Import Products",
            path: "/products/import",
            permission: "products.import",
          },
          {
            label: "Categories",
            path: "/products/categories",
            permission: "products.categories.view",
          },
          {
            label: "Brands",
            path: "/products/brands",
            permission: "products.brands.view",
          },
          {
            label: "Units of Measure",
            path: "/products/uoms",
            permission: "products.uoms.view",
          },
          {
            label: "Price Lists",
            path: "/products/price-lists",
            allPermissions: ["products.view", "products.price_lists.view"],
          },
        ],
      },
      {
        label: "Sales",
        path: "/sales",
        icon: ShoppingCart,
        children: [
          { label: "Overview", path: "/sales", permission: "sales.view" },
          {
            label: "Quotations",
            path: "/sales/quotations",
            permission: "sales.view",
          },
          {
            label: "Sales Orders",
            path: "/sales/orders",
            permission: "sales.view",
          },
          {
            label: "POS Sales Orders",
            path: "/sales/pos-orders",
            permission: "sales.orders.view",
          },
          {
            label: "Invoices",
            path: "/sales/invoices",
            permission: "sales.view",
          },
          {
            label: "Payments Received",
            path: "/sales/payments",
            permission: "sales.view",
          },
          {
            label: "Delivery Notes",
            path: "/sales/deliveries",
            permission: "sales.view",
          },
          {
            label: "Sales Returns",
            path: "/sales/returns",
            permission: "sales.view",
          },
          {
            label: "Credit Notes",
            path: "/sales/credit-notes",
            permission: "sales.view",
          },
          {
            label: "Recurring Invoices",
            path: "/sales/recurring",
            permission: "sales.view",
          },
          {
            label: "Commissions",
            path: "/sales/commissions",
            permission: "sales.view",
          },
          { label: "Flash Sales", path: "/sales/flash-sales", permission: "sales.view" },
          { label: "Customer Reviews", path: "/sales/reviews", permission: "sales.view" },
          { label: "Abandoned Carts", path: "/sales/abandoned-carts", permission: "sales.view" },
        ],
      },
      {
        label: "Purchases",
        path: "/purchases",
        icon: Receipt,
        children: [
          {
            label: "Overview",
            path: "/purchases",
            permission: "purchase.view",
          },
          {
            label: "Purchase Requests",
            path: "/purchases/requests",
            permission: "purchase.view",
          },
          { label: "RFQs", path: "/purchases/rfqs", permission: "rfq.view" },
          {
            label: "Supplier Quotations",
            path: "/purchases/quotations",
            permission: "rfq.view",
          },
          {
            label: "Quotation Comparison",
            path: "/purchases/comparison",
            permission: "rfq.view",
          },
          {
            label: "Purchase Orders",
            path: "/purchases/orders",
            permission: "purchase.view",
          },
          {
            label: "Goods Receipts",
            path: "/purchases/receipts",
            permission: "grn.view",
          },
          {
            label: "Purchase Invoices",
            path: "/purchases/invoices",
            permission: "purchaseInvoice.view",
          },
          {
            label: "PO / GRN Matching",
            path: "/purchases/matching",
            permission: "purchaseInvoice.view",
          },
          {
            label: "Purchase Returns",
            path: "/purchases/returns",
            permission: "purchase.create",
          },
          {
            label: "Supplier Payments",
            path: "/purchases/payments",
            permission: "purchaseInvoice.view",
          },
        ],
      },
      {
        label: "Inventory",
        path: "/inventory",
        icon: Layers,
        children: [
          {
            label: "Overview",
            path: "/inventory",
            permission: "inventory.view",
          },
          {
            label: "Stock Levels",
            path: "/inventory/stocks",
            allPermissions: ["inventory.view", "inventory.stock.view"],
          },
          {
            label: "Warehouses",
            path: "/inventory/warehouses",
            allPermissions: ["inventory.view", "inventory.warehouses.view"],
          },
          {
            label: "Stock Locations",
            path: "/inventory/locations",
            allPermissions: ["inventory.view", "inventory.locations.view"],
          },
          {
            label: "Batch Tracking",
            path: "/inventory/batches",
            allPermissions: ["inventory.view", "inventory.view_batches"],
          },
          {
            label: "Serial Numbers",
            path: "/inventory/serials",
            allPermissions: ["inventory.view", "inventory.view_serials"],
          },
          {
            label: "Expiry Alerts",
            path: "/inventory/expiry",
            allPermissions: ["inventory.view", "inventory.view_expiry"],
          },
          {
            label: "Movement Ledger",
            path: "/inventory/movements",
            allPermissions: ["inventory.view", "inventory.view_movements"],
          },
          {
            label: "Stock Adjustments",
            path: "/inventory/adjustments",
            allPermissions: ["inventory.view", "inventory.adjustments.view"],
          },
          {
            label: "Stock Transfers",
            path: "/inventory/transfers",
            allPermissions: ["inventory.view", "inventory.transfers.view"],
          },
          {
            label: "Branch Stock Requests",
            path: "/inventory/requests",
            allPermissions: ["inventory.view", "stock.request"],
          },
          {
            label: "Stock Counts",
            path: "/inventory/counts",
            allPermissions: ["inventory.view", "stock.count"],
          },
          {
            label: "Mobile Stock Count",
            path: "/inventory/counts/mobile",
            allPermissions: ["inventory.view", "stock.count"],
          },
          {
            label: "Returns & Wastage",
            path: "/inventory/returns-wastage",
            allPermissions: ["inventory.view", "stock.adjust"],
          },
          { label: "Stock Ageing Report", path: "/inventory/reports/aging", allPermissions: ["inventory.view", "inventory.stock.view"] },
          { label: "Stock Margins", path: "/inventory/reports/margins", allPermissions: ["inventory.view", "inventory.stock.view"] },
          { label: "Expiry Report", path: "/inventory/reports/expiry", allPermissions: ["inventory.view", "inventory.view_expiry"] },
          { label: "Dead Stock Report", path: "/inventory/reports/dead-stock", allPermissions: ["inventory.view", "inventory.stock.view"] },
          { label: "Wastage Report", path: "/inventory/reports/wastage", allPermissions: ["inventory.view", "stock.adjust"] },
          { label: "In Transit Inventory", path: "/inventory/reports/in-transit", allPermissions: ["inventory.view", "inventory.transfers.view"] },
          { label: "Stock Velocity", path: "/inventory/velocity", allPermissions: ["inventory.view", "inventory.velocity.view"] },
          {
            label: "Reorder Workflow",
            path: "/inventory/reorder",
            allPermissions: ["inventory.view", "inventory.stock.view"],
          },
          {
            label: "Inventory Settings",
            path: "/inventory/settings",
            allPermissions: ["inventory.view", "inventory.settings.view"],
          },
        ],
      },
      {
        label: "POS",
        path: "/pos",
        icon: Store,
        children: [
          {
            label: "Terminal",
            path: "/pos/terminal",
            permission: "pos.view",
          },
          {
            label: "Register Shifts",
            path: "/pos/shifts",
            permission: "pos.view",
          },
          { label: "Returns", path: "/pos/returns", permission: "pos.view" },
          { label: "Customer Display", path: "/pos/customer-display", permission: "pos.view" },
          { label: "Kitchen Display", path: "/pos/kitchen", permission: "pos.view" },
          { label: "Web Orders", path: "/pos/web-orders", permission: "pos.view" },
          { label: "POS Settings", path: "/pos/settings", permission: "pos.settings.manage" },
          { label: "POS Reports", path: "/pos/reports", permission: "pos.report.view" },
          { label: "Receipts", path: "/pos/receipts", permission: "pos.view" },
        ],
      },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      {
        label: "Finance & Accounts",
        path: "/finance",
        icon: DollarSign,
        children: [
          { label: "Accounting Dashboard", path: "/finance/dashboard", permission: "finance.reports.view" },
          {
            label: "Chart of Accounts",
            path: "/finance/chart-of-accounts",
            permission: "finance.chart_of_accounts.view",
          },
          { label: "Opening Balances", path: "/finance/opening-balances", permission: "finance.chart_of_accounts.view" },
          {
            label: "Journal Entries",
            path: "/finance/journal",
            permission: "finance.journals.view",
          },
          { label: "Accounts Receivable", path: "/finance/receivables", permission: "finance.receivables.view" },
          { label: "Accounts Payable", path: "/finance/payables", permission: "finance.payables.view" },
          { label: "Payments & Receipts", path: "/finance/payments", permission: "finance.cash.view" },
          { label: "Expenses", path: "/finance/expenses", permission: "finance.expenses.view" },
          {
            label: "General Ledger",
            path: "/finance/ledger",
            permission: "finance.reports.view",
          },
          { label: "Trial Balance", path: "/finance/trial-balance", permission: "finance.reports.view" },
          { label: "Financial Reports", path: "/finance/profit-loss", permission: "finance.reports.view" },
          {
            label: "Bank Accounts",
            path: "/finance/banks",
            permission: "finance.bank.view",
          },
          {
            label: "Tax Management",
            path: "/finance/tax",
            permission: "finance.reports.view",
          },
          { label: "Accounting Handoffs", path: "/finance/handoffs", permission: "finance.reports.view" },
        ],
      },
      {
        label: "HR & Payroll",
        path: "/hr",
        icon: Briefcase,
        children: [
          { label: "HR Dashboard", path: "/hr/dashboard", permission: "hr.employees.view" },
          {
            label: "Employees",
            path: "/hr/employees",
            permission: "hr.employees.view",
          },
          {
            label: "Departments",
            path: "/hr/departments",
            permission: "hr.departments.view",
          },
          {
            label: "Attendance",
            path: "/hr/attendance",
            permission: "hr.attendance.view",
          },
          { label: "Shifts & Roster", path: "/hr/shifts", permission: "hr.shifts.view" },
          { label: "Attendance Corrections", path: "/hr/corrections", permission: "hr.attendance.view" },
          {
            label: "Leave Requests",
            path: "/hr/leaves",
            permission: "hr.leave.view",
          },
          {
            label: "Payroll",
            path: "/hr/payroll",
            permission: "hr.payroll.view",
          },
          { label: "Overtime", path: "/hr/overtime", permission: "hr.overtime.view" },
          { label: "Payslips", path: "/hr/payslips", permission: "hr.payslips.view" },
          { label: "Recruitment", path: "/hr/recruitment", permission: "hr.recruitment.view" },
          { label: "Onboarding", path: "/hr/onboarding", permission: "hr.onboarding.view" },
          { label: "Training", path: "/hr/training", permission: "hr.training.view" },
          { label: "Performance", path: "/hr/performance", permission: "hr.performance.view" },
          { label: "OKRs & Feedback", path: "/hr/okr", permission: "hr.okr.view" },
          { label: "Policies & Signatures", path: "/hr/policies", permission: "hr.policies.view" },
          { label: "HR Tickets", path: "/hr/tickets", permission: "hr.tickets.view" },
          { label: "HR Approvals", path: "/hr/approvals", permission: "hr.employees.view" },
          { label: "HR Calendar", path: "/hr/calendar", permission: "hr.employees.view" },
          { label: "Employee Assets", path: "/hr/assets", permission: "hr.assets.view" },
          { label: "Employee Exits", path: "/hr/exits", permission: "hr.exits.view" },
          { label: "HR Analytics & Reports", path: "/hr/analytics", permission: "hr.reports.view" },
        ],
      },
      {
        label: "Projects",
        path: "/projects",
        icon: FolderKanban,
        children: [
          {
            label: "All Projects",
            path: "/projects/list",
            permission: "projects.projects.view",
          },
          { label: "Project Dashboard", path: "/projects/dashboard", permission: "projects.projects.view" },
          { label: "Milestones", path: "/projects/milestones", permission: "projects.milestones.view" },
          {
            label: "Tasks",
            path: "/projects/tasks",
            permission: "projects.tasks.view",
          },
          {
            label: "Timesheets",
            path: "/projects/timesheets",
            permission: "projects.timesheets.view",
          },
          { label: "Project Expenses", path: "/projects/expenses", permission: "projects.expenses.view" },
          { label: "Billing", path: "/projects/billing", permission: "projects.billing.view" },
          { label: "Profitability & Reports", path: "/projects/profitability", permission: "projects.reports.view" },
        ],
      },
      {
        label: "Reports & Analytics",
        path: "/reports",
        icon: BarChart3,
        children: [
          {
            label: "Reports Dashboard",
            path: "/reports",
            anyPermissions: ["reports.view", "reports.sales.view", "reports.purchases.view", "reports.inventory.view", "reports.finance.view", "reports.hr.view", "reports.projects.view", "reports.pos.view"],
          },
          {
            label: "CRM & Sales Reports",
            path: "/reports/sales",
            permission: "reports.sales.view",
          },
          {
            label: "Purchase Reports",
            path: "/reports/purchases",
            permission: "reports.purchases.view",
          },
          {
            label: "Finance Reports",
            path: "/reports/finance",
            permission: "reports.finance.view",
          },
          {
            label: "Inventory Reports",
            path: "/reports/inventory",
            permission: "reports.inventory.view",
          },
          {
            label: "HR Reports",
            path: "/reports/hr",
            permission: "reports.hr.view",
          },
          {
            label: "Project Reports",
            path: "/reports/projects",
            permission: "reports.projects.view",
          },
          {
            label: "POS & Store Reports",
            path: "/reports/pos",
            permission: "reports.pos.view",
          },
        ],
      },
      {
        label: "Documents",
        path: "/documents",
        icon: FileText,
        permission: "documents.view",
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      {
        label: "Support Tickets",
        path: "/support/tickets",
        icon: Headphones,
        permission: "support.view",
      },
      {
        label: "Audit Logs",
        path: "/audit",
        icon: ScrollText,
        permission: "audit.view",
      },
      {
        label: "Notifications",
        path: "/notifications",
        icon: Bell,
        permission: "notifications.view",
        children: [
          { label: "Notification Center", path: "/notifications", permission: "notifications.view" },
          { label: "Notices", path: "/notifications/notices", permission: "notices.view" },
          { label: "Templates", path: "/notifications/templates", permission: "notificationTemplates.manage" },
        ],
      },
      {
        label: "Settings",
        path: "/settings",
        icon: Settings,
        children: SETTINGS_NAV_GROUPS.map((group) => ({
          label: group.label,
          icon: group.icon,
          children: group.items.map((item) => ({
            label: item.label,
            path: item.path,
            permission: item.permission,
          })),
        })),
      },
    ],
  },
];

export const SUPER_ADMIN_NAVIGATION_SECTIONS: NavigationSectionConfig[] = [
  {
    title: "PLATFORM",
    items: [
      {
        label: "Dashboard",
        path: "/super-admin/dashboard",
        icon: LayoutDashboard,
        permission: "platform.dashboard.view",
      },
      {
        label: "Tenants",
        path: "/super-admin/tenants",
        icon: Building,
        permission: "platform.tenants.view",
      },
      {
        label: "Platform Usage",
        path: "/super-admin/usage",
        icon: Activity,
        permission: "platform.usage.view",
      },
      {
        label: "Platform Users",
        path: "/super-admin/users",
        icon: Users,
        permission: "platform.users.view",
      },
      {
        label: "Platform Health",
        path: "/super-admin/health",
        icon: HeartPulse,
        permission: "platform.health.view",
      },
      {
        label: "Support",
        path: "/super-admin/support",
        icon: Headphones,
        permission: "platform.support.view",
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      {
        label: "Platform Settings",
        path: "/super-admin/settings",
        icon: Settings,
        permission: "platform.settings.view",
      },
      {
        label: "Platform Reports",
        path: "/super-admin/reports",
        icon: BarChart3,
        permission: "platform.reports.view",
      },
      {
        label: "Security Audit",
        path: "/super-admin/security",
        icon: ShieldAlert,
        permission: "platform.security.view",
      },
      {
        label: "Audit Logs",
        path: "/super-admin/audit-logs",
        icon: ScrollText,
        permission: "platform.audit_logs.view",
      },
    ],
  },
];
