import type { Company } from '@/features/settings/company/types/company';

export const mockCompany: Company = {
  id: 'comp-001',
  tenantId: 'tenant-001',
  name: 'Acme Corporation',
  legalName: 'Acme Global Technologies Inc.',
  registrationNumber: 'REG-2024-884920',
  taxNumber: 'TAX-US-99384721',
  email: 'contact@acme.test',
  phone: '+1 (555) 010-9281',
  website: 'https://acme.test',
  currency: 'USD',
  fiscalYearStartMonth: 1, // January
  logoUrl: '',
  address: {
    street: '123 Main Street, Suite 400',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'United States',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
};
