import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/core/permissions/components';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { lazyPage } from './lazyPage';

const SupplierListPage = lazyPage(() =>
  import('@/features/suppliers').then(({ SupplierListPage }) => ({
    default: SupplierListPage,
  })),
);

const SupplierCreatePage = lazyPage(() =>
  import('@/features/suppliers').then(({ SupplierCreatePage }) => ({
    default: SupplierCreatePage,
  })),
);

const SupplierDetailPage = lazyPage(() =>
  import('@/features/suppliers').then(({ SupplierDetailPage }) => ({
    default: SupplierDetailPage,
  })),
);

const SupplierEditPage = lazyPage(() =>
  import('@/features/suppliers').then(({ SupplierEditPage }) => ({
    default: SupplierEditPage,
  })),
);

const purchasePage = <T extends keyof typeof import('@/features/purchases')>(name: T) =>
  lazyPage(() => import('@/features/purchases').then((module) => ({ default: module[name] as React.ComponentType })));

const PurchasingDashboardPage = purchasePage('PurchasingDashboardPage');
const PurchaseRequestsPage = purchasePage('PurchaseRequestsPage');
const RfqsPage = purchasePage('RfqsPage');
const SupplierQuotationsPage = purchasePage('SupplierQuotationsPage');
const QuotationComparisonPage = purchasePage('QuotationComparisonPage');
const PurchaseOrdersPage = purchasePage('PurchaseOrdersPage');
const GoodsReceiptsPage = purchasePage('GoodsReceiptsPage');
const PurchaseInvoicesPage = purchasePage('PurchaseInvoicesPage');
const PurchaseMatchingPage = purchasePage('PurchaseMatchingPage');
const PurchaseReturnsPage = purchasePage('PurchaseReturnsPage');
const SupplierPaymentsPage = purchasePage('SupplierPaymentsHandoffPage');

const protectedPurchasePage = (permission: string, Page: React.ComponentType) => (
  <RequirePermission permission={permission}><Page /></RequirePermission>
);

export const purchasesRoutes: RouteObject[] = [
  {
    path: 'suppliers',
    element: (
      <RequirePermission permission={PERMISSIONS.SUPPLIERS.SUPPLIERS_VIEW}>
        <SupplierListPage />
      </RequirePermission>
    ),
  },
  {
    path: 'suppliers/new',
    element: (
      <RequirePermission permission={PERMISSIONS.SUPPLIERS.SUPPLIERS_CREATE}>
        <SupplierCreatePage />
      </RequirePermission>
    ),
  },
  {
    path: 'suppliers/:id',
    element: (
      <RequirePermission permission={PERMISSIONS.SUPPLIERS.SUPPLIERS_VIEW}>
        <SupplierDetailPage />
      </RequirePermission>
    ),
  },
  {
    path: 'suppliers/:id/edit',
    element: (
      <RequirePermission permission={PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT}>
        <SupplierEditPage />
      </RequirePermission>
    ),
  },
  // Purchases
  {
    path: 'purchases',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.VIEW, PurchasingDashboardPage),
  },
  {
    path: 'purchases/requests',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.VIEW, PurchaseRequestsPage),
  },
  {
    path: 'purchases/rfqs',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.RFQ_VIEW, RfqsPage),
  },
  {
    path: 'purchases/quotations',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.RFQ_VIEW, SupplierQuotationsPage),
  },
  {
    path: 'purchases/comparison',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.RFQ_VIEW, QuotationComparisonPage),
  },
  {
    path: 'purchases/orders',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.VIEW, PurchaseOrdersPage),
  },
  {
    path: 'purchases/bills',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_VIEW, PurchaseInvoicesPage),
  },
  {
    path: 'purchases/invoices',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_VIEW, PurchaseInvoicesPage),
  },
  {
    path: 'purchases/payments',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_VIEW, SupplierPaymentsPage),
  },
  {
    path: 'purchases/receipts',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.GRN_VIEW, GoodsReceiptsPage),
  },
  {
    path: 'purchases/matching',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_VIEW, PurchaseMatchingPage),
  },
  {
    path: 'purchases/returns',
    element: protectedPurchasePage(PERMISSIONS.PURCHASE_WORKFLOW.CREATE, PurchaseReturnsPage),
  },
];
