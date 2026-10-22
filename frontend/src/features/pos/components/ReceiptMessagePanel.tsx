import { useEffect, useState } from 'react';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { appToast } from '@/shared/utils/toast';
import { receiptMessageService, type ReceiptChannel, type ReceiptSource } from '../receiptMessageService';

export function ReceiptMessagePanel({ scope, permittedBranchIds, actor, source, saleId, defaultRecipient = '' }: { scope: TenantBranchScope; permittedBranchIds: string[]; actor: string; source: ReceiptSource; saleId: string; defaultRecipient?: string }) {
  const [channel, setChannel] = useState<ReceiptChannel>('email');
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [available, setAvailable] = useState({ email: false, sms: false, whatsapp: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [revision, refresh] = useState(0);
  useEffect(() => { let live = true; receiptMessageService.channels(scope.tenantId).then(result => { if (live) { setAvailable(result); setError(''); } }).catch(() => { if (live) setError('Unable to load communication settings.'); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [scope.tenantId]);
  useEffect(() => { setRecipient(defaultRecipient); }, [defaultRecipient, saleId]);
  const history = receiptMessageService.history(scope, source, saleId);
  void revision;
  const send = async () => { setSending(true); try { await receiptMessageService.send(scope, permittedBranchIds, actor, source, saleId, { channel, recipient }); refresh(value => value + 1); appToast.success('Mock receipt message recorded.'); } catch (cause) { appToast.error(cause instanceof Error ? cause.message : 'Unable to prepare receipt message.'); } finally { setSending(false); } };
  return <section className="mt-4 w-full rounded-lg border border-slate-200 p-3 print:hidden" aria-label="Share receipt">
    <h3 className="text-sm font-semibold">Send receipt or sales message</h3>
    <p className="mt-1 text-xs text-slate-600">Demo only. No email, SMS, or WhatsApp message leaves this app.</p>
    {loading ? <p role="status" className="mt-2 text-xs">Loading channels…</p> : error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs">Channel<select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={channel} onChange={event => setChannel(event.target.value as ReceiptChannel)}><option value="email" disabled={!available.email}>Email{available.email ? '' : ' (disabled)'}</option><option value="sms" disabled={!available.sms}>SMS{available.sms ? '' : ' (disabled)'}</option><option value="whatsapp" disabled={!available.whatsapp}>WhatsApp{available.whatsapp ? '' : ' (disabled)'}</option></select></label><label className="text-xs">Recipient<input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" type={channel === 'email' ? 'email' : 'tel'} value={recipient} onChange={event => setRecipient(event.target.value)} placeholder={channel === 'email' ? 'customer@example.com' : 'Phone number'} /></label></div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer text-blue-700">Preview message</summary><pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-sans">{receiptMessageService.preview(scope, source, saleId)}</pre></details>
      <button className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={sending || !available[channel] || !recipient.trim()} onClick={() => void send()}>{sending ? 'Preparing…' : 'Record mock send'}</button>
      {history.length > 0 && <div className="mt-3 border-t pt-2 text-xs"><h4 className="font-semibold">Message history</h4><ul className="mt-1 space-y-1">{history.map(item => <li key={item.id}>{new Date(item.sentAt).toLocaleString()} · {item.channel} · {item.recipient} · mock sent by {item.sentBy}</li>)}</ul></div>}
    </>}
  </section>;
}
