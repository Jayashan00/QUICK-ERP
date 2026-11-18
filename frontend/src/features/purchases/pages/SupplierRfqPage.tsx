import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '@/core/api';

interface RfqLine {
  productId: string;
  variantId?: string;
  quantity: number;
  description?: string;
  unitPrice?: number;
  taxPercent?: number;
  discountPercent?: number;
}

interface PublicRfq {
  referenceNumber: string;
  requiredDeliveryDate: string;
  supplierName: string;
  notes?: string;
  items: RfqLine[];
}

export function SupplierRfqPage() {
  const { token } = useParams();
  const [rfq, setRfq] = useState<PublicRfq | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lines, setLines] = useState<RfqLine[]>([]);
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10));
  const [validityDate, setValidityDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [warranty, setWarranty] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiClient.get<PublicRfq>(`/public/supplier/rfq/${encodeURIComponent(token)}`)
      .then(({ data }) => {
        setRfq(data);
        setLines(data.items.map((line) => ({ ...line, unitPrice: 0, taxPercent: 0, discountPercent: 0 })));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to open this RFQ.'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      let fileName = '';
      let fileContentType = '';
      let fileBase64 = '';
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('Quotation files must be 5 MB or smaller.');
        fileName = file.name;
        fileContentType = file.type || 'application/octet-stream';
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = () => reject(new Error('The quotation file could not be read.'));
          reader.readAsDataURL(file);
        });
      }
      await apiClient.post(`/public/supplier/rfq/${encodeURIComponent(token)}/submit`, {
        quotationNumber,
        quotationDate,
        validityDate,
        deliveryDays,
        paymentTerms,
        currency,
        warranty,
        notes,
        items: lines,
        fileName,
        fileContentType,
        fileBase64,
      });
      setSuccess('Quotation submitted successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="min-h-screen bg-slate-50 p-6 text-center text-slate-600">Loading RFQ...</main>;
  if (error && !rfq) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">{error}</div></main>;
  if (!rfq) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Supplier quotation</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{rfq.referenceNumber}</h1>
          <p className="mt-1 text-sm text-slate-600">{rfq.supplierName} · Required delivery {rfq.requiredDeliveryDate}</p>
        </div>
        {rfq.notes && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{rfq.notes}</div>}
        {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Quotation number<input className="mt-1 w-full rounded border px-3 py-2" value={quotationNumber} onChange={(e) => setQuotationNumber(e.target.value)} /></label>
          <label className="text-sm">Quotation date<input type="date" className="mt-1 w-full rounded border px-3 py-2" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} /></label>
          <label className="text-sm">Validity date<input type="date" className="mt-1 w-full rounded border px-3 py-2" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} /></label>
          <label className="text-sm">Delivery time (days)<input type="number" min="1" className="mt-1 w-full rounded border px-3 py-2" value={deliveryDays} onChange={(e) => setDeliveryDays(Number(e.target.value))} /></label>
          <label className="text-sm">Payment terms<input className="mt-1 w-full rounded border px-3 py-2" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></label>
          <label className="text-sm">Currency<input className="mt-1 w-full rounded border px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Warranty<input className="mt-1 w-full rounded border px-3 py-2" value={warranty} onChange={(e) => setWarranty(e.target.value)} /></label>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Item</th><th className="p-3">Qty</th><th className="p-3">Unit price</th><th className="p-3">Tax %</th><th className="p-3">Discount %</th></tr></thead>
            <tbody>{lines.map((line, index) => (
              <tr key={`${line.productId}-${index}`} className="border-t">
                <td className="p-3">{line.description || line.productId}</td><td className="p-3 text-center">{line.quantity}</td>
                {[['unitPrice', '0'], ['taxPercent', '0'], ['discountPercent', '0']].map(([field, fallback]) => (
                  <td className="p-2" key={field}><input type="number" min="0" step="0.01" className="w-28 rounded border px-2 py-1"
                    value={(line[field as keyof RfqLine] as number) ?? fallback}
                    onChange={(e) => setLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: Number(e.target.value) } : row))} /></td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>

        <label className="block text-sm">Notes<textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <label className="block text-sm">Optional quotation file<input type="file" className="mt-1 block" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <button type="submit" disabled={submitting || Boolean(success)} className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {submitting ? 'Submitting...' : 'Submit quotation'}
        </button>
      </form>
    </main>
  );
}
