import { useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Check, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Select } from '@/shared/components/forms/Select';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import type { Account, AccountType, Journal, JournalLine, OpeningBalance } from './accountingService';

const date = z.iso.date('Please enter a valid date in YYYY-MM-DD format.');
const positive = z.coerce.number<number>().positive('Amount must be greater than zero. Please enter a positive amount.');
const nonNegative = z.coerce.number<number>().min(0, 'Amount cannot be negative. Please enter an amount of 0.00 or higher.');
const accountSchema = z.object({
  code: z.string().trim().min(1, 'Account code is required. Please enter an account code.'),
  name: z.string().trim().min(1, 'Account name is required. Please enter an account name.'),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'], { error: 'Please select an account type from the dropdown.' }),
  parentId: z.string(),
  active: z.boolean(),
  cashKind: z.enum(['cash', 'bank']).or(z.literal('')),
  cashFlowCategory: z.enum(['operating', 'investing', 'financing']).or(z.literal('')),
});
const openingSchema = z.object({
  accountId: z.string().trim().min(1, 'Please select an account from the dropdown.'),
  partyId: z.string().optional().or(z.literal('')),
  date: z.iso.date('Please enter a valid date in YYYY-MM-DD format.'),
  reference: z.string().trim().min(1, 'Reference is required. Please enter a reference.'),
  amount: z.coerce.number<number>().positive('Amount must be greater than zero. Please enter a valid positive amount.'),
  side: z.enum(['debit', 'credit'], { error: 'Please select debit or credit.' }),
});

const journalDate = z.string().trim().min(1, 'Date is required. Please select or enter a valid date in YYYY-MM-DD format.');
const journalReference = z.string().trim().min(1, 'Reference is required. Please enter a journal reference.');
const journalLineSchema = z.object({
  accountId: z.string().trim().min(1, 'Please select an account from the dropdown.'),
  debit: nonNegative,
  credit: nonNegative,
  costCenterId: z.string().optional(),
});

export function createJournalSchema(accounts: Account[], accountBalances?: Record<string, number>) {
  return z.object({
    date: journalDate,
    reference: journalReference,
    notes: z.string(),
    lines: z.array(journalLineSchema).min(2, 'At least two journal lines are required.'),
  }).superRefine((value, context) => {
    const totalDebit = Math.round(value.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0) * 100);
    const totalCredit = Math.round(value.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0) * 100);
    const hasDualEntry = value.lines.some((line) => line.debit > 0 && line.credit > 0);
    const hasEmptyLine = value.lines.some((line) => (Number(line.debit) || 0) <= 0 && (Number(line.credit) || 0) <= 0);

    if (hasDualEntry) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Enter either a debit or credit amount per line, not both.',
      });
    } else if (hasEmptyLine) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Each line must have either a debit or credit amount. Total Debit and Credit amounts must be equal.',
      });
    } else if (totalDebit !== totalCredit || totalDebit === 0) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Total Debit and Credit amounts must be equal.',
      });
    }

    // Check same account selected for both Debit and Credit lines within a single Journal Entry
    const debitAccountIds = new Set(value.lines.filter((line) => line.debit > 0 && line.accountId).map((line) => line.accountId));
    let hasDuplicate = false;
    for (let i = 0; i < value.lines.length; i++) {
      const line = value.lines[i];
      if (line.credit > 0 && line.accountId && debitAccountIds.has(line.accountId)) {
        hasDuplicate = true;
        context.addIssue({
          code: 'custom',
          path: ['lines', i, 'accountId'],
          message: 'The same account cannot be selected for both Debit and Credit.',
        });
      }
    }
    if (hasDuplicate) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'The same account cannot be selected for both Debit and Credit lines within a single Journal Entry.',
      });
    }

    // Check transfers exceeding available account balance
    if (accountBalances) {
      const creditSums = new Map<string, number>();
      for (const line of value.lines) {
        if (line.credit > 0 && line.accountId) {
          creditSums.set(line.accountId, (creditSums.get(line.accountId) ?? 0) + Number(line.credit));
        }
      }

      for (const [accountId, totalCredit] of creditSums.entries()) {
        const account = accounts.find((a) => a.id === accountId);
        const available = accountBalances[accountId] ?? 0;
        const isRestricted = account && (Boolean(account.cashKind) || (account.type === 'asset' && available > 0));
        if (isRestricted && totalCredit > available) {
          const accName = account ? `${account.code} · ${account.name}` : accountId;
          const formattedAvail = available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const formattedTransfer = totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          context.addIssue({
            code: 'custom',
            path: ['lines'],
            message: `Insufficient balance: Transfer amount (${formattedTransfer}) exceeds available balance (${formattedAvail}) for account ${accName}.`,
          });
          value.lines.forEach((line, index) => {
            if (line.accountId === accountId && line.credit > 0) {
              context.addIssue({
                code: 'custom',
                path: ['lines', index, 'credit'],
                message: `Insufficient balance. Available: ${formattedAvail}`,
              });
            }
          });
        }
      }
    }
  });
}

