import { registerList } from '@/core/persistence/stateRegistry';

export type Settlement = {
  id: string;
  tenantId: string;
  branchId: string;
  date: string;
  reference: string;
  kind: 'receipt' | 'payment';
  documentId: string;
  party: string;
  amount: number;
  documentAmount?: number;
  documentCurrency?: string;
  accountId: string;
};

let settlements: Settlement[] = [
  {
    id: 'receipt-legacy-001',
    tenantId: 'tenant-001',
    branchId: 'branch-001',
    date: '2026-09-27',
    reference: 'PAY-2026-0061',
    kind: 'receipt',
    documentId: 'sales-invoice-001',
    party: 'cust-001',
    amount: 200,
    accountId: 'acct-1200',
  },
];

export const settlementStore = {
  records: (): Settlement[] => settlements,
  insert: (item: Settlement) => {
    settlements.unshift(item);
  },
};

registerList('accounting.settlements', () => settlements, (rows) => { settlements = rows; });
