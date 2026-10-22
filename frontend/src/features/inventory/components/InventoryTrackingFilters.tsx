import { FilterPanel } from "@/shared/components/tables/FilterPanel";
import { Select } from "@/shared/components/forms/Select";
import type { ReactNode } from "react";
interface Option {
  id: string;
  name: string;
  sku?: string;
}
interface Props {
  canViewAllBranches: boolean;
  branches: Option[];
  warehouses: Option[];
  locations: Option[];
  products: Option[];
  branchId: string;
  warehouseId: string;
  locationId: string;
  productId: string;
  status: string;
  statusOptions: Array<{ value: string; label: string }>;
  onBranch: (value: string) => void;
  onWarehouse: (value: string) => void;
  onLocation: (value: string) => void;
  onProduct: (value: string) => void;
  onStatus: (value: string) => void;
  onReset: () => void;
  extra?: ReactNode;
}
export function InventoryTrackingFilters(props: Props) {
  const count =
    (props.branchId !== "all" ? 1 : 0) +
    (props.warehouseId ? 1 : 0) +
    (props.locationId ? 1 : 0) +
    (props.productId ? 1 : 0) +
    (props.status !== "all" ? 1 : 0);
  return (
    <FilterPanel activeFilterCount={count} onReset={props.onReset}>
      {props.canViewAllBranches && (
        <Select
          className="h-8 w-full py-0 text-xs sm:w-auto"
          aria-label="Filter by branch"
          value={props.branchId}
          onChange={(event) => props.onBranch(event.target.value)}
          options={[
            { value: "all", label: "All permitted branches" },
            ...props.branches.map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
        />
      )}
      <Select
        className="h-8 w-full py-0 text-xs sm:w-auto"
        aria-label="Filter by warehouse"
        value={props.warehouseId}
        onChange={(event) => props.onWarehouse(event.target.value)}
        options={[
          { value: "", label: "All warehouses" },
          ...props.warehouses.map((item) => ({
            value: item.id,
            label: item.name,
          })),
        ]}
      />
      <Select
        className="h-8 w-full py-0 text-xs sm:w-auto"
        aria-label="Filter by stock location"
        value={props.locationId}
        onChange={(event) => props.onLocation(event.target.value)}
        options={[
          { value: "", label: "All locations" },
          ...props.locations.map((item) => ({
            value: item.id,
            label: item.name,
          })),
        ]}
      />
      <Select
        className="h-8 w-full py-0 text-xs sm:w-auto"
        aria-label="Filter by product"
        value={props.productId}
        onChange={(event) => props.onProduct(event.target.value)}
        options={[
          { value: "", label: "All products" },
          ...props.products.map((item) => ({
            value: item.id,
            label: item.sku ? `${item.name} (${item.sku})` : item.name,
          })),
        ]}
      />
      <Select
        className="h-8 w-full py-0 text-xs sm:w-auto"
        aria-label="Filter by status"
        value={props.status}
        onChange={(event) => props.onStatus(event.target.value)}
        options={props.statusOptions}
      />
      {props.extra}
    </FilterPanel>
  );
}
