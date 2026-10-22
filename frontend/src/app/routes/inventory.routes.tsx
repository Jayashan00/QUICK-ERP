import { Navigate, type RouteObject } from "react-router-dom";
import { TENANT_PERMISSIONS as PERMISSIONS } from "@/core/permissions";
import { RequirePermission } from "@/core/permissions/components";
import { lazyPage } from "./lazyPage";
const inventoryReportPage = (report: 'aging' | 'expiry' | 'dead-stock' | 'wastage' | 'in-transit' | 'margins') => lazyPage(() => import('@/features/inventory/pages/InventoryReportsPage').then(({ InventoryReportsPage }) => ({ default: () => <InventoryReportsPage report={report} /> })));

const ProductListPage = lazyPage(() =>
  import("@/features/products").then(({ ProductListPage }) => ({
    default: ProductListPage,
  })),
);
const ProductFormPage = lazyPage(() =>
  import("@/features/products").then(({ ProductFormPage }) => ({
    default: ProductFormPage,
  })),
);
const ProductDetailPage = lazyPage(() =>
  import("@/features/products").then(({ ProductDetailPage }) => ({
    default: ProductDetailPage,
  })),
);
const ProductImportPage = lazyPage(() =>
  import("@/features/products").then(({ ProductImportPage }) => ({
    default: ProductImportPage,
  })),
);
const ProductCategoryPage = lazyPage(() =>
  import("@/features/products").then(({ ProductCategoryPage }) => ({
    default: ProductCategoryPage,
  })),
);
const ProductBrandPage = lazyPage(() =>
  import("@/features/products").then(({ ProductBrandPage }) => ({
    default: ProductBrandPage,
  })),
);
const ProductUomPage = lazyPage(() =>
  import("@/features/products").then(({ ProductUomPage }) => ({
    default: ProductUomPage,
  })),
);
const PriceListPage = lazyPage(() =>
  import("@/features/products").then(({ PriceListPage }) => ({
    default: PriceListPage,
  })),
);
const PriceListFormPage = lazyPage(() =>
  import("@/features/products").then(({ PriceListFormPage }) => ({
    default: PriceListFormPage,
  })),
);
const PriceListDetailPage = lazyPage(() =>
  import("@/features/products").then(({ PriceListDetailPage }) => ({
    default: PriceListDetailPage,
  })),
);
const InventoryDashboardPage = lazyPage(() =>
  import("@/features/inventory").then(({ InventoryDashboardPage }) => ({
    default: InventoryDashboardPage,
  })),
);
const StockBalancesPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockBalancesPage }) => ({
    default: StockBalancesPage,
  })),
);
const WarehouseListPage = lazyPage(() =>
  import("@/features/inventory").then(({ WarehouseListPage }) => ({
    default: WarehouseListPage,
  })),
);
const WarehouseFormPage = lazyPage(() =>
  import("@/features/inventory").then(({ WarehouseFormPage }) => ({
    default: WarehouseFormPage,
  })),
);
const WarehouseDetailPage = lazyPage(() =>
  import("@/features/inventory").then(({ WarehouseDetailPage }) => ({
    default: WarehouseDetailPage,
  })),
);
const StockLocationListPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockLocationListPage }) => ({
    default: StockLocationListPage,
  })),
);
const StockLocationFormPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockLocationFormPage }) => ({
    default: StockLocationFormPage,
  })),
);
const StockLocationDetailPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockLocationDetailPage }) => ({
    default: StockLocationDetailPage,
  })),
);
const ProductStockDetailPage = lazyPage(() =>
  import("@/features/inventory").then(({ ProductStockDetailPage }) => ({
    default: ProductStockDetailPage,
  })),
);
const BatchTrackingPage = lazyPage(() =>
  import("@/features/inventory").then(({ BatchTrackingPage }) => ({
    default: BatchTrackingPage,
  })),
);
const SerialTrackingPage = lazyPage(() =>
  import("@/features/inventory").then(({ SerialTrackingPage }) => ({
    default: SerialTrackingPage,
  })),
);
const ExpiryTrackingPage = lazyPage(() =>
  import("@/features/inventory").then(({ ExpiryTrackingPage }) => ({
    default: ExpiryTrackingPage,
  })),
);
const StockMovementLedgerPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockMovementLedgerPage }) => ({
    default: StockMovementLedgerPage,
  })),
);
const StockAdjustmentsPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockAdjustmentsPage }) => ({
    default: StockAdjustmentsPage,
  })),
);
const StockTransfersPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockTransfersPage }) => ({
    default: StockTransfersPage,
  })),
);
const BranchStockRequestsPage = lazyPage(() =>
  import("@/features/inventory").then(({ BranchStockRequestsPage }) => ({ default: BranchStockRequestsPage })),
);
const StockCountsPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockCountsPage }) => ({ default: StockCountsPage })),
);
const StockReturnsWastagePage = lazyPage(() =>
  import("@/features/inventory").then(({ StockReturnsWastagePage }) => ({ default: StockReturnsWastagePage })),
);
const ReorderWorkflowPage = lazyPage(() =>
  import("@/features/inventory").then(({ ReorderWorkflowPage }) => ({ default: ReorderWorkflowPage })),
);
const InventorySettingsPage = lazyPage(() =>
  import("@/features/inventory").then(({ InventorySettingsPage }) => ({ default: InventorySettingsPage })),
);
const MobileStockCountPage = lazyPage(() =>
  import("@/features/inventory").then(({ MobileStockCountPage }) => ({ default: MobileStockCountPage })),
);
const StockVelocityPage = lazyPage(() =>
  import("@/features/inventory").then(({ StockVelocityPage }) => ({ default: StockVelocityPage })),
);

