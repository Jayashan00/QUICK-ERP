import type { Employee } from '@/features/hr/types/employee';

export const mockEmployees: Employee[] = [
  {
    id: 'emp-001',
    tenantId: 'tenant-001',
    branchId: 'branch-001',
    employeeCode: 'EMP-0001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@acme.test',
    phone: '+1-555-3001',
    departmentId: 'dept-001',
    departmentName: 'Engineering',
    designationId: 'des-005',
    designationName: 'Senior Engineer',
    employmentType: 'full_time',
    status: 'active',
    dateOfJoining: '2023-01-15',
    salary: 8500,
    currency: 'USD',
    createdAt: '2023-01-15T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
  { id: 'emp-002', tenantId: 'tenant-001', branchId: 'branch-001', employeeCode: 'EMP-0002', firstName: 'Maria', lastName: 'Fernandez', email: 'maria.fernandez@acme.test', phone: '+1-555-3002', departmentId: 'dept-002', departmentName: 'Sales & Business Development', designationId: 'des-002', designationName: 'Sales Manager', employmentType: 'full_time', status: 'active', dateOfJoining: '2022-08-01', salary: 7200, currency: 'USD', createdAt: '2022-08-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
  { id: 'emp-003', tenantId: 'tenant-001', branchId: 'branch-002', employeeCode: 'EMP-0003', firstName: 'Nimal', lastName: 'Perera', email: 'nimal.perera@acme.test', phone: '+94-77-555-3010', departmentId: 'dept-002', departmentName: 'Sales & Business Development', designationId: 'des-003', designationName: 'Sales Executive', employmentType: 'full_time', status: 'active', dateOfJoining: '2024-02-12', salary: 4100, currency: 'USD', createdAt: '2024-02-12T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
  { id: 'emp-004', tenantId: 'tenant-001', branchId: 'branch-001', employeeCode: 'EMP-0004', firstName: 'Priya', lastName: 'Shah', email: 'priya.shah@acme.test', phone: '+1-555-3004', departmentId: 'dept-004', departmentName: 'Finance & Accounting', designationId: 'des-004', designationName: 'Senior Accountant', employmentType: 'part_time', status: 'on_leave', dateOfJoining: '2021-11-04', salary: 5200, currency: 'USD', createdAt: '2021-11-04T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
];
