import { registerList } from '@/core/persistence/stateRegistry';
import {
  mockCreditNotes,
  mockCustomerPayments,
  mockDeliveryNotes,
  mockRecurringInvoices,
  mockSalesInvoices,
  mockSalesOrders,
  mockSalesQuotations,
  mockSalesReturns,
} from "../mocks/sales";
import type {
  CreditNote,
  CustomerPayment,
  DeliveryNote,
  RecurringInvoice,
  SalesInvoice,
  SalesOrder,
  SalesQuotation,
  SalesReturn,
} from "../types/sales";

let quotations = structuredClone(mockSalesQuotations);
let orders = structuredClone(mockSalesOrders);
let deliveries = structuredClone(mockDeliveryNotes);
let invoices = structuredClone(mockSalesInvoices);
let payments = structuredClone(mockCustomerPayments);
let returns = structuredClone(mockSalesReturns);
let creditNotes = structuredClone(mockCreditNotes);
let recurring = structuredClone(mockRecurringInvoices);
const replace = <T>(records: T[], index: number, item: T) => {
  records[index] = item;
};

export const salesStore = {
  quotations: (): SalesQuotation[] => quotations,
  orders: (): SalesOrder[] => orders,
  deliveries: (): DeliveryNote[] => deliveries,
  invoices: (): SalesInvoice[] => invoices,
  payments: (): CustomerPayment[] => payments,
  returns: (): SalesReturn[] => returns,
  creditNotes: (): CreditNote[] => creditNotes,
  recurring: (): RecurringInvoice[] => recurring,
  insertQuotation: (item: SalesQuotation) => {
    quotations = [item, ...quotations];
  },
  replaceQuotation: (index: number, item: SalesQuotation) =>
    replace(quotations, index, item),
  insertOrder: (item: SalesOrder) => {
    orders = [item, ...orders];
  },
  replaceOrder: (index: number, item: SalesOrder) =>
    replace(orders, index, item),
  insertDelivery: (item: DeliveryNote) => {
    deliveries = [item, ...deliveries];
  },
  replaceDelivery: (index: number, item: DeliveryNote) =>
    replace(deliveries, index, item),
  insertInvoice: (item: SalesInvoice) => {
    invoices = [item, ...invoices];
  },
  replaceInvoice: (index: number, item: SalesInvoice) =>
    replace(invoices, index, item),
  insertPayment: (item: CustomerPayment) => {
    payments = [item, ...payments];
  },
  insertReturn: (item: SalesReturn) => {
    returns = [item, ...returns];
  },
  insertCreditNote: (item: CreditNote) => {
    creditNotes = [item, ...creditNotes];
  },
  insertRecurring: (item: RecurringInvoice) => {
    recurring = [item, ...recurring];
  },
  replaceRecurring: (index: number, item: RecurringInvoice) =>
    replace(recurring, index, item),
};

// Backend persistence registration (see src/core/persistence).
registerList('sales.quotations', () => quotations, (rows) => { quotations = rows; });
registerList('sales.orders', () => orders, (rows) => { orders = rows; });
registerList('sales.deliveries', () => deliveries, (rows) => { deliveries = rows; });
registerList('sales.invoices', () => invoices, (rows) => { invoices = rows; });
registerList('sales.payments', () => payments, (rows) => { payments = rows; });
registerList('sales.returns', () => returns, (rows) => { returns = rows; });
registerList('sales.creditNotes', () => creditNotes, (rows) => { creditNotes = rows; });
registerList('sales.recurringInvoices', () => recurring, (rows) => { recurring = rows; });
