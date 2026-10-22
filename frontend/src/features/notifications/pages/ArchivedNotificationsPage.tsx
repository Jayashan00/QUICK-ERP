import { useMemo, useState } from 'react';
import { ArrowLeft, ArchiveRestore, MailOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/core/permissions/permission-context';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Pagination } from '@/shared/components/tables/Pagination';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import { appToast } from '@/shared/utils/toast';
import { NotificationTypeBadge, PriorityBadge, useNotificationActions, useNotifications } from '@/features/notifications';
import type { NotificationModule, NotificationPriority, NotificationType } from '@/features/notifications';

const inputClass = 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const modules: NotificationModule[] = ['sales', 'purchasing', 'inventory', 'finance', 'hr', 'projects', 'documents', 'support', 'sync', 'system'];

export function ArchivedNotificationsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('notifications.manage');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<NotificationType | 'all'>('all');
  const [priority, setPriority] = useState<NotificationPriority | 'all'>('all');
  const [module, setModule] = useState<NotificationModule | 'all'>('all');
  const filters = useMemo(() => ({ archiveState: 'archived' as const, search, type, priority, module, page, pageSize: 10 }), [search, type, priority, module, page]);
  const query = useNotifications(filters);
  const actions = useNotificationActions();
  const updateFilter = (action: () => void) => { action(); setPage(1); };
  const restore = async (id: string) => {
    try {
      await actions.restore(id);
      appToast.success('Notification restored.');
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to restore notification.');
    }
  };

  if (query.isError) return <ErrorState title="Archived notifications unavailable" message="We could not load archived notifications. Try again." onRetry={() => void query.refetch()} />;

  return <div className="space-y-6">
    <PageHeader title="Archived Notifications" description="Notifications removed from the active Notification Center for your permitted branches." actions={<Button variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/notifications')}>Back to notifications</Button>} />
    <Card><p className="text-xs font-semibold uppercase text-slate-500">Archived notifications</p><p className="mt-2 text-2xl font-bold text-slate-900">{query.data?.total ?? 0}</p></Card>
    <Card className="p-0 sm:p-0">
      <TableToolbar searchValue={search} onSearchChange={(value) => updateFilter(() => setSearch(value))} searchPlaceholder="Search archived notifications..." filters={<><select aria-label="Notification type" className={inputClass} value={type} onChange={(event) => updateFilter(() => setType(event.target.value as NotificationType | 'all'))}><option value="all">All types</option>{['approval', 'alert', 'reminder', 'success', 'info'].map((value) => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Priority" className={inputClass} value={priority} onChange={(event) => updateFilter(() => setPriority(event.target.value as NotificationPriority | 'all'))}><option value="all">All priorities</option>{['urgent', 'high', 'normal', 'low'].map((value) => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Module" className={inputClass} value={module} onChange={(event) => updateFilter(() => setModule(event.target.value as NotificationModule | 'all'))}><option value="all">All modules</option>{modules.map((value) => <option key={value} value={value}>{value}</option>)}</select></>} />
      <div className="divide-y divide-slate-100">{query.isLoading ? Array.from({ length: 5 }, (_, index) => <div key={index} className="h-24 animate-pulse bg-slate-50" />) : query.data?.data.length ? query.data.data.map((record) => <article key={record.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{record.title}</h2><NotificationTypeBadge type={record.type} /><PriorityBadge priority={record.priority} /></div><p className="mt-1 text-sm leading-6 text-slate-600">{record.message}</p><p className="mt-2 text-xs text-slate-400">{record.module} · {record.reference ?? 'No reference'} · Archived {record.archivedAt ? new Date(record.archivedAt).toLocaleString() : ''}</p></div>{canManage && <Button size="sm" variant="ghost" leftIcon={<ArchiveRestore size={15} />} disabled={actions.isPending} onClick={() => void restore(record.id)}>Restore</Button>}</article>) : <div className="p-12 text-center"><MailOpen className="mx-auto text-slate-400" /><h2 className="mt-3 font-semibold text-slate-900">No archived notifications</h2><p className="mt-1 text-sm text-slate-500">Notifications you archive will appear here.</p></div>}</div>
      {query.data && query.data.total > 10 && <Pagination page={page} pageSize={10} total={query.data.total} onPageChange={setPage} />}
    </Card>
  </div>;
}
