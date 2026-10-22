import { mockGoodsReceipts, mockPurchaseInvoices, mockPurchaseOrders, mockPurchaseRequests, mockPurchaseReturns, mockRfqs, mockSupplierQuotations } from "../mocks/purchasing";
import type { GoodsReceiptNote, PurchaseInvoice, PurchaseOrder, PurchaseRequest, PurchaseReturn, RequestForQuotation, SupplierQuotation } from "../types/purchasing";
import { registerList } from '@/core/persistence/stateRegistry';

let requests = structuredClone(mockPurchaseRequests);
let rfqs = structuredClone(mockRfqs);
let quotations = structuredClone(mockSupplierQuotations);
let orders = structuredClone(mockPurchaseOrders);
let receipts = structuredClone(mockGoodsReceipts);
let invoices = structuredClone(mockPurchaseInvoices);
let returns = structuredClone(mockPurchaseReturns);

function replace<T>(records: T[], index: number, item: T) { records[index] = item; }
export const purchasingStore = {
  requests: (): PurchaseRequest[] => requests,
  rfqs: (): RequestForQuotation[] => rfqs,
  quotations: (): SupplierQuotation[] => quotations,
  orders: (): PurchaseOrder[] => orders,
  receipts: (): GoodsReceiptNote[] => receipts,
  invoices: (): PurchaseInvoice[] => invoices,
  returns: (): PurchaseReturn[] => returns,
  insertRequest: (item: PurchaseRequest) => { requests = [item, ...requests]; },
  replaceRequest: (index: number, item: PurchaseRequest) => replace(requests, index, item),
  insertRfq: (item: RequestForQuotation) => { rfqs = [item, ...rfqs]; },
  replaceRfq: (index: number, item: RequestForQuotation) => replace(rfqs, index, item),
  insertQuotation: (item: SupplierQuotation) => { quotations = [item, ...quotations]; },
  replaceQuotation: (index: number, item: SupplierQuotation) => replace(quotations, index, item),
  insertOrder: (item: PurchaseOrder) => { orders = [item, ...orders]; },
  replaceOrder: (index: number, item: PurchaseOrder) => replace(orders, index, item),
  insertReceipt: (item: GoodsReceiptNote) => { receipts = [item, ...receipts]; },
  replaceReceipt: (index: number, item: GoodsReceiptNote) => replace(receipts, index, item),
  insertInvoice: (item: PurchaseInvoice) => { invoices = [item, ...invoices]; },
  replaceInvoice: (index: number, item: PurchaseInvoice) => replace(invoices, index, item),
  insertReturn: (item: PurchaseReturn) => { returns = [item, ...returns]; },
  replaceReturn: (index: number, item: PurchaseReturn) => replace(returns, index, item),
};

// Backend persistence registration (see src/core/persistence).
registerList('purchases.requests', () => requests, (rows) => { requests = rows; });
registerList('purchases.rfqs', () => rfqs, (rows) => { rfqs = rows; });
registerList('purchases.quotations', () => quotations, (rows) => { quotations = rows; });
registerList('purchases.orders', () => orders, (rows) => { orders = rows; });
registerList('purchases.receipts', () => receipts, (rows) => { receipts = rows; });
registerList('purchases.invoices', () => invoices, (rows) => { invoices = rows; });
registerList('purchases.returns', () => returns, (rows) => { returns = rows; });
