import type { Customer } from '@/features/customers/types/customer';
import type { PaginatedResult } from '@/shared/types/common';
export type { PaginatedResult } from '@/shared/types/common';
import { mockCustomers } from '@/features/customers/mocks/customers';
import { belongsToScope, type TenantBranchScope } from '@/core/tenant/dataScope';
import { registerList } from '@/core/persistence/stateRegistry';
import { leadService } from '@/features/crm/leads/services/leadService';
import { tenantSettingsService } from '@/features/settings/finance/services/tenantSettingsService';

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
  'id' | 'code' | 'createdAt' | 'updatedAt' | 'tenantId' | 'branchId'
>;
export type UpdateCustomerInput = Partial<Omit<
  Customer,
  'id' | 'code' | 'createdAt' | 'updatedAt' | 'tenantId' | 'branchId'
>>;

const normalizeEmail = (email: string | undefined) => email?.trim().toLowerCase() ?? '';
const normalizePhone = (phone: string | undefined) => phone?.replace(/\D/g, '') ?? '';

function generateCustomerCode(tenantId: string) {
  const highestSequence = customersStore.reduce((highest, customer) => {
    if (customer.tenantId !== tenantId) return highest;
    const match = /^CUST-(\d+)$/.exec(customer.code);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `CUST-${String(highestSequence + 1).padStart(4, '0')}`;
}

function assertUniqueContact(
  tenantId: string,
  customer: Pick<Customer, 'email' | 'phone'>,
  excludedCustomerId?: string,
) {
  const email = normalizeEmail(customer.email);
  const phone = normalizePhone(customer.phone);
  const tenantCustomers = customersStore.filter(
    (item) => item.tenantId === tenantId && item.id !== excludedCustomerId,
  );

  if (email && tenantCustomers.some((item) => normalizeEmail(item.email) === email)) {
    throw new Error('A customer with this email address already exists.');
  }
  if (phone && tenantCustomers.some((item) => normalizePhone(item.phone) === phone)) {
    throw new Error('A customer with this phone number already exists.');
  }
}

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
    assertUniqueContact(scope.tenantId, data);
    const localization = await tenantSettingsService.getLocalization(scope.tenantId);
    const currency = (data.currency || localization.baseCurrency).trim().toUpperCase();
    if (!localization.supportedCurrencies.includes(currency)) {
      throw new Error(`${currency || 'Selected currency'} is not supported by this company`);
    }
    const paymentTerm = tenantSettingsService.requirePaymentTerm(scope.tenantId, data.paymentTermCode ?? data.paymentTermsDays);
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...data,
      code: generateCustomerCode(scope.tenantId),
      currency,
      creditLimit: data.creditLimit === undefined ? undefined : Math.round(data.creditLimit),
      paymentTermCode: paymentTerm.code,
      paymentTermsDays: paymentTerm.dueDays,
      id: crypto.randomUUID(),
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      createdAt: now,
      updatedAt: now,
    };
    if (newCustomer.status === 'lead') await leadService.syncFromCustomer(newCustomer);
    customersStore = [newCustomer, ...customersStore];
    return newCustomer;
  },

  async updateCustomer(
    scope: TenantBranchScope,
    id: string,
    data: UpdateCustomerInput,
  ): Promise<Customer> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const index = customersStore.findIndex(
      (customer) => customer.id === id && belongsToScope(customer, scope),
    );
    if (index === -1) throw new Error('Customer not found');
    const localization = await tenantSettingsService.getLocalization(scope.tenantId);
    const currency = (data.currency || customersStore[index].currency || localization.baseCurrency).trim().toUpperCase();
    if (!localization.supportedCurrencies.includes(currency)) {
      throw new Error(`${currency || 'Selected currency'} is not supported by this company`);
    }
    const paymentTerm = tenantSettingsService.requirePaymentTerm(scope.tenantId, data.paymentTermCode ?? data.paymentTermsDays ?? customersStore[index].paymentTermCode ?? customersStore[index].paymentTermsDays);

    const updated: Customer = {
      ...customersStore[index],
      ...data,
      id: customersStore[index].id,
      code: customersStore[index].code,
      currency,
      ...(data.creditLimit === undefined ? {} : { creditLimit: Math.round(data.creditLimit) }),
      paymentTermCode: paymentTerm.code,
      paymentTermsDays: paymentTerm.dueDays,
      tenantId: customersStore[index].tenantId,
      branchId: customersStore[index].branchId,
      createdAt: customersStore[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    assertUniqueContact(scope.tenantId, updated, id);
    if (updated.status === 'lead') await leadService.syncFromCustomer(updated);
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
