import type { Customer } from '@/features/customers/types/customer';
import type { PaginatedResult } from '@/shared/types/common';
export type { PaginatedResult } from '@/shared/types/common';
import { mockCustomers } from '@/features/customers/mocks/customers';
import { belongsToScope, type TenantBranchScope } from '@/core/tenant/dataScope';
import { registerList } from '@/core/persistence/stateRegistry';

let customersStore: Customer[] = [...mockCustomers];

export interface GetCustomersParams {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export type CreateCustomerInput = Omit<
  Customer,
  'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'branchId'
>;

export const customerService = {
  getCachedCustomerById(scope: TenantBranchScope, id: string): Customer | null {
    return customersStore.find(customer => customer.id === id && belongsToScope(customer, scope)) ?? null;
  },
  async getCustomers(
    scope: TenantBranchScope,
    params: GetCustomersParams = {},
  ): Promise<PaginatedResult<Customer>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let filtered = customersStore.filter((customer) => belongsToScope(customer, scope));

    if (params.search) {
      const query = params.search.toLowerCase();
      filtered = filtered.filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.code.toLowerCase().includes(query) ||
          customer.email.toLowerCase().includes(query) ||
          customer.phone.includes(query),
      );
    }

    if (params.status && params.status !== 'all') {
      filtered = filtered.filter((customer) => customer.status === params.status);
    }
    if (params.type && params.type !== 'all') {
      filtered = filtered.filter((customer) => customer.type === params.type);
    }

    const total = filtered.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;

    return { data: filtered.slice(startIndex, startIndex + pageSize), total, page, pageSize };
  },

  async getCustomerById(scope: TenantBranchScope, id: string): Promise<Customer | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return customersStore.find(
      (customer) => customer.id === id && belongsToScope(customer, scope),
    ) ?? null;
  },

  async createCustomer(scope: TenantBranchScope, data: CreateCustomerInput): Promise<Customer> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...data,
      id: crypto.randomUUID(),
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      createdAt: now,
      updatedAt: now,
    };
    customersStore = [newCustomer, ...customersStore];
    return newCustomer;
  },

  async updateCustomer(
    scope: TenantBranchScope,
    id: string,
    data: Partial<Customer>,
  ): Promise<Customer> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const index = customersStore.findIndex(
      (customer) => customer.id === id && belongsToScope(customer, scope),
    );
    if (index === -1) throw new Error('Customer not found');

    const updated: Customer = {
      ...customersStore[index],
      ...data,
      tenantId: customersStore[index].tenantId,
      branchId: customersStore[index].branchId,
      updatedAt: new Date().toISOString(),
    };
    customersStore[index] = updated;
    return updated;
  },

  async deleteCustomer(scope: TenantBranchScope, id: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const exists = customersStore.some(
      (customer) => customer.id === id && belongsToScope(customer, scope),
    );
    if (!exists) throw new Error('Customer not found');

    customersStore = customersStore.filter((customer) => customer.id !== id);
    return true;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('customers.records', () => customersStore, (rows) => { customersStore = rows; });
