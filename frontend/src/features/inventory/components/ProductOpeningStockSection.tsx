import { useEffect } from 'react';
import { useBranch } from '@/core/branch/branch-context';
import { Card } from '@/shared/components/common/Card';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSection } from '@/shared/components/forms/FormSection';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Select } from '@/shared/components/forms/Select';
import { Switch } from '@/shared/components/forms/Switch';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { useStockLocationOptions } from '../hooks/useStockLocationManagement';
import { useWarehouseOptions } from '../hooks/useWarehouseManagement';
import type { OpeningStockFormValues } from '../schemas/inventorySchemas';

interface ProductOpeningStockSectionProps {
  enabled: boolean;
  canRecord: boolean;
  value: OpeningStockFormValues;
  errors: Record<string, string>;
  trackByBatch: boolean;
  trackBySerialNumber: boolean;
  trackExpiry: boolean;
  costPrice: number;
  currency: string;
  onEnabledChange: (enabled: boolean) => void;
  onChange: (value: OpeningStockFormValues) => void;
}

const option = (item: { id: string; name: string; code: string }) => ({
  value: item.id,
  label: `${item.name} (${item.code})`,
});

export function ProductOpeningStockSection({
  enabled,
  canRecord,
  value,
  errors,
  trackByBatch,
  trackBySerialNumber,
  trackExpiry,
  costPrice,
  currency,
  onEnabledChange,
  onChange,
}: ProductOpeningStockSectionProps) {
  const { branchId, branches } = useBranch();
  const warehouses = useWarehouseOptions(value.branchId || branchId || undefined);
  const locations = useStockLocationOptions(value.warehouseId || undefined);
  const change = (patch: Partial<OpeningStockFormValues>) => onChange({ ...value, ...patch });

  useEffect(() => {
    if (!value.branchId && branchId) onChange({ ...value, branchId });
  }, [branchId, onChange, value]);

  return (
    <Card>
      <FormSection
        title="Opening Stock"
        description="Optionally create the first branch and location stock balance together with this product. Later replenishment must use Goods Receipts."
      >
        <Switch
          checked={enabled}
          disabled={!canRecord}
          onChange={(event) => onEnabledChange(event.target.checked)}
          label="Record opening stock when this product is created"
        />
        {!canRecord && (
          <p className="mt-2 text-sm text-amber-700">Stock adjustment and approval permissions are required to record an opening balance.</p>
        )}
        {enabled && canRecord && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Branch" required error={errors.branchId}>
                <Select
                  value={value.branchId}
                  options={branches.filter((branch) => branch.isActive).map(option)}
                  placeholder="Select branch..."
                  onChange={(event) => change({ branchId: event.target.value, warehouseId: '', locationId: '' })}
                />
              </FormField>
              <FormField label="Warehouse" required error={errors.warehouseId}>
                <Select
                  value={value.warehouseId}
                  options={(warehouses.data ?? []).filter((warehouse) => warehouse.isActive).map(option)}
                  placeholder={warehouses.isLoading ? 'Loading warehouses...' : 'Select warehouse...'}
                  disabled={!value.branchId || warehouses.isLoading}
                  onChange={(event) => change({ warehouseId: event.target.value, locationId: '' })}
                />
              </FormField>
              <FormField label="Stock location" required error={errors.locationId}>
                <Select
                  value={value.locationId}
                  options={(locations.data ?? []).filter((location) => location.isActive).map(option)}
                  placeholder={locations.isLoading ? 'Loading locations...' : 'Select location...'}
                  disabled={!value.warehouseId || locations.isLoading}
                  onChange={(event) => change({ locationId: event.target.value })}
                />
              </FormField>
              <FormField label="Opening quantity" required error={errors.quantity}>
                <NumberInput min={0.01} value={value.quantity || ''} onChange={(quantity) => change({ quantity: quantity === '' ? 0 : quantity })} />
              </FormField>
            </div>

            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Opening stock valuation uses the product cost price: <strong>{costPrice.toLocaleString()} {currency}</strong> per unit.
            </p>

            {(trackByBatch || trackBySerialNumber) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {trackByBatch && (
                  <FormField label="Batch reference" required error={errors.batchReference}>
                    <TextInput value={value.batchReference ?? ''} onChange={(event) => change({ batchReference: event.target.value })} placeholder="e.g. OPEN-2026-001" />
                  </FormField>
                )}
                {trackExpiry && (
                  <FormField label="Expiry date" required error={errors.expiryDate}>
                    <TextInput type="date" value={value.expiryDate ?? ''} onChange={(event) => change({ expiryDate: event.target.value })} />
                  </FormField>
                )}
                {trackBySerialNumber && (
                  <FormField label="Serial numbers" required error={errors.serialReferences} hint="Enter one unique serial number per unit, separated by commas or new lines." className="sm:col-span-2">
                    <Textarea
                      rows={4}
                      value={value.serialReferences.join('\n')}
                      onChange={(event) => change({ serialReferences: event.target.value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean) })}
                    />
                  </FormField>
                )}
              </div>
            )}

            <FormField label="Opening stock notes" error={errors.notes}>
              <Textarea rows={2} value={value.notes ?? ''} onChange={(event) => change({ notes: event.target.value })} placeholder="Optional migration or opening balance reference" />
            </FormField>
          </div>
        )}
      </FormSection>
    </Card>
  );
}
