import { Archive, Boxes, CircleDollarSign, PackageCheck, ShoppingCart } from 'lucide-react';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { useTaxRates } from '@/features/settings/finance/tax';
import { Card } from '@/shared/components/common/Card';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { ProductListItem } from '../types/product';

interface ProductOverviewProps {
  product: ProductListItem;
  branchName?: string;
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function ProductOverview({ product, branchName }: ProductOverviewProps) {
  const currency = useTenantCurrency();
  const taxes = useTaxRates();
  const selectedTax = taxes.taxes.find((tax) => tax.code === product.taxCode);
  const taxLabel = !product.taxCode
    ? 'No tax / Tax exempt'
    : taxes.isLoading
      ? 'Loading Tax/VAT record…'
      : selectedTax
        ? `${selectedTax.name} (${selectedTax.percentage}%)`
        : `${product.taxCode} (unavailable)`;
  const margin = product.sellingPrice > 0
    ? ((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex items-start gap-3 p-4">
          <CircleDollarSign className="mt-0.5 text-blue-600" size={20} />
          <div><p className="text-xs font-medium text-slate-500">Selling Price</p><p className="mt-1 font-bold text-slate-900">{currency.formatMoney(product.sellingPrice)}</p></div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <ShoppingCart className="mt-0.5 text-slate-600" size={20} />
          <div><p className="text-xs font-medium text-slate-500">Purchase / Cost Price</p><p className="mt-1 font-bold text-slate-900">{currency.formatMoney(product.costPrice)}</p></div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <PackageCheck className="mt-0.5 text-emerald-600" size={20} />
          <div><p className="text-xs font-medium text-slate-500">Gross Margin</p><p className="mt-1 font-bold text-slate-900">{margin.toFixed(1)}%</p></div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <Archive className="mt-0.5 text-amber-600" size={20} />
          <div><p className="text-xs font-medium text-slate-500">Lifecycle Status</p><div className="mt-1"><StatusBadge status={product.status} /></div></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Product Overview</h2>
              <p className="mt-1 text-sm text-slate-500">Tenant-level master data used across sales and purchasing.</p>
            </div>
            {product.primaryImage && (
              <img
                src={product.primaryImage.previewUrl ?? product.primaryImage.url}
                alt={`${product.name} primary`}
                className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover sm:h-24 sm:w-24"
              />
            )}
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="SKU" value={<span className="font-mono">{product.sku}</span>} />
            <DetailItem label="Barcode" value={product.barcode ?? 'Not assigned'} />
            <DetailItem label="Barcode format" value={product.barcodeType?.replace('_', '-') ?? 'Not assigned'} />
            <DetailItem label="QR value" value={product.qrValue ?? 'Uses SKU by default'} />
            <DetailItem label="Internal code" value={product.internalCode ?? 'Not assigned'} />
            <DetailItem label="Category" value={product.categoryName} />
            <DetailItem label="Product type" value={product.type === 'composite' ? 'Composite / Bundle' : product.type} />
            <DetailItem label="Unit of measure" value={`${product.uomName} (${product.uomCode})`} />
            <DetailItem label="Brand" value={product.brand ?? 'Not assigned'} />
            <DetailItem label="Tax" value={taxLabel} />
            <DetailItem label="Tax treatment" value={product.taxCode ? product.pricesIncludeTax ? 'Price includes tax' : 'Tax added separately' : 'No tax applied'} />
            <DetailItem label="Sales" value={product.isSellable ? 'Enabled' : 'Not available'} />
            <DetailItem label="Purchasing" value={product.isPurchasable ? 'Enabled' : 'Not available'} />
            <DetailItem label="Inventory tracking" value={product.trackInventory ? 'Enabled' : 'Not tracked'} />
          </dl>
          {product.description && <p className="mt-5 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-600">{product.description}</p>}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Boxes className="text-blue-600" size={20} />
            <h2 className="text-base font-semibold text-slate-900">Branch Stock Summary</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">{branchName ?? 'Currently selected branch'}</p>
          {product.trackInventory ? (
            <dl className="mt-5 space-y-4">
              <DetailItem label="On hand" value={product.stock.quantityOnHand} />
              <DetailItem label="Reserved" value={product.stock.quantityReserved} />
              <DetailItem label="Available" value={product.stock.quantityAvailable} />
              <DetailItem label="Stock status" value={<StatusBadge status={product.stock.status} />} />
            </dl>
          ) : (
            <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Inventory is not tracked for this product.</p>
          )}
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            Detailed movements, valuation and warehouse balances will be managed in Inventory.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Wholesale / Price Tiers</h2>
        <p className="mt-1 text-sm text-slate-500">Tenant-level quantity pricing; discounts and supplier pricing are managed separately.</p>
        {product.priceTiers.length ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Tier</th><th className="px-4 py-3 text-right">Minimum quantity</th><th className="px-4 py-3 text-right">Unit price</th></tr></thead>
              <tbody className="divide-y divide-slate-200">{product.priceTiers.map((tier) => <tr key={tier.id}><td className="px-4 py-3 font-medium text-slate-900">{tier.name}</td><td className="px-4 py-3 text-right text-slate-700">{tier.minimumQuantity}</td><td className="px-4 py-3 text-right font-semibold text-slate-900">{currency.formatMoney(tier.price)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No wholesale price tiers configured.</p>}
      </Card>

      {product.trackInventory && (
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Inventory Controls</h2>
          <p className="mt-1 text-sm text-slate-500">Product-level thresholds for future alerts and replenishment. These are not current branch quantities.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {product.trackByBatch && <StatusBadge status="batch_tracking" tone="success" label="Batch tracking" />}
            {product.trackBySerialNumber && <StatusBadge status="serial_tracking" tone="primary" label="Serial number tracking" />}
            {product.trackExpiry && <StatusBadge status="expiry_tracking" tone="warning" label="Expiry tracking" />}
            {!product.trackByBatch && !product.trackBySerialNumber && !product.trackExpiry && <StatusBadge status="standard_tracking" label="Standard quantity tracking" />}
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <DetailItem label="Minimum stock" value={product.minStockLevel ?? 'Not set'} />
            <DetailItem label="Reorder level" value={product.reorderLevel ?? 'Not set'} />
            <DetailItem label="Maximum stock" value={product.maxStockLevel ?? 'Not set'} />
          </dl>
        </Card>
      )}
    </div>
  );
}
