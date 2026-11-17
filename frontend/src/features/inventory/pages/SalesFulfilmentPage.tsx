import { useMemo, useState, type ReactNode } from "react";
import { useSalesCustomerOptions, useSalesMutations, useSalesOrders, useSalesProductOptions } from "@/features/sales";
import { DeliveryFormModal } from "@/features/sales/components/SalesForms";
import type { SalesOrder } from "@/features/sales";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { Textarea } from "@/shared/components/forms/Textarea";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { PageContainer } from "@/shared/components/layout/PageContainer";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { useTenantCurrency } from "@/features/settings/finance/currency";
import { appToast } from "@/shared/utils/toast";
import { getErrorMessage } from "@/shared/utils/errors";
import { useWarehouseOptions } from "../hooks/useWarehouseManagement";

export function SalesFulfilmentPage() {
  const orders = useSalesOrders({ branchId: "all", pageSize: 100 });
  const products = useSalesProductOptions();
  const customers = useSalesCustomerOptions();
  const warehouses = useWarehouseOptions();
  const mutations = useSalesMutations();
  const currency = useTenantCurrency();
  const [deliveryOrderId, setDeliveryOrderId] = useState("");
  const [viewingOrder, setViewingOrder] = useState<SalesOrder | null>(null);
  const [returnMode, setReturnMode] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const fulfilmentOrders = useMemo(() => {
    const rows = orders.data?.data ?? [];
    if (!products.data) return [];
    return rows.filter(
      (order) =>
        ["confirmed", "processing"].includes(order.status) &&
        order.items.some((line) => {
          const product = products.data?.find((item) => item.id === line.productId);
          return product?.type !== "service";
        }),
    );
  }, [orders.data?.data, products.data]);
  const waitingCount = fulfilmentOrders.filter((order) => order.status === "confirmed").length;
  const processingCount = fulfilmentOrders.filter((order) => order.status === "processing").length;

  const startProcessing = async (order: SalesOrder) => {
    try {
      await mutations.transitionOrder(order.id, "process");
      appToast.success(`${order.referenceNumber} is now processing.`);
      return true;
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to start order processing."));
      return false;
    }
  };
  const closeOrder = () => {
    setViewingOrder(null);
    setReturnMode(false);
    setReturnReason("");
  };
  const returnToSales = async (order: SalesOrder) => {
    const reason = returnReason.trim();
    if (reason.length < 5) {
      appToast.error("Enter a return reason of at least 5 characters for Sales.");
      return;
    }
    try {
      await mutations.transitionOrder(order.id, "return_to_sales", reason);
      appToast.success(`${order.referenceNumber} returned to Sales for correction.`);
      closeOrder();
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to return the order to Sales."));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Sales Fulfilment"
        description="Prepare confirmed product orders for warehouse delivery."
      />
      {waitingCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {waitingCount} sales order{waitingCount === 1 ? "" : "s"} {waitingCount === 1 ? "is" : "are"} waiting for the Inventory Manager to start processing.
        </div>
      )}
      {processingCount > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {processingCount} sales order{processingCount === 1 ? "" : "s"} {processingCount === 1 ? "is" : "are"} currently being processed by Inventory.
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fulfilmentOrders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-3 font-semibold text-violet-700">{order.referenceNumber}</td>
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3">{customers.data?.find((item) => item.id === order.customerId)?.name ?? order.customerName ?? order.customerId}</td>
                <td className="px-4 py-3">{warehouses.data?.find((item) => item.id === order.warehouseId)?.name ?? order.warehouseId ?? "—"}</td>
                <td className="px-4 py-3">{order.items.length}</td>
                <td className="px-4 py-3 text-right">{currency.formatMoneyInCurrency(order.totalAmount, order.currency)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setViewingOrder(order)}
                  >
                    View Order
                  </Button>
                  {order.status === "processing" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDeliveryOrderId(order.id)}
                    >
                      Complete Delivery
                    </Button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.isLoading && fulfilmentOrders.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No confirmed product orders are waiting for fulfilment.
          </p>
        )}
      </div>
      <DeliveryFormModal
        isOpen={Boolean(deliveryOrderId)}
        initialOrderId={deliveryOrderId}
        onClose={() => setDeliveryOrderId("")}
      />
      <Modal
        isOpen={Boolean(viewingOrder)}
        onClose={closeOrder}
        title={viewingOrder ? `${viewingOrder.referenceNumber} order information` : "Order information"}
        maxWidth="1050px"
        footer={
          viewingOrder ? (
            <div className="flex justify-end gap-2">
              {returnMode ? (
                <>
                  <Button variant="secondary" onClick={() => { setReturnMode(false); setReturnReason(""); }}>
                    Cancel Return
                  </Button>
                  <Button
                    isLoading={mutations.isPending}
                    disabled={returnReason.trim().length < 5}
                    onClick={() => void returnToSales(viewingOrder)}
                  >
                    Return to Sales
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={closeOrder}>
                    Close
                  </Button>
                  {["confirmed", "processing"].includes(viewingOrder.status) && (
                    <Button variant="secondary" onClick={() => setReturnMode(true)}>
                      Return to Sales
                    </Button>
                  )}
                  {viewingOrder.status === "confirmed" && (
                    <Button
                      isLoading={mutations.isPending}
                      onClick={() => {
                        void startProcessing(viewingOrder).then((started) => {
                          if (started) closeOrder();
                        });
                      }}
                    >
                      Start Processing
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : undefined
        }
      >
        {viewingOrder && (
          <div className="space-y-5">
            {returnMode && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <label className="block text-sm font-semibold text-amber-900" htmlFor="inventory-return-reason">
                  Reason for Sales <span className="text-red-600">*</span>
                </label>
                <p className="mt-1 text-xs text-amber-800">
                  Explain the stock issue or correction required. Sales will see this note before editing and resubmitting the order.
                </p>
                <Textarea
                  id="inventory-return-reason"
                  className="mt-3 bg-white"
                  rows={4}
                  maxLength={1000}
                  value={returnReason}
                  onChange={(event) => setReturnReason(event.target.value)}
                  placeholder="Example: Requested quantity is not available at the selected warehouse."
                />
              </div>
            )}
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <OrderDetail label="Status"><StatusBadge status={viewingOrder.status} /></OrderDetail>
              <OrderDetail label="Customer">{customers.data?.find((item) => item.id === viewingOrder.customerId)?.name ?? viewingOrder.customerName ?? viewingOrder.customerId}</OrderDetail>
              <OrderDetail label="Warehouse">{warehouses.data?.find((item) => item.id === viewingOrder.warehouseId)?.name ?? viewingOrder.warehouseId ?? "—"}</OrderDetail>
              <OrderDetail label="Order date">{viewingOrder.orderDate}</OrderDetail>
              <OrderDetail label="Expected delivery">{viewingOrder.expectedDeliveryDate}</OrderDetail>
              <OrderDetail label="Salesperson">{viewingOrder.salespersonName}</OrderDetail>
              <OrderDetail label="Payment terms">{viewingOrder.paymentTerms}</OrderDetail>
              <OrderDetail label="Delivery address">{viewingOrder.deliveryAddress}</OrderDetail>
              <OrderDetail label="Currency">{viewingOrder.currency}</OrderDetail>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Unit price</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right">Tax</th>
                    <th className="px-4 py-3 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingOrder.items.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{products.data?.find((item) => item.id === line.productId)?.name ?? line.description ?? line.productId}</td>
                      <td className="px-4 py-3 text-right">{line.quantity}</td>
                      <td className="px-4 py-3 text-right">{currency.formatMoneyInCurrency(line.unitPrice, viewingOrder.currency)}</td>
                      <td className="px-4 py-3 text-right">{line.discountPercent}%</td>
                      <td className="px-4 py-3 text-right">{line.taxPercent}%</td>
                      <td className="px-4 py-3 text-right font-medium">{currency.formatMoneyInCurrency(line.total, viewingOrder.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{viewingOrder.notes || "No order notes."}</p>
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
                <OrderTotal label="Subtotal" value={currency.formatMoneyInCurrency(viewingOrder.subtotal, viewingOrder.currency)} />
                <OrderTotal label="Discount" value={currency.formatMoneyInCurrency(viewingOrder.discountAmount, viewingOrder.currency)} />
                <OrderTotal label="Tax" value={currency.formatMoneyInCurrency(viewingOrder.taxAmount, viewingOrder.currency)} />
                <OrderTotal label="Order total" value={currency.formatMoneyInCurrency(viewingOrder.totalAmount, viewingOrder.currency)} emphasized />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}

function OrderDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}

function OrderTotal({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${emphasized ? "border-t border-slate-200 pt-2 font-semibold text-slate-900" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
