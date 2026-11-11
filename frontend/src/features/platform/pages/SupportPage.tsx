import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { usePlatformSupport } from '@/features/platform/hooks/usePlatformFoundation';
import type { SupportStatus, SupportTicket } from '@/features/support/types/support';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import { appToast } from '@/shared/utils/toast';

const statuses: SupportStatus[] = ['new', 'in_progress', 'resolved', 'closed'];
const nextStatus: Record<SupportStatus, SupportStatus | null> = { new: 'in_progress', in_progress: 'resolved', resolved: 'closed', closed: null };
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export function SupportPage() {
  const query = usePlatformSupport();
  const [companyId, setCompanyId] = useState('all');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [pendingStatus, setPendingStatus] = useState<SupportStatus | null>(null);
  const [assignee, setAssignee] = useState('Quick ERP Support');
  const [reply, setReply] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const companies = useMemo(() => {
    const entries = new Map<string, string>();
    for (const ticket of query.data ?? []) entries.set(ticket.tenantId, ticket.companyName);
    return [...entries].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [query.data]);
  const rows = useMemo(() => (query.data ?? []).filter((ticket) =>
    (companyId === 'all' || ticket.tenantId === companyId)
    && (status === 'all' || ticket.status === status)
    && (priority === 'all' || ticket.priority === priority)), [companyId, priority, query.data, status]);

  const columns: Column<SupportTicket>[] = [
    { key: 'ticket', header: 'Ticket', render: (ticket) => <strong>{ticket.ticketNumber}</strong> },
    { key: 'company', header: 'Company', render: (ticket) => <div><strong>{ticket.companyName}</strong><p className="text-xs text-slate-500">{ticket.tenantId}</p></div> },
    { key: 'subject', header: 'Subject', render: (ticket) => ticket.subject },
    { key: 'priority', header: 'Priority', render: (ticket) => <StatusBadge status={ticket.priority} /> },
    { key: 'status', header: 'Status', render: (ticket) => <StatusBadge status={ticket.status} /> },
    { key: 'updated', header: 'Updated', render: (ticket) => new Date(ticket.updatedAt).toLocaleString() },
  ];

  const openTicket = (ticket: SupportTicket) => { setSelected(ticket); setPendingStatus(ticket.status); setAssignee(ticket.assignedSupportUser?.name ?? 'Quick ERP Support'); setReply(''); };
  const save = async () => {
    if (!selected) return;
    try { const updated = await query.update({ ticketId: selected.id, status: pendingStatus ?? selected.status, assignee, reply }); setSelected(updated); setPendingStatus(updated.status); setReply(''); appToast.success('Support ticket updated.'); }
    catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to update support ticket.'); }
  };
  const remove = async () => {
    if (!selected) return;
    try { await query.delete(selected.id); setSelected(null); setConfirmDelete(false); appToast.success('Closed ticket deleted.'); }
    catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to delete support ticket.'); }
  };
  const upcoming = selected ? nextStatus[selected.status] : null;

  return <PageContainer>
    <PageHeader title="Platform Support Management" description="Only tickets explicitly sent by a company tenant administrator appear here." />
    <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
      <Select aria-label="Filter by company" value={companyId} onChange={(event) => setCompanyId(event.target.value)} options={[{ value: 'all', label: 'All companies' }, ...companies.map((company) => ({ value: company.id, label: company.name }))]} />
      <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} options={['all', ...statuses].map((value) => ({ value, label: value === 'all' ? 'All statuses' : label(value) }))} />
      <Select aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value)} options={['all', 'low', 'medium', 'high', 'urgent'].map((value) => ({ value, label: value === 'all' ? 'All priorities' : label(value) }))} />
    </div>
    <DataTable columns={columns} data={rows} keyField="id" isLoading={query.isLoading} emptyTitle="No escalated support tickets" emptyMessage="Tickets appear after a tenant administrator sends them to super admin." onRowClick={openTicket} />
    <Modal isOpen={Boolean(selected)} title={selected?.ticketNumber ?? 'Support ticket'} onClose={() => setSelected(null)}>
      {selected && <div className="space-y-4">
        <div><h2 className="font-semibold">{selected.subject}</h2><p className="mt-1 text-sm text-slate-600">{selected.description}</p><p className="mt-2 text-xs text-slate-500">{selected.companyName} · created by {selected.createdBy.name}</p></div>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">{selected.conversation.length ? selected.conversation.map((message) => <div key={message.id} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{message.author.name}</strong><time className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{message.message}</p></div>) : <p className="text-sm text-slate-500">No conversation yet.</p>}</div>
        <FormField label="Assign support staff"><TextInput value={assignee} onChange={(event) => setAssignee(event.target.value)} /></FormField>
        {selected.status !== 'closed' && <FormField label="Reply to tenant administrator"><Textarea rows={4} value={reply} onChange={(event) => setReply(event.target.value)} /></FormField>}
        {upcoming && <Select aria-label="Next ticket status" value={pendingStatus ?? selected.status} onChange={(event) => setPendingStatus(event.target.value as SupportStatus)} options={[{ value: selected.status, label: label(selected.status) }, { value: upcoming, label: label(upcoming) }]} />}
        <div className="flex flex-wrap gap-2"><Button isLoading={query.isUpdating} onClick={() => void save()}>Save ticket update</Button>{selected.status === 'closed' && <Button variant="danger" leftIcon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>Delete Closed Ticket</Button>}</div>
      </div>}
    </Modal>
    <ConfirmDialog isOpen={confirmDelete} title="Delete closed ticket" message={`Permanently delete ${selected?.ticketNumber ?? 'this ticket'}? This cannot be undone.`} confirmLabel="Delete Ticket" variant="danger" isLoading={query.isUpdating} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
  </PageContainer>;
}
