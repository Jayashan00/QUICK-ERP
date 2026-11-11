import { useEffect } from 'react';
import { Select } from '@/shared/components/forms/Select';
import { usePaymentTerms } from '@/features/settings/finance/hooks/useTenantSettings';
import { matchPaymentTerm } from '@/features/settings/finance/paymentTerms';
import type { PaymentTerm } from '@/features/settings/finance/types/tenant-settings';

interface PaymentTermSelectProps {
  id?: string;
  value?: string;
  onChange: (code: string, term: PaymentTerm) => void;
  error?: boolean;
  required?: boolean;
  disabled?: boolean;
  'aria-describedby'?: string;
}

export function PaymentTermSelect({ value, onChange, ...props }: PaymentTermSelectProps) {
  const { terms, isLoading } = usePaymentTerms();
  const activeTerms = terms.filter((term) => term.isActive);
  const selected = matchPaymentTerm(terms, value);
  const defaultTerm = activeTerms.find((term) => term.isDefault) ?? activeTerms[0];
  useEffect(() => {
    if (!value && defaultTerm) onChange(defaultTerm.code, defaultTerm);
  }, [defaultTerm, onChange, value]);
  const options = activeTerms.map((term) => ({
    value: term.code,
    label: `${term.name} (${term.dueDays === 0 ? 'Due immediately' : `${term.dueDays} days`})${term.isDefault ? ' - Default' : ''}`,
  }));
  if (selected && !selected.isActive) {
    options.unshift({ value: selected.code, label: `${selected.name} (Inactive)` });
  }

  return (
    <Select
      {...props}
      value={selected?.code ?? value ?? ''}
      disabled={props.disabled || isLoading}
      placeholder={isLoading ? 'Loading payment terms...' : 'Select payment terms'}
      options={options}
      onChange={(event) => {
        const term = activeTerms.find((item) => item.code === event.target.value);
        if (term) onChange(term.code, term);
      }}
    />
  );
}
