import { hasPermission } from '@/core/permissions';
import type { GlobalSearchEntry, GlobalSearchIndex, GlobalSearchResult, GlobalSearchScope, SearchModule } from '../types/globalSearch';
import { isPermissionEnabled, tenantEntitlementService } from '@/core/tenant/tenantEntitlements';

export const normalizeSearch = (value: string) => value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const recordRoute = (path: string, id: string, reference?: string) => `${path}?record=${encodeURIComponent(id)}${reference ? `&reference=${encodeURIComponent(reference)}` : ''}`;

export function filterSearchIndex(index: GlobalSearchIndex, query: string, limit = 40): GlobalSearchResult[] {
  const normalized = normalizeSearch(query);
  if (normalized.length < 2) return [];
  const tokens = normalized.split(/\s+/);
  const score = (entry: GlobalSearchEntry) => normalizeSearch(entry.reference ?? '') === normalized || normalizeSearch(entry.title) === normalized ? 0 : normalizeSearch(entry.title).startsWith(normalized) || normalizeSearch(entry.reference ?? '').startsWith(normalized) ? 1 : 2;
  const matches = index.entries.filter(entry => tokens.every(token => entry.searchText.includes(token))).sort((a, b) => score(a) - score(b) || a.module.localeCompare(b.module) || a.title.localeCompare(b.title));
  const perType = new Map<string, number>();
  return matches.filter(entry => { const key = `${entry.module}/${entry.type}`; const count = perType.get(key) ?? 0; perType.set(key, count + 1); return count < 5; }).slice(0, limit).map(entry => ({ id: entry.id, module: entry.module, type: entry.type, title: entry.title, subtitle: entry.subtitle, reference: entry.reference, route: entry.route, branchId: entry.branchId, permission: entry.permission, requiredPermissions: entry.requiredPermissions }));
}

