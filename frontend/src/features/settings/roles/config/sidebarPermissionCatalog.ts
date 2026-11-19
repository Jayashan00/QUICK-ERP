import type { TenantModule } from '@/core/tenant/tenantEntitlements';
import { isPermissionEnabled } from '@/core/tenant/tenantEntitlements';
import { TENANT_PERMISSIONS } from '@/core/permissions/tenantPermissionConstants';

export type PageAccessLevel = 'no_access' | 'view_only' | 'manage' | 'full_access' | 'custom';

export interface PageActionPermission {
  permission: string;
  label: string;
  category: 'view' | 'manage' | 'sensitive';
}

export interface SidebarPageDefinition {
  id: string;
  name: string;
  path: string;
  moduleKey: string;
  parentGroup?: string;
  tenantModule?: TenantModule;
  supportedLevels: Array<'no_access' | 'view_only' | 'manage' | 'full_access'>;
  viewPermissions: string[];
  managePermissions: string[];
  fullPermissions: string[];
  allPermissions: string[];
  actions: PageActionPermission[];
}

export interface SidebarModuleDefinition {
  id: string;
  name: string;
  sectionTitle: string;
  tenantModule?: TenantModule;
  pages: SidebarPageDefinition[];
  allPermissions: string[];
}

export interface SidebarCatalogSection {
  title: string;
  modules: SidebarModuleDefinition[];
}

const sensitiveActionSuffixes = [
  'delete', 'approve', 'refund', 'void', 'post', 'configure', 'disable',
  'manage_prices', 'cancel', 'return',
];

export function isActionSensitive(permission: string): boolean {
  const parts = permission.split('.');
  const action = parts[parts.length - 1]?.toLowerCase() ?? '';
  return sensitiveActionSuffixes.some((suffix) => action.includes(suffix));
}

export function formatActionLabel(permission: string, pageLabel?: string): string {
  const parts = permission.split('.');
  const action = parts[parts.length - 1] ?? '';

  const actionWordMap: Record<string, string> = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    approve: 'Approve',
    export: 'Export',
    print: 'Print',
    configure: 'Configure',
    test: 'Test Connection',
    submit: 'Submit',
    confirm: 'Confirm',
    process: 'Process',
    post: 'Post to Ledger',
    return: 'Return',
    void: 'Void',
    refund: 'Refund',
    cancel: 'Cancel',
    manage: 'Manage',
    import: 'Import Data',
    upload: 'Upload',
    download: 'Download',
    archive: 'Archive',
    send: 'Send',
    open: 'Open Shift',
    close: 'Close Shift',
    disable: 'Disable',
    enable: 'Enable',
    activate: 'Activate',
    convert: 'Convert Lead',
    discount: 'Apply Discount',
    sell: 'Process Sale',
    reply: 'Reply to Ticket',
    reconcile: 'Reconcile',
    complete: 'Mark Complete',
    assign: 'Assign Tasks',
    count: 'Count Stock',
    request: 'Request Stock',
    receive: 'Receive Stock',
    adjust: 'Adjust Stock',
    transfer: 'Transfer Stock',
    reprint: 'Reprint Receipt',
    manage_warehouses: 'Manage Warehouses',
    manage_locations: 'Manage Stock Locations',
    view_batches: 'View Batches',
    view_serials: 'View Serial Numbers',
    view_expiry: 'View Expiry Dates',
    view_movements: 'View Ledger Movements',
    view_sensitive: 'Access Confidential Records',
    manage_prices: 'Manage Price Lists',
  };

  const actionText = actionWordMap[action] ?? action.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

  if (pageLabel && !actionText.toLowerCase().includes(pageLabel.toLowerCase())) {
    return `${actionText} ${pageLabel}`;
  }
  return actionText;
}

function buildPage(def: {
  id: string;
  name: string;
  path: string;
  moduleKey: string;
  parentGroup?: string;
  tenantModule?: TenantModule;
  view: string[];
  manage?: string[];
  sensitive?: string[];
  customLabels?: Record<string, string>;
}): SidebarPageDefinition {
  const viewPermissions = [...new Set(def.view)];
  const standardManage = def.manage ? [...new Set(def.manage)] : [];
  const sensitivePerms = def.sensitive ? [...new Set(def.sensitive)] : [];

  const managePermissions = [...new Set([...viewPermissions, ...standardManage])];
  const fullPermissions = [...new Set([...managePermissions, ...sensitivePerms])];
  const allPermissions = fullPermissions;

  const actions: PageActionPermission[] = [];
  for (const perm of viewPermissions) {
    actions.push({
      permission: perm,
      label: def.customLabels?.[perm] ?? formatActionLabel(perm, def.name),
      category: 'view',
    });
  }
  for (const perm of standardManage) {
    if (!viewPermissions.includes(perm)) {
      actions.push({
        permission: perm,
        label: def.customLabels?.[perm] ?? formatActionLabel(perm, def.name),
        category: 'manage',
      });
    }
  }
  for (const perm of sensitivePerms) {
    if (!viewPermissions.includes(perm) && !standardManage.includes(perm)) {
      actions.push({
        permission: perm,
        label: def.customLabels?.[perm] ?? formatActionLabel(perm, def.name),
        category: 'sensitive',
      });
    }
  }

  const supportedLevels: Array<'no_access' | 'view_only' | 'manage' | 'full_access'> = ['no_access'];
  if (viewPermissions.length > 0) {
    supportedLevels.push('view_only');
  }
  if (managePermissions.length > viewPermissions.length) {
    supportedLevels.push('manage');
  }
  if (fullPermissions.length > managePermissions.length || (fullPermissions.length > viewPermissions.length && !supportedLevels.includes('manage'))) {
    supportedLevels.push('full_access');
  } else if (fullPermissions.length > 0 && supportedLevels.length === 2 && supportedLevels.includes('view_only') && !supportedLevels.includes('manage')) {
    // If only view permissions exist, View Only is sufficient
  } else if (!supportedLevels.includes('full_access') && fullPermissions.length > viewPermissions.length) {
    supportedLevels.push('full_access');
  }

  return {
    id: def.id,
    name: def.name,
    path: def.path,
    moduleKey: def.moduleKey,
    parentGroup: def.parentGroup,
    tenantModule: def.tenantModule,
    supportedLevels,
    viewPermissions,
    managePermissions,
    fullPermissions,
    allPermissions,
    actions,
  };
}

/**
 * Builds the canonical sidebar-aligned permission hierarchy.
 * Matches ERP_NAVIGATION_SECTIONS order, names, and nested groups.
 */
