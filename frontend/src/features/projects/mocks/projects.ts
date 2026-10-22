import type { Project } from '@/features/projects/types/project';

export const mockProjects: Project[] = [
  {
    id: 'proj-001',
    tenantId: 'tenant-001',
    branchId: 'branch-001',
    code: 'PRJ-001',
    name: 'Website Redesign',
    description: 'Complete redesign of the corporate website',
    customerId: 'cust-001',
    customerName: 'Global Industries Ltd.',
    managerId: 'usr-002',
    managerName: 'Sales Manager',
    status: 'active',
    startDate: '2024-06-01',
    endDate: '2024-12-31',
    budget: 50000,
    currency: 'USD',
    progressPercent: 35,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
];