export const globalSearchService = {
  async getIndex(scope: GlobalSearchScope, signal?: AbortSignal): Promise<GlobalSearchIndex> {
    if (!scope.tenantId || scope.tenantId === 'platform' || !scope.branchId || !scope.permittedBranchIds.includes(scope.branchId) || !scope.user.id) throw new Error('A signed-in tenant and permitted branch are required for search.');
    const enabledModules = tenantEntitlementService.get(scope.tenantId)?.enabledModules ?? [];
    const effectivePermissions = scope.permissions.filter((permission) => isPermissionEnabled(permission, enabledModules));
    const can = (permission: string) => hasPermission(effectivePermissions, permission);
    const branchScope = { tenantId: scope.tenantId, branchId: scope.branchId, permittedBranchIds: [scope.branchId] };
    const params = { branchId: scope.branchId, permittedBranchIds: [scope.branchId], page: 1, pageSize: Number.MAX_SAFE_INTEGER };
    type MatchRecord = { id: string; tenantId: string; branchId?: string };
    type Display = { title: string; subtitle?: string; reference?: string; route: string; fields?: (string | undefined)[] };
    const collect = <T extends MatchRecord>(module: SearchModule, type: string, permissions: string[], rows: T[], display: (row: T) => Display): GlobalSearchEntry[] => {
      if (!permissions.every(can)) return [];
      return rows.filter(row => row.tenantId === scope.tenantId && (!row.branchId || row.branchId === scope.branchId)).map(row => {
        const item = display(row);
        return { id: row.id, module, type, title: item.title, subtitle: item.subtitle, reference: item.reference, route: item.route, branchId: row.branchId, permission: permissions[0], requiredPermissions: permissions, searchText: normalizeSearch([item.title, item.subtitle, item.reference, ...(item.fields ?? [])].filter(Boolean).join(' ')) };
      });
    };
    const jobs: { module: SearchModule; load: () => Promise<GlobalSearchEntry[]> }[] = [];
    if (can('customers.view')) jobs.push({ module: 'Customers', load: async () => {
      const { customerService } = await import('@/features/customers/services/customerService');
      const rows = (await customerService.getCustomers(branchScope, { pageSize: Number.MAX_SAFE_INTEGER })).data;
      return collect('Customers', 'Customer', ['customers.view'], rows, row => ({ title: row.name, subtitle: `${row.code} / ${row.email}`, reference: row.code, fields: [row.email, row.phone, row.phone.replace(/\D/g, '')], route: `${recordRoute('/customers', row.id)}&search=${encodeURIComponent(row.code)}` }));
    }});
    if (can('leads.view')) jobs.push({ module: 'CRM', load: async () => {
      const { leadService } = await import('@/features/crm/leads/services/leadService');
      return collect('CRM', 'Lead', ['leads.view'], (await leadService.getAll(branchScope, { pageSize: Number.MAX_SAFE_INTEGER })).data, row => ({ title: `${row.firstName} ${row.lastName}`, subtitle: `${row.code} / ${row.company ?? row.email}`, reference: row.code, fields: [row.company, row.email, row.phone, row.phone.replace(/\D/g, '')], route: `${recordRoute('/crm/leads', row.id)}&search=${encodeURIComponent(row.code)}` }));
    }});
    if (can('crm.opportunities.view')) jobs.push({ module: 'CRM', load: async () => {
      const { opportunityService } = await import('@/features/crm/opportunities/services/opportunityService');
      return collect('CRM', 'Opportunity', ['crm.opportunities.view'], (await opportunityService.getOpportunities(branchScope, { pageSize: Number.MAX_SAFE_INTEGER })).data, row => ({ title: row.name, subtitle: `${row.code} / ${row.customerName ?? row.stage}`, reference: row.code, route: `/crm/opportunities/${encodeURIComponent(row.id)}` }));
    }});
    if (can('suppliers.suppliers.view')) jobs.push({ module: 'Suppliers', load: async () => {
      const { supplierService } = await import('@/features/suppliers/services/supplierService');
      return collect('Suppliers', 'Supplier', ['suppliers.suppliers.view'], (await supplierService.getSuppliers(scope.tenantId, { pageSize: Number.MAX_SAFE_INTEGER })).data, row => ({ title: row.name, subtitle: row.code, reference: row.code, route: `/suppliers/${encodeURIComponent(row.id)}` }));
    }});
    if (can('products.view')) jobs.push({ module: 'Products', load: async () => {
      const { productService } = await import('@/features/products/services/productService');
      const first = await productService.getAll(branchScope, { pageSize: 100 });
      const rest = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(first.total / 100) - 1) }, (_, index) => productService.getAll(branchScope, { page: index + 2, pageSize: 100 })));
      return collect('Products', 'Product / Service', ['products.view'], [...first.data, ...rest.flatMap(page => page.data)], row => ({ title: row.name, subtitle: `${row.sku}${row.internalCode ? ` / ${row.internalCode}` : ''}`, reference: row.sku, fields: [row.barcode, row.internalCode, ...(row.alternateBarcodes ?? [])], route: `/products/${encodeURIComponent(row.id)}` }));
    }});
    if (can('sales.view')) jobs.push({ module: 'Sales', load: async () => {
      const { salesService } = await import('@/features/sales/services/salesService');
      const [quotes, orders, deliveries, invoices] = await Promise.all([salesService.listQuotations(branchScope, params), salesService.listOrders(branchScope, params), salesService.listDeliveries(branchScope, params), salesService.listInvoices(branchScope, params)]);
      const display = (path: string) => (row: { id: string; referenceNumber: string; customerId: string; customerName?: string }) => ({ title: row.referenceNumber, subtitle: row.customerName ?? row.customerId, reference: row.referenceNumber, route: recordRoute(path, row.id, row.referenceNumber) });
      return [...collect('Sales', 'Quotation', ['sales.view'], quotes.data, display('/sales/quotations')), ...collect('Sales', 'Sales Order', ['sales.view'], orders.data, display('/sales/orders')), ...collect('Sales', 'Delivery', ['sales.view'], deliveries.data, display('/sales/deliveries')), ...collect('Sales', 'Invoice', ['sales.view'], invoices.data, display('/sales/invoices'))];
    }});
    if (['purchase.view', 'grn.view', 'purchaseInvoice.view'].some(can)) jobs.push({ module: 'Purchases', load: async () => {
      const { purchasingService } = await import('@/features/purchases/services/purchasingService');
      const [requests, orders, grns, invoices] = await Promise.all([can('purchase.view') ? purchasingService.listRequests(branchScope, params) : null, can('purchase.view') ? purchasingService.listOrders(branchScope, params) : null, can('grn.view') ? purchasingService.listGrns(branchScope, params) : null, can('purchaseInvoice.view') ? purchasingService.listInvoices(branchScope, params) : null]);
      const display = (path: string) => (row: { id: string; referenceNumber: string; supplierId?: string }) => ({ title: row.referenceNumber, subtitle: row.supplierId, reference: row.referenceNumber, route: recordRoute(path, row.id, row.referenceNumber) });
      return [...collect('Purchases', 'Purchase Request', ['purchase.view'], requests?.data ?? [], display('/purchases/requests')), ...collect('Purchases', 'Purchase Order', ['purchase.view'], orders?.data ?? [], display('/purchases/orders')), ...collect('Purchases', 'GRN', ['grn.view'], grns?.data ?? [], display('/purchases/receipts')), ...collect('Purchases', 'Supplier Invoice', ['purchaseInvoice.view'], invoices?.data ?? [], display('/purchases/invoices'))];
    }});
    if (can('inventory.view')) {
      if (can('inventory.stock.view')) jobs.push({ module: 'Inventory', load: async () => {
        const { inventoryService } = await import('@/features/inventory/services/inventoryService');
        return collect('Inventory', 'Stock', ['inventory.view', 'inventory.stock.view'], await inventoryService.listStockBalances(branchScope, params), row => ({ title: row.productName, subtitle: `${row.sku} / ${row.warehouseName} / ${row.locationName}`, reference: row.sku, route: `/inventory/stock/${encodeURIComponent(row.productId)}${row.variantId ? `?variantId=${encodeURIComponent(row.variantId)}` : ''}` }));
      }});
      if (can('inventory.warehouses.view')) jobs.push({ module: 'Inventory', load: async () => {
        const { warehouseService } = await import('@/features/inventory/services/warehouseService');
        return collect('Inventory', 'Warehouse', ['inventory.view', 'inventory.warehouses.view'], (await warehouseService.list(scope.tenantId, params)).data, row => ({ title: row.name, subtitle: row.code, reference: row.code, route: `/inventory/warehouses/${encodeURIComponent(row.id)}` }));
      }});
      if (can('inventory.locations.view')) jobs.push({ module: 'Inventory', load: async () => {
        const { stockLocationService } = await import('@/features/inventory/services/stockLocationService');
        return collect('Inventory', 'Location', ['inventory.view', 'inventory.locations.view'], (await stockLocationService.list(scope.tenantId, params)).data, row => ({ title: row.name, subtitle: `${row.code} / ${row.warehouseName}`, reference: row.code, route: `/inventory/locations/${encodeURIComponent(row.id)}` }));
      }});
      if (can('inventory.batches.view') || can('inventory.serial_numbers.view')) jobs.push({ module: 'Inventory', load: async () => {
        const { inventoryTrackingService } = await import('@/features/inventory/services/inventoryTrackingService');
        const [batches, serials] = await Promise.all([can('inventory.batches.view') ? inventoryTrackingService.listBatches(branchScope, params) : null, can('inventory.serial_numbers.view') ? inventoryTrackingService.listSerialNumbers(branchScope, params) : null]);
        return [...collect('Inventory', 'Batch', ['inventory.view', 'inventory.batches.view'], batches?.data ?? [], row => ({ title: row.batchNumber, subtitle: `${row.productName} / ${row.warehouseName}`, reference: row.batchNumber, fields: [row.sku], route: `/inventory/batches?search=${encodeURIComponent(row.batchNumber)}` })), ...collect('Inventory', 'Serial Number', ['inventory.view', 'inventory.serial_numbers.view'], serials?.data ?? [], row => ({ title: row.serialNumber, subtitle: `${row.productName} / ${row.warehouseName}`, reference: row.serialNumber, fields: [row.sku], route: `/inventory/serials?search=${encodeURIComponent(row.serialNumber)}` }))];
      }});
    }
    if (['finance.journals.view', 'finance.cash.view', 'finance.receivables.view', 'finance.payables.view'].some(can)) jobs.push({ module: 'Finance', load: async () => {
      const { accountingService } = await import('@/features/accounting/accountingService');
      const output: GlobalSearchEntry[] = [];
      if (can('finance.journals.view')) output.push(...collect('Finance', 'Journal', ['finance.journals.view'], accountingService.journals(branchScope, { branchId: scope.branchId }), row => ({ title: row.reference, subtitle: row.notes, reference: row.reference, route: recordRoute('/finance/journal', row.id) })));
      if (can('finance.cash.view')) output.push(...collect('Finance', 'Payment / Receipt', ['finance.cash.view'], accountingService.settlements(branchScope, { branchId: scope.branchId }), row => ({ title: row.reference, subtitle: `${row.kind} / ${row.party}`, reference: row.reference, route: recordRoute('/finance/payments', row.id) })));
      for (const kind of ['receivables', 'payables'] as const) if (can(`finance.${kind}.view`)) output.push(...collect('Finance', kind === 'receivables' ? 'Customer Invoice' : 'Supplier Balance', [`finance.${kind}.view`], accountingService[kind](branchScope, { branchId: scope.branchId }).map(row => ({ ...row, tenantId: scope.tenantId })), row => ({ title: row.reference, subtitle: row.party, reference: row.reference, route: recordRoute(`/finance/${kind}`, row.id) })));
      return output;
    }});
    if (can('hr.employees.view')) jobs.push({ module: 'HR', load: async () => {
      const { hrService } = await import('@/features/hr/hrService');
      return collect('HR', 'Employee', ['hr.employees.view'], hrService.employees(branchScope, scope.branchId), row => ({ title: `${row.firstName} ${row.lastName}`, subtitle: `${row.employeeCode} / ${row.departmentName}`, reference: row.employeeCode, route: `/hr/employees/${encodeURIComponent(row.id)}` }));
    }});
    if (can('projects.projects.view') || can('projects.tasks.view')) jobs.push({ module: 'Projects', load: async () => {
      const { projectService } = await import('@/features/projects/projectService');
      return [...collect('Projects', 'Project', ['projects.projects.view'], can('projects.projects.view') ? projectService.projects(branchScope, scope.branchId) : [], row => ({ title: row.name, subtitle: row.code, reference: row.code, route: `/projects/${encodeURIComponent(row.id)}` })), ...collect('Projects', 'Task', ['projects.tasks.view'], can('projects.tasks.view') ? projectService.tasks(branchScope, scope.branchId) : [], row => ({ title: row.title, subtitle: row.status.replace(/_/g, ' '), route: recordRoute('/projects/tasks', row.id) }))];
    }});
    if (can('documents.view')) jobs.push({ module: 'Documents', load: async () => {
      const { documentService } = await import('@/features/documents/documentService');
      return collect('Documents', 'Document', ['documents.view'], documentService.list(branchScope, scope.permissions, { branchId: scope.branchId, pageSize: Number.MAX_SAFE_INTEGER }).data, row => ({ title: row.title, subtitle: `${row.name} / ${row.entityReference}`, reference: row.entityReference, fields: [row.name], route: recordRoute('/documents', row.id) }));
    }});
    if (can('support.view')) jobs.push({ module: 'Support', load: async () => {
      const { supportTicketService } = await import('@/features/support/services/supportTicketService');
      const rows = (await supportTicketService.list({ tenantId: scope.tenantId, activeBranchId: scope.branchId, permittedBranchIds: [scope.branchId], permissions: scope.permissions, user: scope.user }, { pageSize: Number.MAX_SAFE_INTEGER })).data;
      return collect('Support', 'Ticket', ['support.view'], rows, row => ({ title: row.ticketNumber, subtitle: row.subject, reference: row.ticketNumber, fields: [row.subject], route: `/support/tickets/${encodeURIComponent(row.id)}` }));
    }});
    const settled = await Promise.allSettled(jobs.map(job => job.load()));
    if (signal?.aborted) throw new DOMException('Search was cancelled.', 'AbortError');
    const entries = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const unique = new Map(entries.map(entry => [`${entry.module}/${entry.type}/${entry.id}`, entry]));
    return { entries: [...unique.values()], unavailableModules: [...new Set(settled.flatMap((result, index) => result.status === 'rejected' ? [jobs[index].module] : []))] };
  },
  async search(request: GlobalSearchScope & { query: string }) {
    if (normalizeSearch(request.query).length < 2) return { results: [], unavailableModules: [] };
    const index = await this.getIndex(request);
    return { results: filterSearchIndex(index, request.query), unavailableModules: index.unavailableModules };
  },
};
