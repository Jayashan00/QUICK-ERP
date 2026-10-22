import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { Select } from '@/shared/components/forms/Select';
import { appToast } from '@/shared/utils/toast';
import type { ProductListItem } from '../types/product';

type LabelSize = 'small' | 'standard' | 'shelf';
type LabelType = 'barcode' | 'qr' | 'combined';

interface ProductLabelPreviewProps {
  product: ProductListItem;
  canPrint: boolean;
}

const sizeOptions = [
  { value: 'small', label: 'Small - 38 x 25 mm' },
  { value: 'standard', label: 'Standard - 50 x 30 mm' },
  { value: 'shelf', label: 'Shelf - 70 x 40 mm' },
];

const typeOptions = [
  { value: 'barcode', label: 'Barcode Label' },
  { value: 'qr', label: 'QR Label' },
  { value: 'combined', label: 'Barcode + QR' },
];

function BarcodeGraphic({ value }: { value: string }) {
  const bars = useMemo(() => Array.from({ length: 42 }, (_, index) => {
    const code = value.charCodeAt(index % Math.max(value.length, 1)) || index;
    return 1 + ((code + index) % 3);
  }), [value]);
  return <div role="img" aria-label={`Mock barcode preview for ${value}`} className="flex h-14 items-stretch justify-center gap-px overflow-hidden bg-white px-2 py-1">{bars.map((width, index) => <span key={index} className="bg-slate-950" style={{ width: `${width}px` }} />)}</div>;
}

function QrGraphic({ value }: { value: string }) {
  const cells = useMemo(() => Array.from({ length: 121 }, (_, index) => {
    const row = Math.floor(index / 11);
    const column = index % 11;
    const finder = ((row < 3 && column < 3) || (row < 3 && column > 7) || (row > 7 && column < 3));
    const code = value.charCodeAt(index % Math.max(value.length, 1)) || index;
    return finder || (code + row * 7 + column * 11) % 3 === 0;
  }), [value]);
  return <div role="img" aria-label={`Mock QR preview for ${value}`} className="grid size-20 grid-cols-11 gap-px bg-white p-1">{cells.map((filled, index) => <span key={index} className={filled ? 'bg-slate-950' : 'bg-white'} />)}</div>;
}

export function ProductLabelPreview({ product, canPrint }: ProductLabelPreviewProps) {
  const currency = useTenantCurrency();
  const [size, setSize] = useState<LabelSize>('standard');
  const [type, setType] = useState<LabelType>(product.barcode ? 'combined' : 'qr');
  const barcodeValue = product.barcode ?? product.sku;
  const qrValue = product.qrValue ?? product.sku;
  const sizeClasses: Record<LabelSize, string> = {
    small: 'max-w-xs min-h-48',
    standard: 'max-w-sm min-h-56',
    shelf: 'max-w-md min-h-64',
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Product Label / QR Preview</h2>
          <p className="mt-1 text-sm text-slate-500">Frontend preview only. Printer hardware remains configured in Settings.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select aria-label="Label size" options={sizeOptions} value={size} onChange={(event) => setSize(event.target.value as LabelSize)} />
          <Select aria-label="Label type" options={typeOptions} value={type} onChange={(event) => setType(event.target.value as LabelType)} />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-100 p-5">
        <div className={`mx-auto flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 shadow-sm ${sizeClasses[size]}`}>
          <div>
            <p className="truncate text-sm font-bold text-slate-950">{product.name}</p>
            <p className="mt-1 font-mono text-xs text-slate-600">SKU: {product.sku}</p>
          </div>
          <div className="my-3 flex items-center justify-center gap-4">
            {(type === 'barcode' || type === 'combined') && <div className="min-w-0 flex-1"><BarcodeGraphic value={barcodeValue} /><p className="mt-1 truncate text-center font-mono text-[10px] text-slate-600">{barcodeValue}</p></div>}
            {(type === 'qr' || type === 'combined') && <QrGraphic value={qrValue} />}
          </div>
          <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-2">
            <span className="text-[10px] text-slate-500">{product.categoryName} · {product.uomCode}</span>
            <span className="text-base font-bold text-slate-950">{currency.formatMoney(product.sellingPrice)}</span>
          </div>
        </div>
      </div>

      {canPrint ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" leftIcon={<Download size={16} />} onClick={() => appToast.success('Label preview download prepared (mock).')}>Download Preview</Button>
          <Button leftIcon={<Printer size={16} />} onClick={() => appToast.success('Label sent to the mock print queue.')}>Print Label</Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">You do not have permission to print or download product labels.</p>
      )}
    </Card>
  );
}