export const inventoryRoutes: RouteObject[] = [
  ...(['aging', 'expiry', 'dead-stock', 'wastage', 'in-transit', 'margins'] as const).map((report) => { const Page = inventoryReportPage(report); const permission = report === 'expiry' ? PERMISSIONS.INVENTORY.VIEW_EXPIRY : report === 'wastage' ? PERMISSIONS.INVENTORY.STOCK_ADJUST : report === 'in-transit' ? PERMISSIONS.INVENTORY.TRANSFERS_VIEW : PERMISSIONS.INVENTORY.STOCK_VIEW; return { path: `inventory/reports/${report}`, element: <RequirePermission allOf={[PERMISSIONS.INVENTORY.VIEW, permission]}><Page /></RequirePermission> }; }),
  // Products & Services
  {
    path: "products",
    element: (
      <RequirePermission
        permission={PERMISSIONS.PRODUCTS.PRODUCTS_VIEW}
        deniedMessage="You don't have permission to view products."
      >
        <ProductListPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/new",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.PRODUCTS_CREATE,
        ]}
      >
        <ProductFormPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/import",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.PRODUCTS_IMPORT,
        ]}
      >
        <ProductImportPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/attributes",
    element: (
      <RequirePermission permission={PERMISSIONS.PRODUCTS.PRODUCTS_VIEW}>
        <Navigate to="/products" replace />
      </RequirePermission>
    ),
  },
  {
    path: "products/:id",
    element: (
      <RequirePermission permission={PERMISSIONS.PRODUCTS.PRODUCTS_VIEW}>
        <ProductDetailPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/:id/edit",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.PRODUCTS_EDIT,
        ]}
      >
        <ProductFormPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/categories",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.CATEGORIES_VIEW,
        ]}
      >
        <ProductCategoryPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/brands",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.BRANDS_VIEW,
        ]}
      >
        <ProductBrandPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/uoms",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.UOMS_VIEW,
        ]}
      >
        <ProductUomPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/price-lists",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.PRICE_LISTS_VIEW,
        ]}
      >
        <PriceListPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/price-lists/new",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.PRICE_LISTS_VIEW,
          PERMISSIONS.PRODUCTS.PRICE_LISTS_CREATE,
        ]}
      >
        <PriceListFormPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/price-lists/:id/edit",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.PRICE_LISTS_VIEW,
          PERMISSIONS.PRODUCTS.PRICE_LISTS_EDIT,
        ]}
      >
        <PriceListFormPage />
      </RequirePermission>
    ),
  },
  {
    path: "products/price-lists/:id",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.PRODUCTS.PRODUCTS_VIEW,
          PERMISSIONS.PRODUCTS.PRICE_LISTS_VIEW,
        ]}
      >
        <PriceListDetailPage />
      </RequirePermission>
    ),
  },
  // Inventory
  {
    path: "inventory",
    element: (
      <RequirePermission permission={PERMISSIONS.INVENTORY.VIEW}>
        <InventoryDashboardPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/stocks",
    element: (
      <RequirePermission
        allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.STOCK_VIEW]}
      >
        <StockBalancesPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/warehouses",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.WAREHOUSES_VIEW,
        ]}
      >
        <WarehouseListPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/warehouses/new",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES,
        ]}
      >
        <WarehouseFormPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/warehouses/:id/edit",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES,
        ]}
      >
        <WarehouseFormPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/warehouses/:id",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.WAREHOUSES_VIEW,
        ]}
      >
        <WarehouseDetailPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/locations",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.LOCATIONS_VIEW,
        ]}
      >
        <StockLocationListPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/locations/new",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.MANAGE_LOCATIONS,
        ]}
      >
        <StockLocationFormPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/locations/:id/edit",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.MANAGE_LOCATIONS,
        ]}
      >
        <StockLocationFormPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/locations/:id",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.LOCATIONS_VIEW,
        ]}
      >
        <StockLocationDetailPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/stock/:productId",
    element: (
      <RequirePermission
        allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.STOCK_VIEW]}
      >
        <ProductStockDetailPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/batches",
    element: (
      <RequirePermission
        allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.VIEW_BATCHES]}
      >
        <BatchTrackingPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/serials",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.VIEW_SERIALS,
        ]}
      >
        <SerialTrackingPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/expiry",
    element: (
      <RequirePermission
        allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.VIEW_EXPIRY]}
      >
        <ExpiryTrackingPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/movements",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.VIEW_MOVEMENTS,
        ]}
      >
        <StockMovementLedgerPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/adjustments",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.ADJUSTMENTS_VIEW,
        ]}
      >
        <StockAdjustmentsPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/transfers",
    element: (
      <RequirePermission
        allOf={[
          PERMISSIONS.INVENTORY.VIEW,
          PERMISSIONS.INVENTORY.TRANSFERS_VIEW,
        ]}
      >
        <StockTransfersPage />
      </RequirePermission>
    ),
  },
  {
    path: "inventory/requests",
    element: <RequirePermission allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.STOCK_REQUEST]}><BranchStockRequestsPage /></RequirePermission>,
  },
  {
    path: "inventory/counts",
    element: <RequirePermission allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.STOCK_COUNT]}><StockCountsPage /></RequirePermission>,
  },
  {
    path: "inventory/counts/mobile",
    element: <RequirePermission allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.STOCK_COUNT]}><MobileStockCountPage /></RequirePermission>,
  },
  {
    path: "inventory/returns-wastage",
    element: <RequirePermission allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.STOCK_ADJUST]}><StockReturnsWastagePage /></RequirePermission>,
  },
  {
    path: "inventory/reorder",
    element: <RequirePermission allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.STOCK_VIEW]}><ReorderWorkflowPage /></RequirePermission>,
  },
  {
    path: "inventory/velocity",
    element: <RequirePermission allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.VELOCITY_VIEW]}><StockVelocityPage /></RequirePermission>,
  },
  {
    path: "inventory/settings",
    element: <RequirePermission allOf={[PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.SETTINGS_VIEW]}><InventorySettingsPage /></RequirePermission>,
  },
];
