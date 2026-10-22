import type { InventorySerialNumber, SerialStatus } from "../types/inventory";
const now = "2026-09-20T08:00:00Z";
const serial = (
  id: string,
  productId: string,
  serialNumber: string,
  status: SerialStatus,
  referenceNumber?: string,
): InventorySerialNumber => ({
  id,
  tenantId: "tenant-001",
  branchId: "branch-001",
  warehouseId: "warehouse-hq-main",
  locationId: "loc-hq-main",
  productId,
  serialNumber,
  status,
  receivedAt: "2026-09-05T09:00:00Z",
  referenceNumber,
  createdAt: now,
  updatedAt: now,
});
export const mockInventorySerialNumbers: InventorySerialNumber[] = [
  serial(
    "serial-001",
    "prod-001",
    "PB14-26-000184",
    "available",
    "GRN-2026-0194",
  ),
  serial(
    "serial-002",
    "prod-001",
    "PB14-26-000185",
    "reserved",
    "SO-2026-0831",
  ),
  serial(
    "serial-003",
    "prod-001",
    "PB14-26-000162",
    "sold_issued",
    "INV-2026-1022",
  ),
  serial("serial-004", "prod-010", "DRL-261001", "available", "GRN-2026-0180"),
  serial("serial-005", "prod-010", "DRL-261002", "in_transit", "TRF-2026-0081"),
  serial("serial-006", "prod-010", "DRL-260944", "returned", "RET-2026-0012"),
];
