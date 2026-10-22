import type { Company } from '@/features/settings/company/types/company';
import { mockCompany } from '@/features/settings/company/mocks/company';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

const companyStore: Company[] = [{ ...mockCompany }];

export const companyService = {
  async getCompany(tenantId: string): Promise<Company> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let company = companyStore.find((c) => c.tenantId === tenantId);
    if (!company) {
      // Fallback for demo tenant if not found
      company = {
        ...mockCompany,
        tenantId,
      };
      companyStore.push(company);
    }
    return { ...company };
  },

  async updateCompany(tenantId: string, data: Partial<Company>): Promise<Company> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const index = companyStore.findIndex((c) => c.tenantId === tenantId);
    const now = new Date().toISOString();

    if (index === -1) {
      const newCompany: Company = {
        ...mockCompany,
        ...data,
        tenantId,
        updatedAt: now,
      };
      companyStore.push(newCompany);
      return { ...newCompany };
    }

    const updated: Company = {
      ...companyStore[index],
      ...data,
      tenantId,
      address: {
        ...companyStore[index].address,
        ...(data.address || {}),
      },
      updatedAt: now,
    };
    companyStore[index] = updated;
    return { ...updated };
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('settings.company', () => companyStore, (rows) => replaceArray(companyStore, rows));
