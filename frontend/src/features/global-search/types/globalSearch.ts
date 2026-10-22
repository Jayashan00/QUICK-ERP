export type SearchModule = 'CRM' | 'Customers' | 'Suppliers' | 'Products' | 'Sales' | 'Purchases' | 'Inventory' | 'Finance' | 'HR' | 'Projects' | 'Documents' | 'Support';
export interface GlobalSearchResult {
  id: string;
  module: SearchModule;
  type: string;
  title: string;
  subtitle?: string;
  reference?: string;
  route: string;
  branchId?: string;
  permission: string;
  requiredPermissions: string[];
}
/** A cached projection of permitted source records, never a separate business store. */
export interface GlobalSearchEntry extends GlobalSearchResult { searchText: string }
export interface GlobalSearchScope {
  tenantId: string;
  branchId: string;
  permittedBranchIds: string[];
  permissions: string[];
  user: { id: string; name: string; email: string };
}
export interface GlobalSearchIndex { entries: GlobalSearchEntry[]; unavailableModules: string[] }