export const journalSchema = createJournalSchema([]);
const settlementSchema = z.object({ documentId: z.string().min(1), date, amount: positive, accountId: z.string().min(1) });
const expenseSchema = z.object({ date, reference: z.string().trim().min(1), category: z.string().trim().min(1), amount: positive, accountId: z.string().min(1), costCenterId: z.string(), notes: z.string() });
const referenceSchema = z.object({ date, reference: z.string().trim().min(1), name: z.string().trim().min(1), amount: nonNegative, status: z.string().trim().min(1), notes: z.string() });
const today = new Date().toISOString().slice(0, 10);
const options = (accounts: Account[], types?: AccountType[], balances?: Record<string, number>) =>
  accounts
    .filter((account) => account.active && (!types || types.includes(account.type)))
    .map((account) => {
      const bal = balances?.[account.id];
      const balText = bal !== undefined ? ` · Balance: ${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
      return { value: account.id, label: `${account.code} · ${account.name}${balText}` };
    });

export function AccountForm({ accounts, onSave, onCancel, initial }: { accounts: Account[]; onSave: (value: z.infer<typeof accountSchema>) => Promise<void>; onCancel: () => void; initial?: Account }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof accountSchema>>({ resolver: zodResolver(accountSchema), defaultValues: { code: initial?.code ?? '', name: initial?.name ?? '', type: initial?.type ?? 'asset', parentId: initial?.parentId ?? '', active: initial?.active ?? true, cashKind: initial?.cashKind ?? '', cashFlowCategory: initial?.cashFlowCategory ?? '' } });
  return <form className="space-y-4" onSubmit={handleSubmit(onSave)}><div className="grid gap-4 sm:grid-cols-2"><FormField label="Code" required error={errors.code?.message}><TextInput {...register('code')} /></FormField><FormField label="Name" required error={errors.name?.message}><TextInput {...register('name')} /></FormField><FormField label="Type"><Select {...register('type')} options={['asset', 'liability', 'equity', 'revenue', 'expense'].map((value) => ({ value, label: value }))} /></FormField><FormField label="Parent account"><Select {...register('parentId')} options={[{ value: '', label: 'None' }, ...options(accounts).filter((row) => row.value !== initial?.id)]} /></FormField><FormField label="Cash / bank classification"><Select {...register('cashKind')} options={[{ value: '', label: 'Not a cash account' }, { value: 'cash', label: 'Cash on hand' }, { value: 'bank', label: 'Bank account' }]} /></FormField><FormField label="Cash flow category"><Select {...register('cashFlowCategory')} options={[{ value: '', label: 'Unclassified' }, { value: 'operating', label: 'Operating' }, { value: 'investing', label: 'Investing' }, { value: 'financing', label: 'Financing' }]} /></FormField></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('active')} /> Active</label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" isLoading={isSubmitting}>Save account</Button></div></form>;
}

export function OpeningForm({ accounts, onSave, onCancel, initial }: { accounts: Account[]; onSave: (value: z.infer<typeof openingSchema>) => Promise<void>; onCancel: () => void; initial?: OpeningBalance }) {
  const { currencyCode } = useTenantCurrency();
  const baseCurrency = currencyCode ?? 'LKR';
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(openingSchema),
    defaultValues: {
      accountId: initial?.accountId ?? '',
      partyId: initial?.partyId ?? '',
      date: initial?.date ?? today,
      reference: initial?.reference ?? '',
      amount: initial?.amount ?? 0,
      side: initial?.side ?? ('debit' as const),
    },
  });
  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSave)}>
      <FormField label="Account" required error={errors.accountId?.message}>
        <Select {...register('accountId')} options={[{ value: '', label: 'Select account' }, ...options(accounts)]} error={Boolean(errors.accountId)} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date" required error={errors.date?.message}>
          <DatePicker {...register('date')} error={Boolean(errors.date)} />
        </FormField>
        <FormField label="Reference" required error={errors.reference?.message}>
          <TextInput {...register('reference')} error={Boolean(errors.reference)} />
        </FormField>
        <FormField label={`Amount (${baseCurrency})`} required error={errors.amount?.message}>
          <Controller name="amount" control={control} render={({ field }) => <CurrencyInput ref={field.ref} name={field.name} onBlur={field.onBlur} value={field.value} onChange={field.onChange} currency={baseCurrency} min={0.01} error={Boolean(errors.amount)} />} />
        </FormField>
        <FormField label="Side">
          <Select {...register('side')} options={[{ value: 'debit', label: 'Debit' }, { value: 'credit', label: 'Credit' }]} />
        </FormField>
      </div>
      <p className="text-sm text-slate-500">Enter this opening balance in the tenant base currency: {baseCurrency}.</p>
      <FormField label="Customer or supplier ID (optional)">
        <TextInput {...register('partyId')} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isSubmitting}>{initial ? 'Update balance' : 'Save balance'}</Button>
      </div>
    </form>
  );
}

export function JournalForm({ accounts, onSave, onCancel, initial, accountBalances }: { accounts: Account[]; onSave: (value: { date: string; reference: string; notes: string; lines: JournalLine[]; attachments: { name: string; size: number }[] }) => Promise<void>; onCancel: () => void; initial?: Journal; accountBalances?: Record<string, number> }) {
  const schema = useMemo(() => createJournalSchema(accounts, accountBalances), [accounts, accountBalances]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      date: initial?.date ?? today,
      reference: initial?.reference ?? '',
      notes: initial?.notes ?? '',
      lines: initial?.lines ?? [
        { accountId: '', debit: 0, credit: 0 },
        { accountId: '', debit: 0, credit: 0 },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const watchedLines = watch('lines');
  const totalDebit = (watchedLines ?? []).reduce((sum, line) => sum + (Number(line?.debit) || 0), 0);
  const totalCredit = (watchedLines ?? []).reduce((sum, line) => sum + (Number(line?.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = totalDebit > 0 && difference < 0.005;
  const linesError = errors.lines?.root?.message || (typeof errors.lines?.message === 'string' ? errors.lines.message : undefined);

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((value) =>
        onSave({
          ...value,
          attachments: file
            ? [{ name: file.name, size: file.size }]
            : initial?.attachments ?? [],
        })
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date" required error={errors.date?.message}>
          <DatePicker {...register('date')} error={Boolean(errors.date)} />
        </FormField>
        <FormField label="Reference" required error={errors.reference?.message}>
          <TextInput {...register('reference')} error={Boolean(errors.reference)} />
        </FormField>
      </div>

      <FormField label="Notes">
        <TextInput {...register('notes')} />
      </FormField>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-900">Debit and credit lines</h3>
          <span className="text-xs text-slate-500">Minimum 2 lines required</span>
        </div>

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"
          >
            <FormField
              label="Account"
              required
              error={errors.lines?.[index]?.accountId?.message}
            >
              <Select
                {...register(`lines.${index}.accountId`)}
                options={[{ value: '', label: 'Select account' }, ...options(accounts, undefined, accountBalances)]}
                error={Boolean(errors.lines?.[index]?.accountId)}
              />
              {watchedLines?.[index]?.accountId && accountBalances?.[watchedLines[index].accountId] !== undefined && (
                <p className="mt-1 text-xs text-slate-500">
                  Available balance: <span className="font-medium text-slate-700">{accountBalances[watchedLines[index].accountId].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </p>
              )}
            </FormField>
            <FormField
              label="Debit"
              error={errors.lines?.[index]?.debit?.message}
            >
              <TextInput
                type="number"
                min="0"
                step="0.01"
                {...register(`lines.${index}.debit`)}
                error={Boolean(errors.lines?.[index]?.debit)}
              />
            </FormField>
            <FormField
              label="Credit"
              error={errors.lines?.[index]?.credit?.message}
            >
              <TextInput
                type="number"
                min="0"
                step="0.01"
                {...register(`lines.${index}.credit`)}
                error={Boolean(errors.lines?.[index]?.credit)}
              />
            </FormField>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 shadow-sm"
              leftIcon={<Trash2 size={13} />}
              disabled={fields.length <= 2}
              onClick={() => remove(index)}
            >
              Remove
            </Button>
          </div>
        ))}

        {/* Live debit/credit summary and balance indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <span className="text-slate-500">Total Debit: </span>
              <span className="font-semibold text-slate-900">{totalDebit.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500">Total Credit: </span>
              <span className="font-semibold text-slate-900">{totalCredit.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500">Difference: </span>
              <span className={difference > 0.005 ? 'font-semibold text-red-600' : 'font-semibold text-slate-900'}>
                {difference.toFixed(2)}
              </span>
            </div>
          </div>
          <div>
            {totalDebit === 0 && totalCredit === 0 ? (
              <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                Empty
              </span>
            ) : isBalanced ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <Check size={12} /> Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                <AlertCircle size={12} /> Out of balance
              </span>
            )}
          </div>
        </div>

        {linesError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{linesError}</span>
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          className="shadow-sm"
          leftIcon={<Plus size={15} />}
          onClick={() => append({ accountId: '', debit: 0, credit: 0 })}
        >
          Add line
        </Button>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Attachment</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="secondary"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
            leftIcon={<Paperclip size={15} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {file || initial?.attachments?.[0] ? 'Change attachment' : 'Attach file'}
          </Button>
          {(file || initial?.attachments?.[0]) && (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 shadow-sm">
              <Paperclip size={13} className="text-slate-500" />
              <span className="max-w-xs truncate font-medium">
                {file ? file.name : initial?.attachments?.[0]?.name}
              </span>
              <span className="text-slate-500">
                ({Math.round((file ? file.size : initial?.attachments?.[0]?.size ?? 0) / 1024)} KB)
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="ml-1 text-slate-400 hover:text-red-600 focus:outline-none"
                title="Remove attachment"
                aria-label="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          Save draft
        </Button>
      </div>
    </form>
  );
}

export function SettlementForm({ accounts, documents, initialDocumentId = '', mode, systemCurrency, formatMoney, onSave, onCancel, accountBalances }: { accounts: Account[]; documents: { id: string; reference: string; outstanding: number }[]; initialDocumentId?: string; mode: 'receipt' | 'payment'; systemCurrency: string; formatMoney: (amount: number) => string; onSave: (value: z.infer<typeof settlementSchema>) => Promise<void>; onCancel: () => void; accountBalances?: Record<string, number> }) {
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(settlementSchema), defaultValues: { documentId: initialDocumentId, date: today, amount: 0, accountId: '' } });
  const selected = documents.find((row) => row.id === watch('documentId'));
  const selectedAccountId = watch('accountId');
  const availableBal = selectedAccountId && accountBalances ? accountBalances[selectedAccountId] : undefined;
  const amountLabel = mode === 'receipt' ? 'Amount to receive' : 'Amount to pay';

  const submitSettlement = (value: z.infer<typeof settlementSchema>) => {
    if (mode === 'payment' && availableBal !== undefined && value.amount > availableBal) {
      setBalanceError(`Insufficient balance: Transfer amount (${formatMoney(value.amount)}) exceeds available balance (${formatMoney(availableBal)}).`);
      return;
    }
    setBalanceError(null);
    return onSave(value);
  };

  return <form className="space-y-4" onSubmit={handleSubmit(submitSettlement)}><FormField label="Invoice" required error={errors.documentId?.message}><Select {...register('documentId')} options={[{ value: '', label: 'Select invoice' }, ...documents.filter((row) => row.outstanding > 0).map((row) => ({ value: row.id, label: row.reference }))]} /></FormField>{selected && <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Outstanding amount</p><p className="mt-1 text-2xl font-semibold text-violet-950">{formatMoney(selected.outstanding)}</p><p className="mt-1 text-xs text-violet-700">Enter the settlement in the system currency. It cannot exceed this invoice balance.</p></div>}<div className="grid gap-4 sm:grid-cols-2"><FormField label="Date" required error={errors.date?.message}><DatePicker {...register('date')} /></FormField><FormField label={`${amountLabel} (${systemCurrency})`} required error={errors.amount?.message}><Controller name="amount" control={control} render={({ field }) => <CurrencyInput ref={field.ref} name={field.name} onBlur={field.onBlur} value={field.value} onChange={field.onChange} currency={systemCurrency} min={0.01} max={selected?.outstanding} error={Boolean(errors.amount)} />} /></FormField><FormField label="Cash or bank account" required error={errors.accountId?.message}><Select {...register('accountId')} options={[{ value: '', label: 'Select account' }, ...options(accounts.filter((account) => Boolean(account.cashKind)), undefined, accountBalances)]} />{selectedAccountId && availableBal !== undefined && (<p className="mt-1 text-xs text-slate-500">Available balance: <span className="font-medium text-slate-700">{formatMoney(availableBal)}</span></p>)}</FormField></div>{balanceError && (<div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert"><AlertCircle className="size-4 shrink-0 text-red-600" /><span>{balanceError}</span></div>)}<p className="text-sm text-slate-500">Only active cash ledgers and bank accounts linked from company settings are available. The document reference is assigned automatically.</p><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" isLoading={isSubmitting}>Record settlement</Button></div></form>;
}

export function ExpenseForm({ accounts, costCenters, onSave, onCancel }: { accounts: Account[]; costCenters: { id: string; name: string }[]; onSave: (value: z.infer<typeof expenseSchema> & { attachment?: string }) => Promise<void>; onCancel: () => void }) {
  const { currencyCode } = useTenantCurrency();
  const baseCurrency = currencyCode ?? 'LKR';
  const expenseFileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(expenseSchema), defaultValues: { date: today, reference: '', category: '', amount: 0, accountId: '', costCenterId: '', notes: '' } });
  return (
    <form className="space-y-4" onSubmit={handleSubmit((value) => onSave({ ...value, attachment: file?.name }))}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date" required error={errors.date?.message}><DatePicker {...register('date')} /></FormField>
        <FormField label="Reference" required error={errors.reference?.message}><TextInput {...register('reference')} /></FormField>
        <FormField label="Category" required error={errors.category?.message}><TextInput {...register('category')} /></FormField>
        <FormField label={`Amount (${baseCurrency})`} required error={errors.amount?.message}><Controller name="amount" control={control} render={({ field }) => <CurrencyInput ref={field.ref} name={field.name} onBlur={field.onBlur} value={field.value} onChange={field.onChange} currency={baseCurrency} min={0.01} error={Boolean(errors.amount)} />} /></FormField>
        <FormField label="Expense account" required error={errors.accountId?.message}><Select {...register('accountId')} options={[{ value: '', label: 'Select account' }, ...options(accounts, ['expense'])]} /></FormField>
        <FormField label="Cost center"><Select {...register('costCenterId')} options={[{ value: '', label: 'None' }, ...costCenters.map((row) => ({ value: row.id, label: row.name }))]} /></FormField>
      </div>
      <p className="text-sm text-slate-500">Enter this expense in the tenant base currency: {baseCurrency}.</p>
      <FormField label="Notes"><TextInput {...register('notes')} /></FormField>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Attachment</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={expenseFileInputRef}
            type="file"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="secondary"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
            leftIcon={<Paperclip size={15} />}
            onClick={() => expenseFileInputRef.current?.click()}
          >
            {file ? 'Change attachment' : 'Attach file'}
          </Button>
          {file && (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 shadow-sm">
              <Paperclip size={13} className="text-slate-500" />
              <span className="max-w-xs truncate font-medium">{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (expenseFileInputRef.current) expenseFileInputRef.current.value = '';
                }}
                className="ml-1 text-slate-400 hover:text-red-600 focus:outline-none"
                title="Remove attachment"
                aria-label="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" isLoading={isSubmitting}>Submit expense</Button></div>
    </form>
  );
}

export function ReferenceForm({ onSave, onCancel }: { onSave: (value: z.infer<typeof referenceSchema>) => Promise<void>; onCancel: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(referenceSchema), defaultValues: { date: today, reference: '', name: '', amount: 0, status: 'draft', notes: '' } });
  return <form className="space-y-4" onSubmit={handleSubmit(onSave)}><div className="grid gap-4 sm:grid-cols-2"><FormField label="Date" required error={errors.date?.message}><DatePicker {...register('date')} /></FormField><FormField label="Reference" required error={errors.reference?.message}><TextInput {...register('reference')} /></FormField><FormField label="Name" required error={errors.name?.message}><TextInput {...register('name')} /></FormField><FormField label="Amount" error={errors.amount?.message}><TextInput type="number" min="0" step="0.01" {...register('amount')} /></FormField><FormField label="Status"><TextInput {...register('status')} /></FormField></div><FormField label="Notes"><TextInput {...register('notes')} /></FormField><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" isLoading={isSubmitting}>Save record</Button></div></form>;
}
