import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Check, CheckCheck, Headphones, Info, Package, ShieldCheck, WifiOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { IconButton } from '@/shared/components/common/IconButton';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { usePermissions } from '@/core/permissions/permission-context';
import { useNotificationActions, useRecentNotifications } from '@/features/notifications';
import type { NotificationModule, NotificationRecord } from '@/features/notifications';
import { appToast } from '@/shared/utils/toast';

const icons: Record<NotificationModule, typeof Bell> = { sales: Check, purchasing: ShieldCheck, inventory: Package, finance: AlertTriangle, hr: ShieldCheck, projects: Check, documents: Info, support: Headphones, sync: WifiOff, system: Bell };

export function NotificationsMenu({ area }: { area: 'tenant' | 'super-admin' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canView = area === 'tenant' && hasPermission('notifications.view');
  const query = useRecentNotifications(canView);
  const actions = useNotificationActions();
  const unread = query.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const pointer = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', pointer);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', pointer); document.removeEventListener('keydown', key); };
  }, [open]);

  const openRecord = async (record: NotificationRecord) => {
    try {
      if (!record.isRead) await actions.markRead({ id: record.id });
      setOpen(false);
      if (record.actionUrl) navigate(record.actionUrl);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to open notification.');
    }
  };

  if (!canView) return <IconButton label="Notifications unavailable" icon={<Bell size={19} />} disabled />;

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <IconButton label={`Notifications, ${unread} unread`} aria-haspopup="menu" aria-expanded={open} icon={<Bell size={19} />} onClick={() => setOpen((value) => !value)} />
        {unread > 0 && <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">{unread > 99 ? '99+' : unread}</span>}
      </div>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div><h2 className="text-sm font-semibold text-slate-900">Notifications</h2><p className="mt-0.5 text-xs text-slate-500">{unread ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'You are all caught up'}</p></div>
            {unread > 0 && <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => void actions.markAllRead().then(() => appToast.success('All notifications marked as read.')).catch((error: unknown) => appToast.error(error instanceof Error ? error.message : 'Unable to update notifications.'))}><CheckCheck size={14} /> Mark all read</button>}
          </div>
          <div role="menu" className="max-h-80 overflow-y-auto p-1.5">
            {query.isLoading ? <div className="flex h-32 items-center justify-center"><LoadingSpinner /></div> : query.isError ? <div className="p-5 text-center text-sm text-red-600">Notifications could not be loaded.</div> : query.data?.data.length ? query.data.data.map((record) => {
              const ItemIcon = icons[record.module];
              return <button key={record.id} type="button" role="menuitem" onClick={() => void openRecord(record)} className={`flex w-full gap-3 rounded-lg px-3 py-3 text-left outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 ${record.isRead ? '' : 'bg-blue-50/60'}`}><div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${record.priority === 'urgent' ? 'bg-red-50 text-red-600' : record.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-600'}`}><ItemIcon size={17} /></div><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><span className="flex-1 text-sm font-medium text-slate-900">{record.title}</span>{!record.isRead && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}</div><div className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{record.message}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{record.module} · {new Date(record.createdAt).toLocaleString()}</div></div></button>;
            }) : <div className="p-8 text-center text-sm text-slate-500">No notifications for this branch.</div>}
          </div>
          <div className="border-t border-slate-200 p-2"><Link to="/notifications" className="block rounded-lg px-3 py-2 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => setOpen(false)}>View all notifications</Link></div>
        </div>
      )}
    </div>
  );
}
