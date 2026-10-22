import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  LockKeyhole,
  PackageCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { PERMISSIONS } from "@/core/permissions";
import { useBranch } from "@/core/branch/branch-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { StatCard } from "@/shared/components/cards/StatCard";
import { SummaryCard } from "@/shared/components/cards/SummaryCard";
import { Button } from "@/shared/components/common/Button";
import { Card } from "@/shared/components/common/Card";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { EmptyState } from "@/shared/components/feedback/EmptyState";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { LoadingSpinner } from "@/shared/components/feedback/LoadingSpinner";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { useProductStockDetail } from "../hooks/useInventoryTracking";
export function ProductStockDetailPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentBranch, branches } = useBranch();
  const { hasPermission } = usePermissions();
  const canViewAll = hasPermission(
    PERMISSIONS.INVENTORY.STOCK_VIEW_ALL_BRANCHES,
  );
  const permittedBranchIds = canViewAll
    ? branches.map((item) => item.id)
    : currentBranch
      ? [currentBranch.id]
      : [];
  const detail = useProductStockDetail(
    productId,
    searchParams.get("variantId") ?? undefined,
    permittedBranchIds,
  );
  if (detail.isLoading)
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (detail.error || !detail.data)
    return (
      <ErrorState
        title="Product stock not found"
        message="The product is unavailable or outside your permitted stock scope."
        onRetry={() => void detail.refetch()}
      />
    );
  const data = detail.data;
  const alertTone =
    data.alertStatus === "out_of_stock"
      ? "danger"
      : data.alertStatus === "healthy"
        ? "success"
        : "warning";
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        leftIcon={<ArrowLeft size={16} />}
        onClick={() => navigate("/inventory/stocks")}
      >
        Back to Stock Levels
      </Button>
      <PageHeader
        title={data.product.name}
        description={`${data.variant?.sku ?? data.product.sku}${data.variant ? ` · ${data.variant.name}` : ""}`}
        actions={
          <div className="flex gap-2">
            <StatusBadge status={data.alertStatus} tone={alertTone} />
            {data.alertStatus !== "healthy" && (
              <Button
                disabled
                variant="secondary"
                leftIcon={<ShoppingCart size={16} />}
              >
                Prepare Reorder
              </Button>
            )}
          </div>
        }
      />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Product SKU</div>
            <div className="font-semibold">{data.product.sku}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Barcode</div>
            <div className="font-semibold">
              {data.product.barcode ?? "Not assigned"}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">
              Minimum / Reorder / Maximum
            </div>
            <div className="font-semibold">
              {data.product.minStockLevel ?? 0} /{" "}
              {data.product.reorderLevel ?? 0} /{" "}
              {data.product.maxStockLevel ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Tracking</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {data.product.trackByBatch &&
                hasPermission(PERMISSIONS.INVENTORY.VIEW_BATCHES) && (
                <Link to={`/inventory/batches?productId=${data.product.id}`}>
                  <StatusBadge status="batch_tracked" tone="info" />
                </Link>
              )}
              {data.product.trackBySerialNumber &&
                hasPermission(PERMISSIONS.INVENTORY.VIEW_SERIALS) && (
                <Link to={`/inventory/serials?productId=${data.product.id}`}>
                  <StatusBadge status="serial_tracked" tone="info" />
                </Link>
              )}
              {data.product.trackExpiry &&
                hasPermission(PERMISSIONS.INVENTORY.VIEW_EXPIRY) && (
                <Link to={`/inventory/expiry?productId=${data.product.id}`}>
                  <StatusBadge status="expiry_tracked" tone="warning" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="On Hand"
          value={data.totals.onHand}
          icon={<Boxes size={20} />}
        />
        <StatCard
          title="Available"
          value={data.totals.available}
          icon={<PackageCheck size={20} />}
        />
        <StatCard
          title="Committed"
          value={data.totals.committed}
          icon={<LockKeyhole size={20} />}
        />
        <StatCard
          title="Reserved"
          value={data.totals.reserved}
          icon={<LockKeyhole size={20} />}
        />
        <StatCard
          title="In Transit"
          value={data.totals.inTransit}
          icon={<Truck size={20} />}
        />
      </div>
      <SummaryCard
        title="Stock Breakdown"
        subtitle="Branch, warehouse, and location-level quantities"
      >
        {data.balances.length === 0 ? (
          <EmptyState
            title="No stock balances"
            message="No stock exists in your permitted branches."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Warehouse</th>
                  <th>Location</th>
                  <th>SKU / Variant</th>
                  <th className="text-right">On Hand</th>
                  <th className="text-right">Committed</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">In Transit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.balances.map((item) => (
                  <tr key={item.id}>
                    <td>{item.branchName}</td>
                    <td>{item.warehouseName}</td>
                    <td>{item.locationName}</td>
                    <td>
                      {item.sku}
                      {item.variantName ? ` · ${item.variantName}` : ""}
                    </td>
                    <td className="text-right">{item.quantityOnHand}</td>
                    <td className="text-right">
                      {item.quantityCommitted}
                    </td>
                    <td className="text-right font-semibold">
                      {item.quantityAvailable}
                    </td>
                    <td className="text-right">{item.quantityInTransit}</td>
                    <td>
                      <StatusBadge
                        status={item.alertStatus}
                        tone={
                          item.alertStatus === "out_of_stock"
                            ? "danger"
                            : item.alertStatus === "healthy"
                              ? "success"
                              : "warning"
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SummaryCard>
      <SummaryCard
        title="Recent Stock Movements"
        subtitle="Read-only audit activity for this product"
      >
        {data.recentMovements.length === 0 ? (
          <EmptyState
            title="No movements"
            message="No recent movements exist in your permitted branches."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Location</th>
                  <th className="text-right">Change</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {data.recentMovements.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.movementDate))}
                    </td>
                    <td>
                      <StatusBadge status={item.type} />
                    </td>
                    <td>{item.referenceNumber}</td>
                    <td>
                      {item.branchName} · {item.locationName}
                    </td>
                    <td
                      className={`text-right font-semibold ${item.quantity > 0 ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {item.quantity > 0 ? "+" : ""}
                      {item.quantity}
                    </td>
                    <td>{item.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SummaryCard>
    </div>
  );
}
