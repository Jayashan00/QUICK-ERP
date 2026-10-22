import { registerList, replaceArray } from '@/core/persistence/stateRegistry';
import {
  mockInventoryBatches,
  mockInventorySerialNumbers,
  mockStockBalances,
  mockStockLocations,
  mockStockMovements,
  mockWarehouses,
  mockStockAdjustments,
  mockStockTransfers,
  mockBranchStockRequests,
  mockStockCounts,
  mockStockReturnsWastage,
} from "../mocks";
import type {
  InventoryBatch,
  InventorySerialNumber,
  StockBalance,
  StockLocation,
  StockMovement,
  Warehouse,
} from "../types/inventory";
import type {
  BranchStockRequest,
  StockAdjustment,
  StockCount,
  StockReturnWastage,
  StockTransfer,
} from "../types/stockWorkflows";

const cloneWarehouse = (item: Warehouse): Warehouse => ({ ...item });
const cloneLocation = (item: StockLocation): StockLocation => ({ ...item });

let warehouses = mockWarehouses.map(cloneWarehouse);
let locations = mockStockLocations.map(cloneLocation);
let balances = mockStockBalances.map((item) => ({ ...item }));
let movements = mockStockMovements.map((item) => ({ ...item }));
let batches = mockInventoryBatches.map((item) => ({ ...item }));
const serialNumbers = mockInventorySerialNumbers.map((item) => ({ ...item }));
let adjustments = mockStockAdjustments.map((item) => ({ ...item }));
let transfers = mockStockTransfers.map((item) => ({ ...item }));
let stockRequests = mockBranchStockRequests.map((item) => ({ ...item }));
let stockCounts = mockStockCounts.map((item) => ({ ...item }));
let returnsWastage = mockStockReturnsWastage.map((item) => ({ ...item }));

export const inventoryStore = {
  warehouses: () => warehouses,
  locations: () => locations,
  balances: (): StockBalance[] => balances,
  movements: (): StockMovement[] => movements,
  batches: (): InventoryBatch[] => batches,
  serialNumbers: (): InventorySerialNumber[] => serialNumbers,
  adjustments: (): StockAdjustment[] => adjustments,
  transfers: (): StockTransfer[] => transfers,
  stockRequests: (): BranchStockRequest[] => stockRequests,
  stockCounts: (): StockCount[] => stockCounts,
  returnsWastage: (): StockReturnWastage[] => returnsWastage,
  insertBalance(item: StockBalance) {
    balances = [item, ...balances];
  },
  replaceBalance(index: number, item: StockBalance) {
    balances[index] = item;
  },
  insertMovement(item: StockMovement) {
    movements = [item, ...movements];
  },
  replaceBatch(index: number, item: InventoryBatch) {
    batches[index] = item;
  },
  insertBatch(item: InventoryBatch) {
    batches = [item, ...batches];
  },
  replaceSerial(index: number, item: InventorySerialNumber) {
    serialNumbers[index] = item;
  },
  insertSerial(item: InventorySerialNumber) {
    serialNumbers.unshift(item);
  },
  insertAdjustment(item: StockAdjustment) {
    adjustments = [item, ...adjustments];
  },
  replaceAdjustment(index: number, item: StockAdjustment) {
    adjustments[index] = item;
  },
  insertTransfer(item: StockTransfer) {
    transfers = [item, ...transfers];
  },
  replaceTransfer(index: number, item: StockTransfer) {
    transfers[index] = item;
  },
  insertStockRequest(item: BranchStockRequest) {
    stockRequests = [item, ...stockRequests];
  },
  replaceStockRequest(index: number, item: BranchStockRequest) {
    stockRequests[index] = item;
  },
  insertStockCount(item: StockCount) {
    stockCounts = [item, ...stockCounts];
  },
  replaceStockCount(index: number, item: StockCount) {
    stockCounts[index] = item;
  },
  insertReturnWastage(item: StockReturnWastage) {
    returnsWastage = [item, ...returnsWastage];
  },
  replaceReturnWastage(index: number, item: StockReturnWastage) {
    returnsWastage[index] = item;
  },
  insertWarehouse(item: Warehouse) {
    warehouses = [item, ...warehouses];
  },
  replaceWarehouse(index: number, item: Warehouse) {
    warehouses[index] = item;
  },
  removeWarehouse(tenantId: string, id: string) {
    warehouses = warehouses.filter(
      (item) => !(item.tenantId === tenantId && item.id === id),
    );
  },
  insertLocation(item: StockLocation) {
    locations = [item, ...locations];
  },
  replaceLocation(index: number, item: StockLocation) {
    locations[index] = item;
  },
  removeLocation(tenantId: string, id: string) {
    locations = locations.filter(
      (item) => !(item.tenantId === tenantId && item.id === id),
    );
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('inventory.warehouses', () => warehouses, (rows) => { warehouses = rows; });
registerList('inventory.locations', () => locations, (rows) => { locations = rows; });
registerList('inventory.balances', () => balances, (rows) => { balances = rows; });
registerList('inventory.movements', () => movements, (rows) => { movements = rows; });
registerList('inventory.batches', () => batches, (rows) => { batches = rows; });
registerList('inventory.serialNumbers', () => serialNumbers, (rows) => replaceArray(serialNumbers, rows));
registerList('inventory.adjustments', () => adjustments, (rows) => { adjustments = rows; });
registerList('inventory.transfers', () => transfers, (rows) => { transfers = rows; });
registerList('inventory.stockRequests', () => stockRequests, (rows) => { stockRequests = rows; });
registerList('inventory.stockCounts', () => stockCounts, (rows) => { stockCounts = rows; });
registerList('inventory.returnsWastage', () => returnsWastage, (rows) => { returnsWastage = rows; });
