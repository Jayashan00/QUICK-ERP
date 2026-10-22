export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'print'
  | 'pay'
  | 'receive'
  | 'manage'
  | 'configure';

export interface PermissionDefinition {
  id: string;
  module: string;
  action: PermissionAction;
  name: string;
  description?: string;
}

export type PermissionCheck = string | string[] | { any?: string[]; all?: string[] };
