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
const SalesReturnsPage = salesPage("SalesReturnsPage");
const FlashSalesPage = lazyPage(() => import("@/features/sales/pages/FlashSalesPage").then(module => ({ default: module.FlashSalesPage })));
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
    path: "sales/returns",
    element: protect(PERMISSIONS.SALES_WORKFLOW.VIEW, SalesReturnsPage),
  },
  { path: "sales/flash-sales", element: protect(PERMISSIONS.SALES_WORKFLOW.FLASH_SALES_VIEW, FlashSalesPage) },
];
