import type { ComponentType } from "react";
import type { RouteObject } from "react-router-dom";

import { RequirePermission } from "@/core/permissions/components";
import { TENANT_PERMISSIONS as PERMISSIONS } from "@/core/permissions";
import { lazyPage } from "./lazyPage";

const salesPage = <T extends keyof typeof import("@/features/sales")>(
  name: T,
) =>
  lazyPage(() =>
    import("@/features/sales").then((module) => ({
      default: module[name] as ComponentType,
    })),
  );

const SalesDashboardPage = salesPage("SalesDashboardPage");
const SalesQuotationsPage = salesPage("SalesQuotationsPage");
const SalesOrdersPage = salesPage("SalesOrdersPage");
const DeliveryNotesPage = salesPage("DeliveryNotesPage");
const SalesInvoicesPage = salesPage("SalesInvoicesPage");
const CustomerPaymentsPage = salesPage("CustomerPaymentsPage");
const SalesReturnsPage = salesPage("SalesReturnsPage");
const CreditNotesPage = salesPage("CreditNotesPage");
const RecurringInvoicesPage = salesPage("RecurringInvoicesPage");
const SalesCommissionsPage = salesPage("SalesCommissionsPage");
const FlashSalesPage = lazyPage(() => import("@/features/sales/pages/FlashSalesPage").then(module => ({ default: module.FlashSalesPage })));
const CustomerReviewsPage = lazyPage(() => import("@/features/sales/pages/CustomerReviewsPage").then(module => ({ default: module.CustomerReviewsPage })));
const AbandonedCartsPage = lazyPage(() => import("@/features/sales/pages/AbandonedCartsPage").then(module => ({ default: module.AbandonedCartsPage })));
const PosSalesOrdersPage = lazyPage(() =>
  import("@/features/sales/pages/PosSalesOrdersPage").then((module) => ({
    default: module.PosSalesOrdersPage,
  })),
);

const protect = (permission: string, Page: ComponentType) => (
  <RequirePermission permission={permission}>
    <Page />
  </RequirePermission>
);

export const salesRoutes: RouteObject[] = [
  {
    path: "sales",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, SalesDashboardPage),
  },
  {
    path: "sales/quotations",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, SalesQuotationsPage),
  },
  {
    path: "sales/orders",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, SalesOrdersPage),
  },
  {
    path: "sales/pos-orders",
    element: protect("sales.orders.view", PosSalesOrdersPage),
  },
  {
    path: "sales/deliveries",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, DeliveryNotesPage),
  },
  {
    path: "sales/invoices",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, SalesInvoicesPage),
  },
  {
    path: "sales/payments",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, CustomerPaymentsPage),
  },
  {
    path: "sales/returns",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, SalesReturnsPage),
  },
  {
    path: "sales/credit-notes",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, CreditNotesPage),
  },
  {
    path: "sales/recurring",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, RecurringInvoicesPage),
  },
  {
    path: "sales/commissions",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, SalesCommissionsPage),
  },
  { path: "sales/flash-sales", element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, FlashSalesPage) },
  { path: "sales/reviews", element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, CustomerReviewsPage) },
  { path: "sales/abandoned-carts", element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, AbandonedCartsPage) },
];
