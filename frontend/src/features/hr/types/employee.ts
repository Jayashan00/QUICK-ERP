import { BaseEntity, EntityId } from '@/shared/types/common';

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type EmploymentStatus = 'active' | 'on_leave' | 'terminated' | 'resigned';

export interface Employee extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: EntityId;
  departmentName: string;
  designationId: EntityId;
  designationName: string;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  dateOfJoining: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  reportingManagerId?: EntityId;
  exitDate?: string;
  notes?: string;
  salary: number;
  currency: string;
}
