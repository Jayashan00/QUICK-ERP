import { userService } from '@/core/auth/userService';

export interface UserOption {
  id: string;
  name: string;
  roleName: string;
  jobTitle?: string;
  departmentId?: string;
  departmentName?: string;
  isActive: boolean;
}

export const userOptionService = {
  async getUserOptions(tenantId: string): Promise<UserOption[]> {
    return userService.getUserOptions(tenantId);
  },
};
