import { Navigate, type RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/core/permissions/components';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { lazyPage } from './lazyPage';

const accountingPage = (section: string) => lazyPage(() => import('@/features/accounting/AccountingPage').then(({ AccountingPage }) => ({ default: () => <AccountingPage section={section} /> })));
const AccountingImportPage = lazyPage(() => import('@/features/accounting/AccountingImportPage').then(({ AccountingImportPage }) => ({ default: AccountingImportPage })));

const pages: { path: string; section: string; permission: string }[] = [
  { path: 'dashboard', section: 'dashboard', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'chart-of-accounts', section: 'accounts', permission: PERMISSIONS.FINANCE.CHART_OF_ACCOUNTS_VIEW },
  { path: 'opening-balances', section: 'opening', permission: PERMISSIONS.FINANCE.CHART_OF_ACCOUNTS_VIEW },
  { path: 'journal', section: 'journals', permission: PERMISSIONS.FINANCE.JOURNALS_VIEW },
  { path: 'ledger', section: 'ledger', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'trial-balance', section: 'trial', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'receivables', section: 'receivables', permission: PERMISSIONS.FINANCE.RECEIVABLES_VIEW },
  { path: 'customer-statements', section: 'statements', permission: PERMISSIONS.FINANCE.RECEIVABLES_VIEW },
  { path: 'payables', section: 'payables', permission: PERMISSIONS.FINANCE.PAYABLES_VIEW },
  { path: 'grn-matching', section: 'matching', permission: PERMISSIONS.FINANCE.PAYABLES_VIEW },
  { path: 'payments', section: 'settlements', permission: PERMISSIONS.FINANCE.CASH_VIEW },
  { path: 'expenses', section: 'expenses', permission: PERMISSIONS.FINANCE.EXPENSES_VIEW },
  { path: 'petty-cash', section: 'petty', permission: PERMISSIONS.FINANCE.CASH_VIEW },
  { path: 'banks', section: 'bank', permission: PERMISSIONS.FINANCE.BANK_VIEW },
  { path: 'profit-loss', section: 'pnl', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'balance-sheet', section: 'balance', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'cash-flow', section: 'cashflow', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'tax', section: 'tax', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'budgets', section: 'budgets', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'cost-centers', section: 'cost-centers', permission: PERMISSIONS.FINANCE.CHART_OF_ACCOUNTS_VIEW },
  { path: 'fixed-assets', section: 'fixed-assets', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'credit-memos', section: 'credit-memos', permission: PERMISSIONS.FINANCE.RECEIVABLES_VIEW },
  { path: 'recurring', section: 'recurring', permission: PERMISSIONS.FINANCE.JOURNALS_VIEW },
  { path: 'fx', section: 'fx', permission: PERMISSIONS.FINANCE.JOURNALS_VIEW },
  { path: 'documents', section: 'documents', permission: PERMISSIONS.FINANCE.JOURNALS_VIEW },
  { path: 'audit', section: 'audit', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'handoffs', section: 'handoffs', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
  { path: 'posting-defaults', section: 'posting-defaults', permission: PERMISSIONS.FINANCE.REPORTS_VIEW },
];

export const accountingRoutes: RouteObject[] = [
  { path: 'finance', element: <Navigate to="/finance/dashboard" replace /> },
  ...pages.map(({ path, section, permission }) => { const Page = accountingPage(section); return { path: `finance/${path}`, element: <RequirePermission permission={permission}><Page /></RequirePermission> }; }),
  { path: 'finance/import', element: <RequirePermission permission={PERMISSIONS.FINANCE.JOURNALS_CREATE}><AccountingImportPage /></RequirePermission> },
];
