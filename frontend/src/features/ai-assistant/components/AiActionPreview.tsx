import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TenantLink } from '@/core/routing/TenantLink';
import { usePermissions } from '@/core/permissions/permission-context';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const previewSchema = z.object({
  handoffOnly: z.literal(true),
  operation: z.enum(['prepare_sales_quotation', 'prepare_purchase_request', 'prepare_crm_followup']),
  title: z.string().max(100),
  branchId: id,
  proposedFields: z.record(z.string(), z.unknown()),
  missingRequiredFields: z.array(z.string()).max(12),
  warnings: z.array(z.string()).max(12),
});
const editSchema = z.object({
  quantity: z.number().positive().max(1_000_000).optional(),
  date: z.string().optional(),
  summary: z.string().max(200).optional(),
});
type Edits = z.infer<typeof editSchema>;

/** The confirmation below only opens the existing ERP form. It never saves a record. */
export function AiActionPreview({ value }: { value: unknown }) {
  const parsed = previewSchema.safeParse(value);
  if (!parsed.success) return null;
  return <ValidAiActionPreview draft={parsed.data} />;
}

function ValidAiActionPreview({ draft }: { draft: z.infer<typeof previewSchema> }) {
  const { hasPermission } = usePermissions();
  const fields = draft.proposedFields;
  const permission = draft.operation === 'prepare_sales_quotation' ? 'quotation.create'
    : draft.operation === 'prepare_purchase_request' ? 'purchases.requests.create' : 'crm.activities.create';
  const form = useForm<Edits>({ resolver: zodResolver(editSchema), defaultValues: {
    quantity: typeof fields.quantity === 'number' ? fields.quantity : undefined,
    date: typeof fields.date === 'string' ? fields.date : undefined,
    summary: typeof fields.summary === 'string' ? fields.summary : undefined,
  } });
  const edits = form.watch();
  const selectedId = draft.operation === 'prepare_sales_quotation' ? fields.customerId
    : draft.operation === 'prepare_purchase_request' ? fields.productId : fields.leadId;
  const secondaryId = fields.productId;
  const validId = id.safeParse(selectedId).success && (draft.operation !== 'prepare_sales_quotation' || id.safeParse(secondaryId).success);
  const quantity = edits.quantity;
  const validEdits = draft.operation === 'prepare_crm_followup'
    ? Boolean(edits.date && /^\d{4}-\d{2}-\d{2}$/.test(edits.date) && edits.summary?.trim())
    : typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 && quantity <= 1_000_000;
  const target = draft.operation === 'prepare_sales_quotation'
    ? `/sales/quotations?aiCustomerId=${encodeURIComponent(String(selectedId))}&aiProductId=${encodeURIComponent(String(secondaryId))}&aiQuantity=${encodeURIComponent(String(quantity))}`
    : draft.operation === 'prepare_purchase_request'
      ? `/purchases/requests?aiProductId=${encodeURIComponent(String(selectedId))}&aiQuantity=${encodeURIComponent(String(quantity))}`
      : `/crm/leads?record=${encodeURIComponent(String(selectedId))}`;

  return <section aria-label="AI draft preview" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
    <h4 className="font-semibold text-slate-900">{draft.title}</h4>
    <p className="mt-1 text-xs text-amber-800">Prepared for review only. No ERP record has been created.</p>
    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
      {Object.entries(fields).slice(0, 12).map(([key, field]) => <div key={key} className="rounded-lg bg-white p-2">
        <dt className="text-slate-500">{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt>
        <dd className="break-words font-medium">{typeof field === 'string' || typeof field === 'number' ? String(field) : '—'}</dd>
      </div>)}
    </dl>
    {draft.operation !== 'prepare_crm_followup' ? <label className="mt-3 block text-xs font-medium">Quantity
      <input type="number" step="any" min="0.001" max="1000000" {...form.register('quantity', { valueAsNumber: true })}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label> : <div className="mt-3 grid gap-2">
      <label className="text-xs font-medium">Follow-up date<input type="date" {...form.register('date')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
      <label className="text-xs font-medium">Summary<input type="text" maxLength={200} {...form.register('summary')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
    </div>}
    <p className="mt-3 text-xs text-slate-600">Review in the ERP form: {draft.missingRequiredFields.join(', ')}.</p>
    {draft.warnings.map(warning => <p key={warning} className="mt-1 text-xs text-amber-800">{warning}</p>)}
    {hasPermission(permission) && (draft.operation !== 'prepare_crm_followup' || hasPermission('crm.activities.edit')) && validId && validEdits ? <TenantLink to={target}
      state={draft.operation === 'prepare_crm_followup' ? { aiFollowup: { leadId: selectedId, date: edits.date, summary: edits.summary?.trim() } } : undefined}
      className="mt-3 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">
      {draft.operation === 'prepare_crm_followup' ? 'Open lead to complete follow-up' : 'Continue in ERP form'}
    </TenantLink> : <p className="mt-3 text-xs text-red-700">The draft needs valid fields and current create permission before you can continue.</p>}
  </section>;
}
