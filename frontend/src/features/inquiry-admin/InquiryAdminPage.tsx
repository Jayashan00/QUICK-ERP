import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, CalendarDays, Clock3, Inbox, Mail, MessageSquareText, Monitor, RefreshCw, Search, UserRound } from 'lucide-react';
import { changeInquiryStatus, readInquiries, InquiryApiError, type Inquiry, type InquiryStatus } from './inquiryStorage';
import { useAuth } from '@/core/auth/auth-context';

import './inquiryAdmin.css';

type StatusFilter = 'all' | InquiryStatus;

const statuses: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All inquiries' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'archived', label: 'Archived' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function InquiryAdminPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestInProgress = useRef(false);

  const filteredInquiries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return inquiries.filter((inquiry) => {
      if (statusFilter !== 'all' && inquiry.status !== statusFilter) return false;
      if (!normalized) return true;
      return [inquiry.name, inquiry.email, inquiry.company, inquiry.interest, inquiry.message]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [inquiries, query, statusFilter]);

  const selected = filteredInquiries.find((inquiry) => inquiry.id === selectedId) ?? filteredInquiries[0] ?? null;
  const newCount = inquiries.filter((inquiry) => inquiry.status === 'new').length;
  const activeCount = inquiries.filter((inquiry) => inquiry.status === 'contacted' || inquiry.status === 'qualified').length;

  const loadInbox = useCallback(async (background = false) => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    if (!background) setBusy(true);
    setError('');
    try {
      setInquiries(await readInquiries());
      setLoaded(true);
    } catch (cause) {
      if (cause instanceof InquiryApiError && cause.status === 401) {
        logout();
        navigate('/login', { replace: true, state: { from: '/super-admin/inquiries' } });
        return;
      }
      if (cause instanceof InquiryApiError && cause.status === 403) {
        setInquiries([]);
        setLoaded(false);
      }
      setError(cause instanceof Error ? cause.message : 'Unable to load the inbox.');
    } finally {
      requestInProgress.current = false;
      if (!background) setBusy(false);
    }
  }, [navigate, logout]);

  useEffect(() => {
    void loadInbox();
    const refreshVisibleInbox = () => {
      if (document.visibilityState === 'visible') void loadInbox(true);
    };
    const interval = window.setInterval(refreshVisibleInbox, 10000);
    window.addEventListener('focus', refreshVisibleInbox);
    document.addEventListener('visibilitychange', refreshVisibleInbox);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisibleInbox);
      document.removeEventListener('visibilitychange', refreshVisibleInbox);
    };
  }, [loadInbox]);

  async function updateStatus(status: InquiryStatus) {
    if (!selected || busy || requestInProgress.current) return;
    requestInProgress.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await changeInquiryStatus(selected, status);
      setInquiries(items => items.map(item => item.id === updated.id ? updated : item));
    } catch (cause) {
      if (cause instanceof InquiryApiError && cause.status === 401) {
        logout();
        navigate('/login', { replace: true, state: { from: '/super-admin/inquiries' } });
        return;
      }
      if (cause instanceof InquiryApiError && cause.status === 403) {
        setInquiries([]);
        setLoaded(false);
      }
      setError(cause instanceof Error ? cause.message : 'Unable to save this status.');
    } finally {
      requestInProgress.current = false;
      setBusy(false);
    }
  }

  if (!loaded) return (
    <section className="inquiry-admin-app" aria-label="Website inquiries">
      <div className="inquiry-admin-content" role="status">
        {error ? <><p role="alert">{error}</p><button className="inquiry-refresh" disabled={busy} onClick={() => void loadInbox()}>Retry</button></> : 'Loading inquiries...'}
      </div>
    </section>
  );

  return (
    <section className="inquiry-admin-app" aria-label="Website inquiries">
      <div className="inquiry-admin-content">
        <div className="inquiry-page-heading">
          <div><p className="inquiry-admin-kicker">Public website</p><h1>Inquiries</h1><p>Review product questions and follow up with prospective customers.</p></div>
          <button type="button" className="inquiry-refresh" disabled={busy} onClick={() => void loadInbox()}><RefreshCw size={15} /> Refresh</button>
        </div>

        {error && <p role="alert" className="inquiry-local-notice">{error}</p>}

        <div className="inquiry-summary-row">
          <div><span>All inquiries</span><strong>{inquiries.length}</strong></div>
          <div><span>New</span><strong>{newCount}</strong></div>
          <div><span>In progress</span><strong>{activeCount}</strong></div>
          <div><span>Qualified</span><strong>{inquiries.filter((item) => item.status === 'qualified').length}</strong></div>
        </div>

        <div className="inquiry-workspace">
          <section className="inquiry-list-panel" aria-label="Inquiry list">
            <div className="inquiry-list-heading">
              <div><h2>Inbox</h2><span>{filteredInquiries.length} shown</span></div>
              <label className="inquiry-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inquiries" aria-label="Search inquiries" /></label>
            </div>
            <div className="inquiry-filters" aria-label="Filter by status">
              {statuses.map((status) => <button key={status.value} type="button" aria-pressed={statusFilter === status.value} onClick={() => setStatusFilter(status.value)}>{status.label}{status.value === 'new' && newCount > 0 && <span>{newCount}</span>}</button>)}
            </div>
            <div className="inquiry-list-scroll">
              {filteredInquiries.map((inquiry) => (
                <button type="button" className={`inquiry-list-item ${selected?.id === inquiry.id ? 'selected' : ''}`} key={inquiry.id} onClick={() => setSelectedId(inquiry.id)}>
                  <span className="inquiry-list-avatar">{inquiry.name.slice(0, 1).toUpperCase()}</span>
                  <span className="inquiry-list-main">
                    <span className="inquiry-list-title"><strong>{inquiry.name}</strong><time>{formatDate(inquiry.createdAt)}</time></span>
                    <span className="inquiry-list-company">{inquiry.company}</span>
                    <span className="inquiry-list-preview">{inquiry.interest} · {inquiry.message}</span>
                    <span className={`inquiry-status ${inquiry.status}`}>{inquiry.status}</span>
                  </span>
                </button>
              ))}
              {filteredInquiries.length === 0 && <div className="inquiry-empty"><Inbox size={25} /><strong>No inquiries here</strong><span>{inquiries.length ? 'Try another filter or search.' : 'New website inquiries will appear here.'}</span></div>}
            </div>
          </section>

          <section className="inquiry-detail-panel" aria-label="Selected inquiry">
            {selected ? <>
              <div className="inquiry-detail-head">
                <div><span className={`inquiry-status ${selected.status}`}>{selected.status}</span><p className="inquiry-detail-date"><CalendarDays size={14} /> Received {formatDate(selected.createdAt)}</p></div>
                <label className="inquiry-status-select">Status<select disabled={busy} value={selected.status} onChange={(event) => updateStatus(event.target.value as InquiryStatus)}><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="archived">Archived</option></select></label>
              </div>
              <h2 className="inquiry-detail-title">{selected.interest}</h2>
              <div className="inquiry-contact-card"><span className="inquiry-detail-avatar">{selected.name.slice(0, 1).toUpperCase()}</span><div><strong>{selected.name}</strong><span><Building2 size={13} /> {selected.company}</span></div></div>
              <div className="inquiry-contact-lines"><a href={`mailto:${encodeURIComponent(selected.email)}`}><Mail size={15} />{selected.email}<ArrowUpRight size={13} /></a>{selected.phone && <a href={`tel:${encodeURIComponent(selected.phone)}`}><UserRound size={15} />{selected.phone}<ArrowUpRight size={13} /></a>}</div>
              <div className="inquiry-message-box"><div><MessageSquareText size={15} /><span>Message</span></div><p>{selected.message}</p></div>
              <div className="inquiry-detail-footer"><Clock3 size={14} /> Updated {formatDate(selected.updatedAt)}{selected.updatedBy && <span> by {selected.updatedBy}</span>}<a href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent('Re: Your VYRO inquiry')}`}><Mail size={14} /> Reply</a></div>
            </> : <div className="inquiry-empty inquiry-detail-empty"><Inbox size={28} /><strong>Select an inquiry</strong><span>Choose one from the inbox to view its details.</span></div>}
          </section>
        </div>
        <footer className="inquiry-admin-footer"><span><Monitor size={14} /> Public website</span><span>VYRO inquiry inbox</span></footer>
      </div>
    </section>
  );
}