function buildRawSidebarSections(): SidebarCatalogSection[] {
  return [
    {
      title: 'MAIN',
      modules: [
        {
          id: 'sync',
          name: 'Sync Queue',
          sectionTitle: 'MAIN',
          tenantModule: undefined,
          pages: [
            buildPage({
              id: 'sync.queue',
              name: 'Sync Queue',
              path: '/sync',
              moduleKey: 'sync',
              view: [TENANT_PERMISSIONS.SYNC.VIEW],
              manage: [TENANT_PERMISSIONS.SYNC.MANAGE],
            }),
          ],
          allPermissions: [TENANT_PERMISSIONS.SYNC.VIEW, TENANT_PERMISSIONS.SYNC.MANAGE],
        },
        {
          id: 'dashboard',
          name: 'Dashboard',
          sectionTitle: 'MAIN',
          tenantModule: undefined,
          pages: [
            buildPage({
              id: 'dashboard.home',
              name: 'Dashboard',
              path: '/dashboard',
              moduleKey: 'dashboard',
              view: ['dashboard.view', 'sales.view', 'reports.view'],
              customLabels: {
                'dashboard.view': 'View Main ERP Dashboard',
                'sales.view': 'View Operational Metrics',
                'reports.view': 'View Analytics Summary',
              },
            }),
          ],
          allPermissions: ['dashboard.view'],
        },
      ],
    },
    {
      title: 'RELATIONSHIPS',
      modules: [
        {
          id: 'crm',
          name: 'CRM',
          sectionTitle: 'RELATIONSHIPS',
          tenantModule: 'crm',
          pages: [
            buildPage({
              id: 'crm.leads',
              name: 'Leads',
              path: '/crm/leads',
              moduleKey: 'crm',
              tenantModule: 'crm',
              view: [TENANT_PERMISSIONS.LEADS.VIEW, 'crm.leads.view'],
              manage: [
                TENANT_PERMISSIONS.LEADS.CREATE,
                TENANT_PERMISSIONS.LEADS.EDIT,
                TENANT_PERMISSIONS.LEADS.CONVERT,
                'crm.leads.create',
                'crm.leads.edit',
              ],
              sensitive: [
                TENANT_PERMISSIONS.LEADS.DELETE,
                TENANT_PERMISSIONS.LEADS.EXPORT,
                'crm.leads.delete',
              ],
            }),
            buildPage({
              id: 'crm.opportunities',
              name: 'Opportunities',
              path: '/crm/opportunities',
              moduleKey: 'crm',
              tenantModule: 'crm',
              view: ['crm.opportunities.view', 'crm.pipeline.view', 'crm.activities.view'],
              manage: [
                'crm.opportunities.create',
                'crm.opportunities.edit',
                'crm.pipeline.edit',
                'crm.activities.create',
                'crm.activities.edit',
              ],
              sensitive: ['crm.opportunities.delete', 'crm.activities.delete'],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'customers',
          name: 'Customers',
          sectionTitle: 'RELATIONSHIPS',
          tenantModule: 'customers',
          pages: [
            buildPage({
              id: 'customers.list',
              name: 'Customers',
              path: '/customers',
              moduleKey: 'customers',
              tenantModule: 'customers',
              view: [TENANT_PERMISSIONS.CUSTOMERS.VIEW],
              manage: [TENANT_PERMISSIONS.CUSTOMERS.CREATE, TENANT_PERMISSIONS.CUSTOMERS.EDIT],
              sensitive: [TENANT_PERMISSIONS.CUSTOMERS.DELETE, TENANT_PERMISSIONS.CUSTOMERS.EXPORT],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'suppliers',
          name: 'Suppliers',
          sectionTitle: 'RELATIONSHIPS',
          tenantModule: 'suppliers',
          pages: [
            buildPage({
              id: 'suppliers.list',
              name: 'Suppliers',
              path: '/suppliers',
              moduleKey: 'suppliers',
              tenantModule: 'suppliers',
              view: [TENANT_PERMISSIONS.SUPPLIERS.SUPPLIERS_VIEW, 'suppliers.view'],
              manage: [
                TENANT_PERMISSIONS.SUPPLIERS.SUPPLIERS_CREATE,
                TENANT_PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT,
                'suppliers.create',
                'suppliers.edit',
              ],
              sensitive: [
                TENANT_PERMISSIONS.SUPPLIERS.SUPPLIERS_DELETE,
                TENANT_PERMISSIONS.SUPPLIERS.SUPPLIERS_EXPORT,
                'suppliers.delete',
              ],
            }),
          ],
          allPermissions: [],
        },
      ],
    },
    {
      title: 'COMMERCE & OPERATIONS',
      modules: [
        {
          id: 'products',
          name: 'Products & Services',
          sectionTitle: 'COMMERCE & OPERATIONS',
          tenantModule: 'products',
          pages: [
            buildPage({
              id: 'products.catalog',
              name: 'Item Catalog',
              path: '/products',
              moduleKey: 'products',
              tenantModule: 'products',
              view: [TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_VIEW, TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_DOWNLOAD],
              manage: [
                TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_CREATE,
                TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_EDIT,
                TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_ACTIVATE,
              ],
              sensitive: [
                TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_DELETE,
                TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_EXPORT,
                TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_MANAGE_PRICES,
              ],
            }),
            buildPage({
              id: 'products.import',
              name: 'Import Products',
              path: '/products/import',
              moduleKey: 'products',
              tenantModule: 'products',
              view: [TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_VIEW],
              manage: [TENANT_PERMISSIONS.PRODUCTS.PRODUCTS_IMPORT],
            }),
            buildPage({
              id: 'products.categories',
              name: 'Categories',
              path: '/products/categories',
              moduleKey: 'products',
              tenantModule: 'products',
              view: [TENANT_PERMISSIONS.PRODUCTS.CATEGORIES_VIEW],
              manage: [TENANT_PERMISSIONS.PRODUCTS.CATEGORIES_CREATE, TENANT_PERMISSIONS.PRODUCTS.CATEGORIES_EDIT],
              sensitive: [TENANT_PERMISSIONS.PRODUCTS.CATEGORIES_DELETE],
            }),
            buildPage({
              id: 'products.brands',
              name: 'Brands',
              path: '/products/brands',
              moduleKey: 'products',
              tenantModule: 'products',
              view: [TENANT_PERMISSIONS.PRODUCTS.BRANDS_VIEW],
              manage: [TENANT_PERMISSIONS.PRODUCTS.BRANDS_CREATE, TENANT_PERMISSIONS.PRODUCTS.BRANDS_EDIT],
              sensitive: [TENANT_PERMISSIONS.PRODUCTS.BRANDS_DELETE],
            }),
            buildPage({
              id: 'products.uoms',
              name: 'Units of Measure',
              path: '/products/uoms',
              moduleKey: 'products',
              tenantModule: 'products',
              view: [TENANT_PERMISSIONS.PRODUCTS.UOMS_VIEW],
              manage: [TENANT_PERMISSIONS.PRODUCTS.UOMS_CREATE, TENANT_PERMISSIONS.PRODUCTS.UOMS_EDIT],
              sensitive: [TENANT_PERMISSIONS.PRODUCTS.UOMS_DELETE],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'sales',
          name: 'Sales',
          sectionTitle: 'COMMERCE & OPERATIONS',
          tenantModule: 'sales',
          pages: [
            buildPage({
              id: 'sales.overview',
              name: 'Overview',
              path: '/sales',
              moduleKey: 'sales',
              tenantModule: 'sales',
              view: [TENANT_PERMISSIONS.SALES_WORKFLOW.VIEW, 'reports.sales.view'],
              sensitive: [TENANT_PERMISSIONS.SALES_WORKFLOW.EXPORT, 'reports.sales.export'],
            }),
            buildPage({
              id: 'sales.quotations',
              name: 'Quotations',
              path: '/sales/quotations',
              moduleKey: 'sales',
              tenantModule: 'sales',
              view: [TENANT_PERMISSIONS.SALES_WORKFLOW.VIEW, 'sales.quotations.view'],
              manage: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.QUOTATION_CREATE,
                TENANT_PERMISSIONS.SALES_WORKFLOW.QUOTATION_EDIT,
                TENANT_PERMISSIONS.SALES_WORKFLOW.QUOTATION_PRINT,
                'sales.quotations.create',
                'sales.quotations.edit',
                'sales.quotations.print',
              ],
              sensitive: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.QUOTATION_APPROVE,
                'sales.quotations.delete',
                'sales.quotations.approve',
                'sales.quotations.export',
              ],
            }),
            buildPage({
              id: 'sales.orders',
              name: 'Sales Orders',
              path: '/sales/orders',
              moduleKey: 'sales',
              tenantModule: 'sales',
              view: [TENANT_PERMISSIONS.SALES_WORKFLOW.VIEW, 'sales.orders.view'],
              manage: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.ORDER_CREATE,
                TENANT_PERMISSIONS.SALES_WORKFLOW.ORDER_EDIT,
                TENANT_PERMISSIONS.SALES_WORKFLOW.ORDER_PRINT,
                TENANT_PERMISSIONS.SALES_WORKFLOW.ORDER_CONFIRM,
                TENANT_PERMISSIONS.SALES_WORKFLOW.ORDER_PROCESS,
                'sales.orders.create',
                'sales.orders.edit',
                'sales.orders.print',
              ],
              sensitive: [
                'sales.orders.delete',
                'sales.orders.approve',
                'sales.orders.export',
              ],
            }),
            buildPage({
              id: 'sales.pos-orders',
              name: 'POS Sales Orders',
              path: '/sales/pos-orders',
              moduleKey: 'sales',
              tenantModule: 'sales',
              view: ['sales.orders.view', TENANT_PERMISSIONS.SALES_WORKFLOW.VIEW],
              manage: [TENANT_PERMISSIONS.SALES_WORKFLOW.ORDER_PRINT],
              sensitive: ['sales.orders.export'],
            }),
            buildPage({
              id: 'sales.invoices',
              name: 'Invoices',
              path: '/sales/invoices',
              moduleKey: 'sales',
              tenantModule: 'sales',
              view: [TENANT_PERMISSIONS.SALES_WORKFLOW.VIEW, 'sales.invoices.view'],
              manage: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_CREATE,
                TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_EDIT,
                TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_SUBMIT,
                TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_SEND,
                'sales.invoices.create',
                'sales.invoices.edit',
                'sales.invoices.print',
              ],
              sensitive: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_APPROVE,
                TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_POST,
                TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_RETURN,
                TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_VOID,
                'sales.invoices.delete',
                'sales.invoices.approve',
                'sales.invoices.export',
              ],
            }),
            buildPage({
              id: 'sales.deliveries',
              name: 'Delivery Notes',
              path: '/sales/deliveries',
              moduleKey: 'sales',
              tenantModule: 'sales',
              view: [TENANT_PERMISSIONS.SALES_WORKFLOW.VIEW, 'sales.deliveries.view'],
              manage: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.DELIVERY_CREATE,
                'sales.deliveries.create',
                'sales.deliveries.edit',
                'sales.deliveries.print',
              ],
              sensitive: ['sales.deliveries.delete', 'sales.deliveries.export'],
            }),
            buildPage({
              id: 'sales.returns',
              name: 'Customer Returns',
              path: '/sales/returns',
              moduleKey: 'sales',
              tenantModule: 'sales',
              view: [TENANT_PERMISSIONS.SALES_WORKFLOW.VIEW, 'sales.returns.view'],
              manage: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.RETURN_CREATE,
                'sales.returns.create',
                'sales.returns.edit',
                'sales.returns.print',
              ],
              sensitive: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_APPROVE,
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_POST,
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_RETURN,
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_VOID,
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_REFUND,
                'sales.returns.delete',
                'sales.returns.export',
              ],
            }),
            buildPage({
              id: 'sales.flash-sales',
              name: 'Flash Sales',
              path: '/sales/flash-sales',
              moduleKey: 'sales',
              tenantModule: 'sales',
              view: [TENANT_PERMISSIONS.SALES_WORKFLOW.FLASH_SALES_VIEW],
              manage: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.FLASH_SALES_CREATE,
                TENANT_PERMISSIONS.SALES_WORKFLOW.FLASH_SALES_EDIT,
                TENANT_PERMISSIONS.SALES_WORKFLOW.FLASH_SALES_SUBMIT,
              ],
              sensitive: [
                TENANT_PERMISSIONS.SALES_WORKFLOW.FLASH_SALES_APPROVE,
                TENANT_PERMISSIONS.SALES_WORKFLOW.FLASH_SALES_DISABLE,
              ],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'purchases',
          name: 'Purchases',
          sectionTitle: 'COMMERCE & OPERATIONS',
          tenantModule: 'purchases',
          pages: [
            buildPage({
              id: 'purchases.overview',
              name: 'Overview',
              path: '/purchases',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.VIEW, 'reports.purchases.view'],
              sensitive: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.EXPORT, 'reports.purchases.export'],
            }),
            buildPage({
              id: 'purchases.requests',
              name: 'Purchase Requests',
              path: '/purchases/requests',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.VIEW, TENANT_PERMISSIONS.PURCHASE_WORKFLOW.REQUEST_VIEW],
              manage: [
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.REQUEST_CREATE,
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.REQUEST_EDIT,
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.REQUEST_SUBMIT,
              ],
              sensitive: [
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.REQUEST_APPROVE,
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.REQUEST_RETURN,
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.REQUEST_CANCEL,
                'purchases.requests.delete',
              ],
            }),
            buildPage({
              id: 'purchases.rfqs',
              name: 'RFQs',
              path: '/purchases/rfqs',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.RFQ_VIEW, 'purchases.rfqs.view'],
              manage: [
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.RFQ_CREATE,
                'purchases.rfqs.create',
                'purchases.rfqs.edit',
              ],
              sensitive: ['purchases.rfqs.delete', 'purchases.rfqs.approve'],
            }),
            buildPage({
              id: 'purchases.quotations',
              name: 'Supplier Quotations',
              path: '/purchases/quotations',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.RFQ_VIEW, 'purchases.supplier_quotations.view'],
              manage: [
                'purchases.supplier_quotations.create',
                'purchases.supplier_quotations.edit',
              ],
              sensitive: [
                'purchases.supplier_quotations.delete',
                'purchases.supplier_quotations.approve',
              ],
            }),
            buildPage({
              id: 'purchases.comparison',
              name: 'Quotation Comparison',
              path: '/purchases/comparison',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.RFQ_VIEW, 'purchases.supplier_quotations.view'],
              sensitive: ['purchases.supplier_quotations.export'],
            }),
            buildPage({
              id: 'purchases.orders',
              name: 'Purchase Orders',
              path: '/purchases/orders',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.VIEW, 'purchases.orders.view'],
              manage: [
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.CREATE,
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.EDIT,
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.DIRECT_ORDER_CREATE,
                'purchases.orders.create',
                'purchases.orders.edit',
                'purchases.orders.print',
              ],
              sensitive: [
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.APPROVE,
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.CANCEL,
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.EXPORT,
                'purchases.orders.delete',
                'purchases.orders.approve',
                'purchases.orders.export',
              ],
            }),
            buildPage({
              id: 'purchases.receipts',
              name: 'Goods Receipts',
              path: '/purchases/receipts',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.GRN_VIEW, 'purchases.grns.view'],
              manage: [
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.GRN_CREATE,
                'purchases.grns.create',
                'purchases.grns.edit',
                'purchases.grns.print',
              ],
              sensitive: ['purchases.grns.delete', 'purchases.grns.approve'],
            }),
            buildPage({
              id: 'purchases.invoices',
              name: 'Purchase Invoices',
              path: '/purchases/invoices',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_VIEW, 'purchases.invoices.view'],
              manage: [
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_CREATE,
                'purchases.invoices.create',
                'purchases.invoices.edit',
                'purchases.invoices.print',
              ],
              sensitive: [
                'purchases.invoices.delete',
                'purchases.invoices.approve',
              ],
            }),
            buildPage({
              id: 'purchases.matching',
              name: 'PO / GRN Matching',
              path: '/purchases/matching',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_VIEW, 'purchases.invoices.view'],
              manage: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_CREATE],
            }),
            buildPage({
              id: 'purchases.returns',
              name: 'Purchase Returns',
              path: '/purchases/returns',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.VIEW, 'purchases.returns.view'],
              manage: [
                TENANT_PERMISSIONS.PURCHASE_WORKFLOW.CREATE,
                'purchases.returns.create',
                'purchases.returns.edit',
              ],
              sensitive: ['purchases.returns.delete', 'purchases.returns.approve'],
            }),
            buildPage({
              id: 'purchases.payments',
              name: 'Supplier Payments',
              path: '/purchases/payments',
              moduleKey: 'purchases',
              tenantModule: 'purchases',
              view: [TENANT_PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_VIEW, 'finance.cash.view', 'finance.payables.view'],
              manage: ['finance.payables.create'],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'inventory',
          name: 'Inventory',
          sectionTitle: 'COMMERCE & OPERATIONS',
          tenantModule: 'inventory',
          pages: [
            buildPage({
              id: 'inventory.overview',
              name: 'Overview',
              path: '/inventory',
              moduleKey: 'inventory',
              tenantModule: 'inventory',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW],
              sensitive: [TENANT_PERMISSIONS.INVENTORY.EXPORT],
            }),
            buildPage({
              id: 'inventory.fulfilment',
              name: 'Sales Fulfilment',
              path: '/inventory/fulfilment',
              moduleKey: 'inventory',
              tenantModule: 'inventory',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.SALES_WORKFLOW.FULFILLMENT_VIEW],
              manage: [TENANT_PERMISSIONS.SALES_WORKFLOW.ORDER_PROCESS, TENANT_PERMISSIONS.SALES_WORKFLOW.DELIVERY_CREATE],
            }),
            buildPage({
              id: 'inventory.stocks',
              name: 'Stock Levels',
              path: '/inventory/stocks',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_VIEW_ALL_BRANCHES],
              sensitive: [TENANT_PERMISSIONS.INVENTORY.EXPORT],
            }),
            buildPage({
              id: 'inventory.warehouses',
              name: 'Warehouses',
              path: '/inventory/warehouses',
              moduleKey: 'inventory',
              tenantModule: 'inventory',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.WAREHOUSES_VIEW],
              manage: [
                TENANT_PERMISSIONS.INVENTORY.WAREHOUSES_CREATE,
                TENANT_PERMISSIONS.INVENTORY.WAREHOUSES_EDIT,
                TENANT_PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES,
              ],
              sensitive: [TENANT_PERMISSIONS.INVENTORY.WAREHOUSES_DELETE],
            }),
            buildPage({
              id: 'inventory.locations',
              name: 'Stock Locations',
              path: '/inventory/locations',
              moduleKey: 'inventory',
              tenantModule: 'inventory',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.LOCATIONS_VIEW],
              manage: [
                TENANT_PERMISSIONS.INVENTORY.LOCATIONS_CREATE,
                TENANT_PERMISSIONS.INVENTORY.LOCATIONS_EDIT,
                TENANT_PERMISSIONS.INVENTORY.MANAGE_LOCATIONS,
              ],
              sensitive: [TENANT_PERMISSIONS.INVENTORY.LOCATIONS_DELETE],
            }),
            buildPage({
              id: 'inventory.batches',
              name: 'Batch Tracking',
              path: '/inventory/batches',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.VIEW_BATCHES, TENANT_PERMISSIONS.INVENTORY.BATCHES_VIEW],
              manage: ['inventory.batches.create', 'inventory.batches.edit'],
              sensitive: ['inventory.batches.delete'],
            }),
            buildPage({
              id: 'inventory.serials',
              name: 'Serial Numbers',
              path: '/inventory/serials',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.VIEW_SERIALS, TENANT_PERMISSIONS.INVENTORY.SERIAL_NUMBERS_VIEW],
              manage: ['inventory.serial_numbers.create', 'inventory.serial_numbers.edit'],
              sensitive: ['inventory.serial_numbers.delete'],
            }),
            buildPage({
              id: 'inventory.expiry',
              name: 'Expiry Alerts',
              path: '/inventory/expiry',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.VIEW_EXPIRY, TENANT_PERMISSIONS.INVENTORY.EXPIRY_VIEW],
            }),
            buildPage({
              id: 'inventory.movements',
              name: 'Movement Ledger',
              path: '/inventory/movements',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.VIEW_MOVEMENTS, TENANT_PERMISSIONS.INVENTORY.MOVEMENTS_VIEW],
              manage: ['inventory.movements.create'],
            }),
            buildPage({
              id: 'inventory.adjustments',
              name: 'Stock Adjustments',
              path: '/inventory/adjustments',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.ADJUSTMENTS_VIEW],
              manage: [
                'inventory.adjustments.create',
                'inventory.adjustments.edit',
                TENANT_PERMISSIONS.INVENTORY.STOCK_ADJUST,
              ],
              sensitive: [
                'inventory.adjustments.delete',
                TENANT_PERMISSIONS.INVENTORY.STOCK_APPROVE,
              ],
            }),
            buildPage({
              id: 'inventory.transfers',
              name: 'Stock Transfers',
              path: '/inventory/transfers',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.TRANSFERS_VIEW],
              manage: [
                'inventory.transfers.create',
                'inventory.transfers.edit',
                TENANT_PERMISSIONS.INVENTORY.STOCK_TRANSFER,
                TENANT_PERMISSIONS.INVENTORY.STOCK_RECEIVE,
              ],
              sensitive: [
                'inventory.transfers.delete',
                TENANT_PERMISSIONS.INVENTORY.STOCK_APPROVE,
              ],
            }),
            buildPage({
              id: 'inventory.requests',
              name: 'Branch Stock Requests',
              path: '/inventory/requests',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_REQUEST],
              manage: [TENANT_PERMISSIONS.INVENTORY.STOCK_REQUEST],
              sensitive: [TENANT_PERMISSIONS.INVENTORY.STOCK_APPROVE],
            }),
            buildPage({
              id: 'inventory.counts',
              name: 'Stock Counts',
              path: '/inventory/counts',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_COUNT, 'inventory.stock_counts.view'],
              manage: [
                'inventory.stock_counts.create',
                'inventory.stock_counts.edit',
                TENANT_PERMISSIONS.INVENTORY.STOCK_COUNT,
              ],
              sensitive: [
                'inventory.stock_counts.delete',
                TENANT_PERMISSIONS.INVENTORY.STOCK_APPROVE,
              ],
            }),
            buildPage({
              id: 'inventory.returns-wastage',
              name: 'Returns & Wastage',
              path: '/inventory/returns-wastage',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_ADJUST],
              manage: [TENANT_PERMISSIONS.INVENTORY.STOCK_ADJUST],
            }),
            buildPage({
              id: 'inventory.reports.aging',
              name: 'Stock Ageing Report',
              path: '/inventory/reports/aging',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_VIEW, 'reports.inventory.view'],
              sensitive: ['reports.inventory.export'],
            }),
            buildPage({
              id: 'inventory.reports.margins',
              name: 'Stock Margins',
              path: '/inventory/reports/margins',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_VIEW, 'reports.inventory.view'],
              sensitive: ['reports.inventory.export'],
            }),
            buildPage({
              id: 'inventory.reports.expiry',
              name: 'Expiry Report',
              path: '/inventory/reports/expiry',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.VIEW_EXPIRY, 'reports.inventory.view'],
              sensitive: ['reports.inventory.export'],
            }),
            buildPage({
              id: 'inventory.reports.wastage',
              name: 'Wastage Report',
              path: '/inventory/reports/wastage',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_ADJUST, 'reports.inventory.view'],
              sensitive: ['reports.inventory.export'],
            }),
            buildPage({
              id: 'inventory.velocity',
              name: 'Stock Velocity',
              path: '/inventory/velocity',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.VELOCITY_VIEW, 'reports.inventory.view'],
              sensitive: ['reports.inventory.export'],
            }),
            buildPage({
              id: 'inventory.reorder',
              name: 'Reorder Workflow',
              path: '/inventory/reorder',
              moduleKey: 'inventory',
              tenantModule: 'stock',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.STOCK_VIEW],
              manage: [TENANT_PERMISSIONS.INVENTORY.STOCK_REQUEST, TENANT_PERMISSIONS.PURCHASE_WORKFLOW.REQUEST_CREATE],
            }),
            buildPage({
              id: 'inventory.settings',
              name: 'Inventory Settings',
              path: '/inventory/settings',
              moduleKey: 'inventory',
              tenantModule: 'inventory',
              view: [TENANT_PERMISSIONS.INVENTORY.VIEW, TENANT_PERMISSIONS.INVENTORY.SETTINGS_VIEW],
              sensitive: [TENANT_PERMISSIONS.INVENTORY.SETTINGS_MANAGE],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'pos',
          name: 'POS',
          sectionTitle: 'COMMERCE & OPERATIONS',
          tenantModule: 'pos',
          pages: [
            buildPage({
              id: 'pos.terminal',
              name: 'Terminal',
              path: '/pos/terminal',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.VIEW, 'pos.terminal.view'],
              manage: [
                TENANT_PERMISSIONS.POS.SELL,
                'pos.terminal.create',
                'pos.terminal.edit',
              ],
              sensitive: [TENANT_PERMISSIONS.POS.DISCOUNT],
            }),
            buildPage({
              id: 'pos.shifts',
              name: 'Register Shifts',
              path: '/pos/shifts',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.VIEW, 'pos.shifts.view'],
              manage: [
                TENANT_PERMISSIONS.POS.SHIFT_OPEN,
                TENANT_PERMISSIONS.POS.SHIFT_CLOSE,
                'pos.shifts.create',
                'pos.shifts.edit',
              ],
              sensitive: [TENANT_PERMISSIONS.POS.SHIFT_APPROVE],
            }),
            buildPage({
              id: 'pos.returns',
              name: 'Returns',
              path: '/pos/returns',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.VIEW, 'pos.transactions.view'],
              sensitive: [TENANT_PERMISSIONS.POS.REFUND, 'pos.transactions.create'],
            }),
            buildPage({
              id: 'pos.customer-display',
              name: 'Customer Display',
              path: '/pos/customer-display',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.VIEW, 'settings.customer_display.view'],
            }),
            buildPage({
              id: 'pos.kitchen',
              name: 'Kitchen Display',
              path: '/pos/kitchen',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.VIEW],
            }),
            buildPage({
              id: 'pos.web-orders',
              name: 'Web Orders',
              path: '/pos/web-orders',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.VIEW, 'sales.orders.view'],
            }),
            buildPage({
              id: 'pos.settings',
              name: 'POS Settings',
              path: '/pos/settings',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.VIEW],
              sensitive: [TENANT_PERMISSIONS.POS.SETTINGS_MANAGE],
            }),
            buildPage({
              id: 'pos.reports',
              name: 'POS Reports',
              path: '/pos/reports',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.REPORT_VIEW, 'reports.pos.view'],
              sensitive: ['reports.pos.export'],
            }),
            buildPage({
              id: 'pos.receipts',
              name: 'Receipts',
              path: '/pos/receipts',
              moduleKey: 'pos',
              tenantModule: 'pos',
              view: [TENANT_PERMISSIONS.POS.VIEW],
              manage: [TENANT_PERMISSIONS.POS.RECEIPT_REPRINT],
            }),
          ],
          allPermissions: [],
        },
      ],
    },
    {
      title: 'MANAGEMENT',
      modules: [
        {
          id: 'finance',
          name: 'Finance & Accounts',
          sectionTitle: 'MANAGEMENT',
          tenantModule: 'finance',
          pages: [
            buildPage({
              id: 'finance.dashboard',
              name: 'Accounting Dashboard',
              path: '/finance/dashboard',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.reports.view', 'reports.finance.view'],
              sensitive: ['finance.reports.export', 'reports.finance.export'],
            }),
            buildPage({
              id: 'finance.invoice-approvals',
              name: 'Invoice Approvals',
              path: '/finance/invoice-approvals',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['sales.invoices.view', TENANT_PERMISSIONS.SALES_WORKFLOW.VIEW],
              sensitive: [TENANT_PERMISSIONS.SALES_WORKFLOW.INVOICE_APPROVE],
            }),
            buildPage({
              id: 'finance.credit-memos',
              name: 'Customer Credit Notes',
              path: '/finance/credit-memos',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.receivables.view', 'sales.credit_notes.view'],
              manage: ['sales.credit_notes.create', 'sales.credit_notes.edit'],
              sensitive: [
                'sales.credit_notes.delete',
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_APPROVE,
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_POST,
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_VOID,
                TENANT_PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_REFUND,
              ],
            }),
            buildPage({
              id: 'finance.chart-of-accounts',
              name: 'Chart of Accounts',
              path: '/finance/chart-of-accounts',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.chart_of_accounts.view'],
              manage: ['finance.chart_of_accounts.create', 'finance.chart_of_accounts.edit'],
              sensitive: ['finance.chart_of_accounts.delete', 'finance.chart_of_accounts.export'],
            }),
            buildPage({
              id: 'finance.opening-balances',
              name: 'Opening Balances',
              path: '/finance/opening-balances',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.chart_of_accounts.view'],
              manage: ['finance.chart_of_accounts.edit'],
            }),
            buildPage({
              id: 'finance.journal',
              name: 'Journal Entries',
              path: '/finance/journal',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.journals.view'],
              manage: ['finance.journals.create', 'finance.journals.edit'],
              sensitive: ['finance.journals.delete', 'finance.journals.approve', 'finance.journals.post'],
            }),
            buildPage({
              id: 'finance.receivables',
              name: 'Accounts Receivable',
              path: '/finance/receivables',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.receivables.view'],
              manage: ['finance.receivables.create', 'finance.receivables.edit'],
              sensitive: ['finance.receivables.delete'],
            }),
            buildPage({
              id: 'finance.payables',
              name: 'Accounts Payable',
              path: '/finance/payables',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.payables.view'],
              manage: ['finance.payables.create', 'finance.payables.edit'],
              sensitive: ['finance.payables.delete'],
            }),
            buildPage({
              id: 'finance.payments',
              name: 'Payments & Receipts',
              path: '/finance/payments',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.cash.view'],
              manage: ['finance.cash.create', 'finance.cash.edit'],
              sensitive: ['finance.cash.delete'],
            }),
            buildPage({
              id: 'finance.expenses',
              name: 'Expenses',
              path: '/finance/expenses',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.expenses.view'],
              manage: ['finance.expenses.create', 'finance.expenses.edit'],
              sensitive: ['finance.expenses.delete', 'finance.expenses.approve'],
            }),
            buildPage({
              id: 'finance.ledger',
              name: 'General Ledger',
              path: '/finance/ledger',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.reports.view'],
              sensitive: ['finance.reports.export'],
            }),
            buildPage({
              id: 'finance.trial-balance',
              name: 'Trial Balance',
              path: '/finance/trial-balance',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.reports.view'],
              sensitive: ['finance.reports.export'],
            }),
            buildPage({
              id: 'finance.profit-loss',
              name: 'Financial Reports',
              path: '/finance/profit-loss',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.reports.view', 'reports.finance.view'],
              sensitive: ['finance.reports.export', 'reports.finance.export'],
            }),
            buildPage({
              id: 'finance.banks',
              name: 'Bank Accounts',
              path: '/finance/banks',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.bank.view'],
              manage: ['finance.bank.create', 'finance.bank.edit', 'finance.reconciliation.view', 'finance.reconciliation.reconcile'],
              sensitive: ['finance.bank.delete'],
            }),
            buildPage({
              id: 'finance.tax',
              name: 'Tax Management',
              path: '/finance/tax',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.reports.view', 'settings.taxes.view'],
              manage: ['settings.taxes.create', 'settings.taxes.edit'],
              sensitive: ['settings.taxes.configure', 'settings.taxes.delete'],
            }),
            buildPage({
              id: 'finance.handoffs',
              name: 'Accounting Handoffs',
              path: '/finance/handoffs',
              moduleKey: 'finance',
              tenantModule: 'finance',
              view: ['finance.reports.view'],
              sensitive: ['finance.reports.export'],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'hr',
          name: 'HR & Payroll',
          sectionTitle: 'MANAGEMENT',
          tenantModule: 'hr',
          pages: [
            buildPage({
              id: 'hr.dashboard',
              name: 'HR Dashboard',
              path: '/hr/dashboard',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.employees.view'],
            }),
            buildPage({
              id: 'hr.employees',
              name: 'Employees',
              path: '/hr/employees',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.employees.view'],
              manage: ['hr.employees.create', 'hr.employees.edit'],
              sensitive: ['hr.employees.delete', 'hr.employees.export'],
            }),
            buildPage({
              id: 'hr.attendance',
              name: 'Attendance',
              path: '/hr/attendance',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.attendance.view'],
              manage: ['hr.attendance.create', 'hr.attendance.edit'],
              sensitive: ['hr.attendance.delete', 'hr.attendance.approve'],
            }),
            buildPage({
              id: 'hr.shifts',
              name: 'Shifts & Roster',
              path: '/hr/shifts',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.shifts.view'],
              manage: ['hr.shifts.create', 'hr.shifts.edit'],
              sensitive: ['hr.shifts.delete'],
            }),
            buildPage({
              id: 'hr.corrections',
              name: 'Attendance Corrections',
              path: '/hr/corrections',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.attendance.view'],
              manage: ['hr.attendance.edit'],
              sensitive: ['hr.attendance.approve'],
            }),
            buildPage({
              id: 'hr.leaves',
              name: 'Leave Requests',
              path: '/hr/leaves',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.leave.view'],
              manage: ['hr.leave.create', 'hr.leave.edit'],
              sensitive: ['hr.leave.delete', 'hr.leave.approve'],
            }),
            buildPage({
              id: 'hr.payroll',
              name: 'Payroll',
              path: '/hr/payroll',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.payroll.view'],
              manage: ['hr.payroll.create', 'hr.payroll.edit', 'hr.payroll.process'],
              sensitive: ['hr.payroll.delete', 'hr.payroll.approve'],
            }),
            buildPage({
              id: 'hr.overtime',
              name: 'Overtime',
              path: '/hr/overtime',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.overtime.view'],
              manage: ['hr.overtime.create', 'hr.overtime.edit'],
              sensitive: ['hr.overtime.approve'],
            }),
            buildPage({
              id: 'hr.payslips',
              name: 'Payslips',
              path: '/hr/payslips',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.payslips.view'],
              sensitive: ['hr.payslips.export'],
            }),
            buildPage({
              id: 'hr.recruitment',
              name: 'Recruitment',
              path: '/hr/recruitment',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.recruitment.view'],
              manage: ['hr.recruitment.create', 'hr.recruitment.edit'],
              sensitive: ['hr.recruitment.delete'],
            }),
            buildPage({
              id: 'hr.onboarding',
              name: 'Onboarding',
              path: '/hr/onboarding',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.onboarding.view'],
              manage: ['hr.onboarding.create', 'hr.onboarding.edit'],
              sensitive: ['hr.onboarding.delete'],
            }),
            buildPage({
              id: 'hr.training',
              name: 'Training',
              path: '/hr/training',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.training.view'],
              manage: ['hr.training.create', 'hr.training.edit'],
              sensitive: ['hr.training.delete'],
            }),
            buildPage({
              id: 'hr.performance',
              name: 'Performance',
              path: '/hr/performance',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.performance.view', 'hr.okr.view', 'hr.feedback.view'],
              manage: [
                'hr.performance.create',
                'hr.performance.edit',
                'hr.okr.create',
                'hr.okr.edit',
                'hr.feedback.create',
              ],
              sensitive: ['hr.performance.delete'],
            }),
            buildPage({
              id: 'hr.calendar',
              name: 'HR Calendar',
              path: '/hr/calendar',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.employees.view', 'hr.shifts.view'],
            }),
            buildPage({
              id: 'hr.assets',
              name: 'Employee Assets',
              path: '/hr/assets',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.assets.view'],
              manage: ['hr.assets.create', 'hr.assets.edit'],
              sensitive: ['hr.assets.delete'],
            }),
            buildPage({
              id: 'hr.exits',
              name: 'Employee Exits',
              path: '/hr/exits',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.exits.view'],
              manage: ['hr.exits.create', 'hr.exits.edit'],
              sensitive: ['hr.exits.delete'],
            }),
            buildPage({
              id: 'hr.analytics',
              name: 'HR Analytics & Reports',
              path: '/hr/analytics',
              moduleKey: 'hr',
              tenantModule: 'hr',
              view: ['hr.reports.view', 'reports.hr.view'],
              sensitive: ['hr.reports.export', 'reports.hr.export'],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'projects',
          name: 'Projects',
          sectionTitle: 'MANAGEMENT',
          tenantModule: 'projects',
          pages: [
            buildPage({
              id: 'projects.list',
              name: 'All Projects',
              path: '/projects/list',
              moduleKey: 'projects',
              tenantModule: 'projects',
              view: ['projects.projects.view'],
              manage: ['projects.projects.create', 'projects.projects.edit', 'projects.projects.complete'],
              sensitive: ['projects.projects.delete', 'projects.projects.export'],
            }),
            buildPage({
              id: 'projects.milestones',
              name: 'Milestones',
              path: '/projects/milestones',
              moduleKey: 'projects',
              tenantModule: 'projects',
              view: ['projects.milestones.view'],
              manage: ['projects.milestones.create', 'projects.milestones.edit'],
              sensitive: ['projects.milestones.delete'],
            }),
            buildPage({
              id: 'projects.tasks',
              name: 'Tasks',
              path: '/projects/tasks',
              moduleKey: 'projects',
              tenantModule: 'projects',
              view: ['projects.tasks.view'],
              manage: ['projects.tasks.create', 'projects.tasks.edit', 'projects.tasks.assign'],
              sensitive: ['projects.tasks.delete'],
            }),
            buildPage({
              id: 'projects.timesheets',
              name: 'Timesheets',
              path: '/projects/timesheets',
              moduleKey: 'projects',
              tenantModule: 'projects',
              view: ['projects.timesheets.view'],
              manage: ['projects.timesheets.create', 'projects.timesheets.edit'],
              sensitive: ['projects.timesheets.delete', 'projects.timesheets.approve'],
            }),
            buildPage({
              id: 'projects.expenses',
              name: 'Project Expenses',
              path: '/projects/expenses',
              moduleKey: 'projects',
              tenantModule: 'projects',
              view: ['projects.expenses.view'],
              manage: ['projects.expenses.create', 'projects.expenses.edit'],
              sensitive: ['projects.expenses.delete', 'projects.expenses.approve'],
            }),
            buildPage({
              id: 'projects.billing',
              name: 'Billing',
              path: '/projects/billing',
              moduleKey: 'projects',
              tenantModule: 'projects',
              view: ['projects.billing.view'],
              manage: ['projects.billing.create', 'projects.billing.edit'],
              sensitive: ['projects.billing.delete'],
            }),
            buildPage({
              id: 'projects.profitability',
              name: 'Profitability & Reports',
              path: '/projects/profitability',
              moduleKey: 'projects',
              tenantModule: 'projects',
              view: ['projects.reports.view', 'reports.projects.view'],
              sensitive: ['projects.reports.export', 'reports.projects.export'],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'documents',
          name: 'Documents',
          sectionTitle: 'MANAGEMENT',
          tenantModule: 'documents',
          pages: [
            buildPage({
              id: 'documents.browser',
              name: 'Documents',
              path: '/documents',
              moduleKey: 'documents',
              tenantModule: 'documents',
              view: [TENANT_PERMISSIONS.DOCUMENTS.VIEW, TENANT_PERMISSIONS.DOCUMENTS.DOWNLOAD],
              manage: [TENANT_PERMISSIONS.DOCUMENTS.UPLOAD, TENANT_PERMISSIONS.DOCUMENTS.EDIT],
              sensitive: [TENANT_PERMISSIONS.DOCUMENTS.ARCHIVE, TENANT_PERMISSIONS.DOCUMENTS.VIEW_SENSITIVE],
            }),
          ],
          allPermissions: [],
        },
      ],
    },
    {
      title: 'SYSTEM',
      modules: [
        {
          id: 'support',
          name: 'Support Tickets',
          sectionTitle: 'SYSTEM',
          tenantModule: undefined,
          pages: [
            buildPage({
              id: 'support.tickets',
              name: 'Support Tickets',
              path: '/support/tickets',
              moduleKey: 'support',
              view: [TENANT_PERMISSIONS.SUPPORT.VIEW],
              manage: [
                TENANT_PERMISSIONS.SUPPORT.CREATE,
                TENANT_PERMISSIONS.SUPPORT.REPLY,
                TENANT_PERMISSIONS.SUPPORT.CLOSE,
              ],
              sensitive: [
                TENANT_PERMISSIONS.SUPPORT.EXPORT,
                TENANT_PERMISSIONS.SUPPORT.MANAGE,
              ],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'audit',
          name: 'Audit Logs',
          sectionTitle: 'SYSTEM',
          tenantModule: undefined,
          pages: [
            buildPage({
              id: 'audit.logs',
              name: 'Audit Logs',
              path: '/audit',
              moduleKey: 'audit',
              view: ['audit.events.view', 'audit.view'],
              sensitive: ['audit.events.export'],
              customLabels: {
                'audit.events.view': 'View Tenant Audit Events',
                'audit.view': 'View Audit Dashboard',
                'audit.events.export': 'Export Audit Trail',
              },
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'notifications',
          name: 'Notifications',
          sectionTitle: 'SYSTEM',
          tenantModule: 'notifications',
          pages: [
            buildPage({
              id: 'notifications.center',
              name: 'Notification Center',
              path: '/notifications',
              moduleKey: 'notifications',
              tenantModule: 'notifications',
              view: [TENANT_PERMISSIONS.NOTIFICATIONS.VIEW],
              manage: [TENANT_PERMISSIONS.NOTIFICATIONS.MANAGE],
            }),
            buildPage({
              id: 'notifications.notices',
              name: 'Notices',
              path: '/notifications/notices',
              moduleKey: 'notifications',
              tenantModule: 'notifications',
              view: [TENANT_PERMISSIONS.NOTIFICATIONS.NOTICES_VIEW],
            }),
          ],
          allPermissions: [],
        },
        {
          id: 'settings',
          name: 'Settings',
          sectionTitle: 'SYSTEM',
          tenantModule: 'settings',
          pages: [
            // Organization
            buildPage({
              id: 'settings.company',
              name: 'Company Profile',
              path: '/settings/company',
              moduleKey: 'settings',
              parentGroup: 'Organization',
              tenantModule: 'settings',
              view: ['settings.company.view'],
              manage: ['settings.company.edit'],
              sensitive: ['settings.company.configure'],
            }),
            buildPage({
              id: 'settings.branches',
              name: 'Branches',
              path: '/settings/branches',
              moduleKey: 'settings',
              parentGroup: 'Organization',
              tenantModule: 'settings',
              view: ['settings.branches.view'],
              manage: ['settings.branches.create', 'settings.branches.edit'],
              sensitive: ['settings.branches.delete', 'settings.branches.configure'],
            }),
            buildPage({
              id: 'settings.departments',
              name: 'Departments',
              path: '/settings/departments',
              moduleKey: 'settings',
              parentGroup: 'Organization',
              tenantModule: 'hr',
              view: ['settings.departments.view', 'hr.departments.view'],
              manage: ['settings.departments.create', 'settings.departments.edit'],
              sensitive: ['settings.departments.delete'],
            }),
            buildPage({
              id: 'settings.roles',
              name: 'Roles',
              path: '/settings/roles',
              moduleKey: 'settings',
              parentGroup: 'Organization',
              tenantModule: 'settings',
              view: ['settings.roles.view', 'roles.view'],
              manage: ['settings.roles.create', 'settings.roles.edit', 'roles.create', 'roles.edit'],
              sensitive: ['settings.roles.delete', 'roles.manage', 'settings.roles.configure'],
            }),
            buildPage({
              id: 'settings.designations',
              name: 'Designations',
              path: '/settings/designations',
              moduleKey: 'settings',
              parentGroup: 'Organization',
              tenantModule: 'hr',
              view: ['settings.designations.view', 'hr.designations.view'],
              manage: ['settings.designations.create', 'settings.designations.edit'],
              sensitive: ['settings.designations.delete'],
            }),

            // Team & Access
            buildPage({
              id: 'settings.users',
              name: 'Users & Staff',
              path: '/settings/users',
              moduleKey: 'settings',
              parentGroup: 'Team & Access',
              tenantModule: 'settings',
              view: ['settings.users.view', 'users.view'],
              manage: ['settings.users.create', 'settings.users.edit', 'users.create', 'users.edit'],
              sensitive: ['settings.users.delete', 'users.delete', 'users.manage'],
            }),
            buildPage({
              id: 'settings.permissions',
              name: 'Permission Matrix',
              path: '/settings/permissions',
              moduleKey: 'settings',
              parentGroup: 'Team & Access',
              tenantModule: 'settings',
              view: ['settings.permissions.view'],
              manage: ['settings.permissions.edit'],
              sensitive: ['settings.permissions.configure'],
            }),
            buildPage({
              id: 'settings.login-activity',
              name: 'Login Activity',
              path: '/settings/login-activity',
              moduleKey: 'settings',
              parentGroup: 'Team & Access',
              tenantModule: 'settings',
              view: ['settings.login_activity.view'],
            }),

            // General & Localization
            buildPage({
              id: 'settings.preferences',
              name: 'General Settings',
              path: '/settings/preferences',
              moduleKey: 'settings',
              parentGroup: 'General & Localization',
              tenantModule: 'settings',
              view: ['settings.preferences.view'],
              manage: ['settings.preferences.edit'],
              sensitive: ['settings.preferences.configure'],
            }),
            buildPage({
              id: 'settings.localization',
              name: 'Currency & Localization',
              path: '/settings/localization',
              moduleKey: 'settings',
              parentGroup: 'General & Localization',
              tenantModule: 'settings',
              view: ['settings.localization.view'],
              manage: ['settings.localization.edit'],
              sensitive: ['settings.localization.configure'],
            }),
            buildPage({
              id: 'settings.document-numbering',
              name: 'Document Numbering',
              path: '/settings/document-numbering',
              moduleKey: 'settings',
              parentGroup: 'General & Localization',
              tenantModule: 'settings',
              view: ['settings.document_settings.view'],
              manage: ['settings.document_settings.edit'],
              sensitive: ['settings.document_settings.configure'],
            }),

            // Finance & Payments
            buildPage({
              id: 'settings.financial-year',
              name: 'Financial Year',
              path: '/settings/financial-year',
              moduleKey: 'settings',
              parentGroup: 'Finance & Payments',
              tenantModule: 'finance',
              view: ['settings.financial_year.view'],
              manage: ['settings.financial_year.create', 'settings.financial_year.edit'],
              sensitive: ['settings.financial_year.configure', 'settings.financial_year.delete'],
            }),
            buildPage({
              id: 'settings.taxes',
              name: 'Tax / VAT',
              path: '/settings/taxes',
              moduleKey: 'settings',
              parentGroup: 'Finance & Payments',
              tenantModule: 'finance',
              view: ['settings.taxes.view'],
              manage: ['settings.taxes.create', 'settings.taxes.edit'],
              sensitive: ['settings.taxes.configure', 'settings.taxes.delete'],
            }),
            buildPage({
              id: 'settings.payment-terms',
              name: 'Payment Terms',
              path: '/settings/payment-terms',
              moduleKey: 'settings',
              parentGroup: 'Finance & Payments',
              tenantModule: 'finance',
              view: ['settings.payment_terms.view'],
              manage: ['settings.payment_terms.create', 'settings.payment_terms.edit'],
              sensitive: ['settings.payment_terms.delete'],
            }),
            buildPage({
              id: 'settings.settlement-bank',
              name: 'Settlement Bank Account',
              path: '/settings/settlement-bank',
              moduleKey: 'settings',
              parentGroup: 'Finance & Payments',
              tenantModule: 'finance',
              view: ['settings.settlement_bank.view'],
              manage: ['settings.settlement_bank.edit'],
            }),

            // Notifications & Channels
            buildPage({
              id: 'settings.notification-preferences',
              name: 'Notification Preferences',
              path: '/settings/notification-preferences',
              moduleKey: 'settings',
              parentGroup: 'Notifications & Channels',
              tenantModule: 'notifications',
              view: ['settings.notification_preferences.view'],
              manage: ['settings.notification_preferences.edit', 'notificationPreferences.manage'],
            }),
            buildPage({
              id: 'settings.integrations.email',
              name: 'Email Channel',
              path: '/settings/integrations/email',
              moduleKey: 'settings',
              parentGroup: 'Notifications & Channels',
              tenantModule: 'notifications',
              view: ['settings.email_integration.view'],
              manage: ['settings.email_integration.edit', 'settings.email_integration.test'],
            }),
            buildPage({
              id: 'settings.integrations.sms',
              name: 'SMS Channel',
              path: '/settings/integrations/sms',
              moduleKey: 'settings',
              parentGroup: 'Notifications & Channels',
              tenantModule: 'notifications',
              view: ['settings.sms_integration.view'],
              manage: ['settings.sms_integration.edit', 'settings.sms_integration.test'],
            }),
            buildPage({
              id: 'settings.integrations.whatsapp',
              name: 'WhatsApp Channel',
              path: '/settings/integrations/whatsapp',
              moduleKey: 'settings',
              parentGroup: 'Notifications & Channels',
              tenantModule: 'notifications',
              view: ['settings.whatsapp_integration.view'],
              manage: ['settings.whatsapp_integration.edit', 'settings.whatsapp_integration.test'],
            }),

            // Devices & POS
            buildPage({
              id: 'settings.devices.barcode-scanner',
              name: 'Barcode Scanner',
              path: '/settings/devices/barcode-scanner',
              moduleKey: 'settings',
              parentGroup: 'Devices & POS',
              tenantModule: 'pos',
              view: ['settings.barcode_scanner.view'],
              manage: ['settings.barcode_scanner.edit', 'settings.barcode_scanner.test'],
            }),
            buildPage({
              id: 'settings.devices.printer',
              name: 'Printer',
              path: '/settings/devices/printer',
              moduleKey: 'settings',
              parentGroup: 'Devices & POS',
              tenantModule: 'pos',
              view: ['settings.printers.view'],
              manage: ['settings.printers.edit', 'settings.printers.test'],
            }),
            buildPage({
              id: 'settings.devices.cash-drawer',
              name: 'Cash Drawer',
              path: '/settings/devices/cash-drawer',
              moduleKey: 'settings',
              parentGroup: 'Devices & POS',
              tenantModule: 'pos',
              view: ['settings.cash_drawer.view'],
              manage: ['settings.cash_drawer.edit', 'settings.cash_drawer.test'],
            }),
            buildPage({
              id: 'settings.devices.customer-display',
              name: 'Customer Display',
              path: '/settings/devices/customer-display',
              moduleKey: 'settings',
              parentGroup: 'Devices & POS',
              tenantModule: 'pos',
              view: ['settings.customer_display.view'],
              manage: ['settings.customer_display.edit', 'settings.customer_display.test'],
            }),
            buildPage({
              id: 'settings.devices.biometric',
              name: 'Biometric Device',
              path: '/settings/devices/biometric',
              moduleKey: 'settings',
              parentGroup: 'Devices & POS',
              tenantModule: 'hr',
              view: ['settings.biometric_device.view'],
              manage: ['settings.biometric_device.edit', 'settings.biometric_device.test'],
            }),
          ],
          allPermissions: [],
        },
      ],
    },
  ];
}

const rawSections = buildRawSidebarSections();

// Compute allPermissions per module
for (const section of rawSections) {
  for (const mod of section.modules) {
    const perms = new Set<string>();
    for (const page of mod.pages) {
      for (const p of page.allPermissions) {
        perms.add(p);
      }
    }
    mod.allPermissions = [...perms];
  }
}

/**
 * Returns filtered sidebar hierarchy respecting tenant's Super Admin enabled modules.
 */
export function getSidebarCatalog(enabledModules: readonly TenantModule[]): SidebarCatalogSection[] {
  return rawSections
    .map((section) => ({
      title: section.title,
      modules: section.modules
        .map((mod) => {
          // If module requires a tenant module that is not enabled, filter it out
          if (mod.tenantModule && !enabledModules.includes(mod.tenantModule)) {
            return null;
          }
          // Filter pages within module based on page.tenantModule
          const filteredPages = mod.pages
            .filter((page) => {
              if (page.tenantModule && !enabledModules.includes(page.tenantModule)) {
                return false;
              }
              // Check if any of the page's permissions are enabled
              return page.allPermissions.some((p) => isPermissionEnabled(p, enabledModules));
            })
            .map((page) => {
              const activePerms = (perms: string[]) => perms.filter((p) => isPermissionEnabled(p, enabledModules));
              const viewPermissions = activePerms(page.viewPermissions);
              const managePermissions = activePerms(page.managePermissions);
              const fullPermissions = activePerms(page.fullPermissions);
              const allPermissions = activePerms(page.allPermissions);
              const actions = page.actions.filter((a) => isPermissionEnabled(a.permission, enabledModules));

              const supportedLevels: Array<'no_access' | 'view_only' | 'manage' | 'full_access'> = ['no_access'];
              if (viewPermissions.length > 0) supportedLevels.push('view_only');
              if (managePermissions.length > viewPermissions.length) supportedLevels.push('manage');
              if (fullPermissions.length > managePermissions.length || (fullPermissions.length > viewPermissions.length && !supportedLevels.includes('manage'))) {
                supportedLevels.push('full_access');
              }

              return {
                ...page,
                viewPermissions,
                managePermissions,
                fullPermissions,
                allPermissions,
                actions,
                supportedLevels,
              };
            });

          if (filteredPages.length === 0) return null;

          return {
            ...mod,
            pages: filteredPages,
            allPermissions: [...new Set(filteredPages.flatMap((p) => p.allPermissions))],
          };
        })
        .filter((mod): mod is SidebarModuleDefinition => mod !== null),
    }))
    .filter((section) => section.modules.length > 0);
}

/**
 * Detect the current permission level of a page based on the selected permissions.
 */
export function detectPageLevel(
  page: SidebarPageDefinition,
  selectedSet: Set<string>,
): PageAccessLevel {
  const grantedFromPage = page.allPermissions.filter((p) => selectedSet.has(p));
  if (grantedFromPage.length === 0) {
    return 'no_access';
  }

  // Check full_access
  if (page.fullPermissions.length > 0 && page.fullPermissions.every((p) => selectedSet.has(p))) {
    return 'full_access';
  }

  // Check manage
  if (
    page.supportedLevels.includes('manage') &&
    page.managePermissions.length > 0 &&
    page.managePermissions.every((p) => selectedSet.has(p)) &&
    page.actions.filter((a) => a.category === 'sensitive').every((a) => !selectedSet.has(a.permission))
  ) {
    return 'manage';
  }

  // Check view_only
  if (
    page.viewPermissions.length > 0 &&
    page.viewPermissions.every((p) => selectedSet.has(p)) &&
    page.actions.filter((a) => a.category !== 'view').every((a) => !selectedSet.has(a.permission))
  ) {
    return 'view_only';
  }

  return 'custom';
}

/**
 * Apply a selected level to a page, updating the permission array.
 */
export function applyPageLevel(
  page: SidebarPageDefinition,
  targetLevel: PageAccessLevel,
  currentSelected: string[],
): string[] {
  const currentSet = new Set(currentSelected);

  // First remove all permissions currently associated with this page
  for (const perm of page.allPermissions) {
    currentSet.delete(perm);
  }

  if (targetLevel === 'no_access') {
    return [...currentSet];
  }

  let toAdd: string[] = [];
  if (targetLevel === 'view_only') {
    toAdd = page.viewPermissions;
  } else if (targetLevel === 'manage') {
    toAdd = page.managePermissions;
  } else if (targetLevel === 'full_access') {
    toAdd = page.fullPermissions;
  }

  for (const perm of toAdd) {
    currentSet.add(perm);
  }

  return [...currentSet];
}

/**
 * Bulk apply a level across all pages in a module.
 */
export function applyModuleLevel(
  mod: SidebarModuleDefinition,
  targetLevel: 'full_access' | 'view_only' | 'no_access',
  currentSelected: string[],
): string[] {
  let updated = currentSelected;
  for (const page of mod.pages) {
    if (targetLevel === 'no_access') {
      updated = applyPageLevel(page, 'no_access', updated);
    } else if (targetLevel === 'view_only') {
      updated = applyPageLevel(page, page.supportedLevels.includes('view_only') ? 'view_only' : 'no_access', updated);
    } else if (targetLevel === 'full_access') {
      const bestLevel = page.supportedLevels.includes('full_access')
        ? 'full_access'
        : page.supportedLevels.includes('manage')
          ? 'manage'
          : page.supportedLevels.includes('view_only')
            ? 'view_only'
            : 'no_access';
      updated = applyPageLevel(page, bestLevel, updated);
    }
  }
  return updated;
}
