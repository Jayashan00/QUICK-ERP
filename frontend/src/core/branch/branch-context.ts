import { createContext, useContext } from 'react';
import type { Branch } from '@/core/branch/types/branch';

export interface BranchContextValue {
  currentBranch: Branch | null;
  branchId: string | null;
  branches: Branch[];
  isLoading: boolean;
  switchBranch: (branchId: string) => boolean;
}

export const BranchContext = createContext<BranchContextValue | undefined>(undefined);

export function useBranch(): BranchContextValue {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used within a BranchProvider');
  return context;
}
