import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Landmark, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { TextInput } from '@/shared/components/forms/TextInput';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PERMISSIONS } from '@/core/permissions';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import type { SettlementBankAccountSettings } from '@/features/settings/integrations/types/integration-settings';
import { useSettlementBankAccount } from '@/features/settings/integrations/hooks/useIntegrationSettings';
import {
  settlementBankAccountSchema,
  type SettlementBankAccountValues,
} from '@/features/settings/integrations/schemas/integrationSettingsSchemas';

const currencyOptions = [
  { value: 'LKR', label: 'LKR - Sri Lankan Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Pound Sterling' },
];

export function SettlementBankAccountPage() {
  const data = useSettlementBankAccount();

  if (data.isLoading) {
    return <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div>;
  }

  if (data.error || !data.settings) {
    return <ErrorState message={data.error ?? 'Settlement bank details are unavailable.'} onRetry={() => void data.refetch()} />;
  }

  return <SettlementBankAccountForm settings={data.settings} data={data} />;
}

function SettlementBankAccountForm({
  settings,
  data,
}: {
  settings: SettlementBankAccountSettings;
  data: ReturnType<typeof useSettlementBankAccount>;
}) {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.INTEGRATIONS.SETTLEMENT_BANK_EDIT);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettlementBankAccountValues>({
    resolver: zodResolver(settlementBankAccountSchema),
    values: {
      accountHolderName: settings.accountHolderName,
      bankName: settings.bankName,
      branchName: settings.branchName,
      bankCode: settings.bankCode,
      branchCode: settings.branchCode,
      currency: settings.currency,
      accountNumber: '',
    },
  });

  const submit = async (values: SettlementBankAccountValues) => {
    try {
      await data.save(values);
      appToast.success('Settlement bank details saved for verification.');
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to save settlement bank details.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlement Bank Account"
        description="Provide the bank account where your company receives settlements and payouts."
        actions={<StatusBadge status={settings.status} />}
      />

      <Card className="border-sky-200 bg-sky-50/60">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-sky-700" size={20} />
          <div>
            <p className="font-semibold text-sky-900">Quick ERP manages online payments</p>
            <p className="mt-1 text-sm text-sky-800">
              Payment providers, merchant credentials, environments, callbacks, webhooks, and payment routing are managed securely by the platform. You only provide settlement bank details.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <form className="space-y-5" onSubmit={handleSubmit(submit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Account holder name" required error={errors.accountHolderName?.message}>
              <TextInput disabled={!canEdit} {...register('accountHolderName')} />
            </FormField>
            <FormField label="Bank name" required error={errors.bankName?.message}>
              <TextInput disabled={!canEdit} {...register('bankName')} />
            </FormField>
            <FormField label="Branch name" required error={errors.branchName?.message}>
              <TextInput disabled={!canEdit} {...register('branchName')} />
            </FormField>
            <FormField label="Currency" required error={errors.currency?.message}>
              <Select disabled={!canEdit} options={currencyOptions} {...register('currency')} />
            </FormField>
            <FormField label="Bank code" required error={errors.bankCode?.message}>
              <TextInput disabled={!canEdit} {...register('bankCode')} />
            </FormField>
            <FormField label="Branch code" required error={errors.branchCode?.message}>
              <TextInput disabled={!canEdit} {...register('branchCode')} />
            </FormField>
          </div>

          <FormField
            label="Bank account number"
            required={!settings.hasAccountNumber}
            error={errors.accountNumber?.message}
            hint={settings.hasAccountNumber ? `Saved account: ${settings.accountNumberMasked}. Leave blank to keep it.` : 'Enter the account number used for settlements.'}
          >
            <TextInput
              type="password"
              autoComplete="off"
              disabled={!canEdit}
              placeholder={settings.hasAccountNumber ? settings.accountNumberMasked : 'Enter account number'}
              {...register('accountNumber')}
            />
          </FormField>

          {settings.hasAccountNumber && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <Landmark size={15} />
              Bank account number is stored securely and displayed only as {settings.accountNumberMasked}.
            </div>
          )}

          {canEdit && (
            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button type="submit" leftIcon={<Save size={16} />} isLoading={data.isSaving || isSubmitting}>
                Save Bank Details
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
