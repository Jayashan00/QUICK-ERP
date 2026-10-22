import { BaseEntity, EntityId } from '@/shared/types/common';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export interface Project extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  code: string;
  name: string;
  description?: string;
  customerId?: EntityId;
  customerName?: string;
  managerId: EntityId;
  managerName: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  budget: number;
  currency: string;
  progressPercent: number;
}

export interface ProjectTask extends BaseEntity {
  projectId: EntityId;
  title: string;
  description?: string;
  assignedToId?: EntityId;
  assignedToName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
}
