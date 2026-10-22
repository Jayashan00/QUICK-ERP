import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { tenantSettingsService } from '@/features/settings/finance/services/tenantSettingsService';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { appToast } from '@/shared/utils/toast';
import { fxPositionSchema, fxRevaluationService, type FxPositionInput } from './fxRevaluationService';
import type { Account, AccountingScope, Actor, Filters } from './accountingService';

export function FxRevaluationPanel({ scope, actor, accounts, filters, money, canPrepare, canReview }: { scope: AccountingScope; actor: Actor; accounts: Account[]; filters: Filters; money: (value: number) => string; canPrepare: boolean; canReview: boolean }) {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof tenantSettingsService.getLocalization>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revision, refresh] = useState(0);
  const [busyId, setBusyId] = useState('');
  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<z.input<typeof fxPositionSchema>, unknown, FxPositionInput>({ resolver: zodResolver(fxPositionSchema), defaultValues: { branchId: scope.branchId, accountId: '', reference: '', date: new Date().toISOString().slice(0, 10), currency: '', foreignAmount: 0, carryingAmount: 0, rate: 0, notes: '' } });
  useEffect(() => { setValue('branchId', scope.branchId); }, [scope.branchId, setValue]);
  useEffect(() => { let live = true; setLoading(true); tenantSettingsService.getLocalization(scope.tenantId).then(value => { if (live) { setSettings(value); setLoadError(false); } }).catch(() => { if (live) setLoadError(true); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [scope.tenantId]);
  const values = watch();
  const foreignAmount = Number(values.foreignAmount);
  const carryingAmount = Number(values.carryingAmount);
  const rate = Number(values.rate);
  const preview = Number.isFinite(foreignAmount) && Number.isFinite(carryingAmount) && Number.isFinite(rate) && foreignAmount > 0 && rate > 0 ? fxRevaluationService.preview({ foreignAmount, carryingAmount, rate }) : null;
  const rows = fxRevaluationService.list(scope, filters);
  void revision;
  const prepare = handleSubmit(async input => { try { await fxRevaluationService.prepare(scope, actor, input); refresh(value => value + 1); reset({ ...input, reference: '', foreignAmount: 0, carryingAmount: 0, rate: 0, notes: '' }); appToast.success('FX revaluation preview prepared.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to prepare FX revaluation.'); } });
  const review = (id: string) => { setBusyId(id); try { fxRevaluationService.review(scope, actor, id); refresh(value => value + 1); appToast.success('FX preview reviewed.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to review FX preview.'); } finally { setBusyId(''); } };
  const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
  return <div className="space-y-4">
    <Card><p className="text-sm text-slate-600">Enter a known foreign currency balance, its carrying amount in the company base currency, and a manual closing rate. The difference is a review preview only. It does not change the ledger or post a journal.</p></Card>
    {loading ? <Card role="status">Loading company currency settings…</Card> : loadError || !settings ? <Card role="alert">Company currency settings are unavailable.</Card> : <>
      {canPrepare && <Card><h2 className="mb-3 font-semibold">Prepare position</h2><form onSubmit={prepare} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Reference<input className={field} {...register('reference')} />{errors.reference && <span role="alert" className="text-xs text-red-700">{errors.reference.message}</span>}</label>
        <label className="text-sm">Date<input type="date" className={field} {...register('date')} />{errors.date && <span role="alert" className="text-xs text-red-700">{errors.date.message}</span>}</label>
        <label className="text-sm">Account<select className={field} {...register('accountId')}><option value="">Choose account</option>{accounts.filter(row => row.active && (row.type === 'asset' || row.type === 'liability')).map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select>{errors.accountId && <span role="alert" className="text-xs text-red-700">{errors.accountId.message}</span>}</label>
        <label className="text-sm">Foreign currency<select className={field} {...register('currency')}><option value="">Choose currency</option>{settings.supportedCurrencies.filter(code => code !== settings.baseCurrency).map(code => <option key={code} value={code}>{code}</option>)}</select>{errors.currency && <span role="alert" className="text-xs text-red-700">{errors.currency.message}</span>}</label>
        <label className="text-sm">Foreign amount<input type="number" min="0.0001" step="any" className={field} {...register('foreignAmount')} />{errors.foreignAmount && <span role="alert" className="text-xs text-red-700">{errors.foreignAmount.message}</span>}</label>
        <label className="text-sm">Carrying amount ({settings.baseCurrency})<input type="number" min="0" step="0.01" className={field} {...register('carryingAmount')} />{errors.carryingAmount && <span role="alert" className="text-xs text-red-700">{errors.carryingAmount.message}</span>}</label>
        <label className="text-sm">Closing rate ({settings.baseCurrency} per foreign unit)<input type="number" min="0.000001" step="any" className={field} {...register('rate')} />{errors.rate && <span role="alert" className="text-xs text-red-700">{errors.rate.message}</span>}</label>
        <label className="text-sm sm:col-span-2">Notes<input className={field} {...register('notes')} />{errors.notes && <span role="alert" className="text-xs text-red-700">{errors.notes.message}</span>}</label>
        <input type="hidden" {...register('branchId')} />
        <div className="flex flex-wrap items-end gap-3 lg:col-span-3"><p className="text-sm">Revalued: <strong>{preview ? money(preview.revaluedAmount) : '—'}</strong> · Difference: <strong>{preview ? money(preview.difference) : '—'}</strong></p><Button type="submit" isLoading={isSubmitting}>Prepare preview</Button></div>
      </form></Card>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Date', 'Branch', 'Reference', 'Account', 'Currency', 'Foreign amount', 'Carrying', 'Rate', 'Revalued', 'Difference', 'Status', 'History', 'Action'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2">{row.branchId}</td><td className="px-3 py-2">{row.reference}</td><td className="px-3 py-2">{accounts.find(account => account.id === row.accountId)?.name ?? row.accountId}</td><td className="px-3 py-2">{row.currency}</td><td className="px-3 py-2">{row.foreignAmount}</td><td className="px-3 py-2">{money(row.carryingAmount)}</td><td className="px-3 py-2">{row.rate}</td><td className="px-3 py-2">{money(row.revaluedAmount)}</td><td className="px-3 py-2">{money(row.difference)}</td><td className="px-3 py-2 capitalize">{row.status}</td><td className="px-3 py-2">{row.history.map(event => `${event.action} by ${event.actor}`).join('; ')}</td><td className="px-3 py-2">{canReview && row.status === 'prepared' && <Button size="sm" variant="secondary" disabled={busyId === row.id} onClick={() => review(row.id)}>Mark reviewed</Button>}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No FX positions match these filters.</p>}</div>
    </>}
  </div>;
}
