export type EntityId = string;

export interface BaseEntity {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
}

export type SortDirection = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  /** Optional because existing service DTOs expose total/page/pageSize. */
  totalPages?: number;
}

export interface SortParams {
  field: string;
  direction: SortDirection;
}

export interface FilterOption {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: string | number | boolean | string[];
}

export interface SearchParams {
  query?: string;
  filters?: FilterOption[];
  sort?: SortParams;
  pagination?: PaginationParams;
}

export type StatusType =
  | 'draft'
  | 'pending'
  | 'active'
  | 'inactive'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'delivered'
  | 'in_progress'
  | 'on_hold';

export interface StatusBadgeConfig {
  label: string;
  variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}
