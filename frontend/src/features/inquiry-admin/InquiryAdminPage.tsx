import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, CalendarDays, Clock3, Inbox, Mail, MessageSquareText, Monitor, RefreshCw, Search, UserRound } from 'lucide-react';
import { changeInquiryStatus, INQUIRY_STORAGE_KEY, readInquiries, type Inquiry, type InquiryStatus } from './inquiryStorage';

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
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => readInquiries());
  const [selectedId, setSelectedId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === INQUIRY_STORAGE_KEY || event.key === null) setInquiries(readInquiries());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!selectedId || !inquiries.some((inquiry) => inquiry.id === selectedId)) {
      setSelectedId(inquiries[0]?.id ?? '');
    }
  }, [inquiries, selectedId]);

  const filteredInquiries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return inquiries.filter((inquiry) => {
      if (statusFilter !== 'all' && inquiry.status !== statusFilter) return false;
      if (!normalized) return true;
      return [inquiry.name, inquiry.email, inquiry.company, inquiry.interest, inquiry.message]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [inquiries, query, statusFilter]);

  const selected = inquiries.find((inquiry) => inquiry.id === selectedId) ?? null;
  const newCount = inquiries.filter((inquiry) => inquiry.status === 'new').length;
  const activeCount = inquiries.filter((inquiry) => inquiry.status === 'contacted' || inquiry.status === 'qualified').length;

  function refreshInquiries() {
    setInquiries(readInquiries());
  }

  function updateStatus(status: InquiryStatus) {
    if (!selected) return;
    setInquiries(changeInquiryStatus(selected.id, status));
  }

  return (
    <main className="inquiry-admin-app">
      <header className="inquiry-admin-topbar">
        <Link to="/" className="inquiry-brand"><span className="inquiry-brand-mark">V</span><span>VYRO</span></Link>
        <div className="inquiry-topbar-right"><span><Monitor size={15} /> Local preview inbox</span></div>
      </header>
      <div className="inquiry-admin-content">
        <div className="inquiry-page-heading">
          <div><p className="inquiry-admin-kicker">Public website</p><h1>Inquiries</h1><p>Review product questions and follow up with prospective customers.</p></div>
          <button type="button" className="inquiry-refresh" onClick={refreshInquiries}><RefreshCw size={15} /> Refresh</button>
        </div>

        <p className="inquiry-local-notice"><Monitor size={15} /> Frontend preview only. Inquiries are saved in this browser and aren’t sent to a server or shared across devices.</p>

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
                <button type="button" className={`inquiry-list-item ${selectedId === inquiry.id ? 'selected' : ''}`} key={inquiry.id} onClick={() => setSelectedId(inquiry.id)}>
                  <span className="inquiry-list-avatar">{inquiry.name.slice(0, 1).toUpperCase()}</span>
                  <span className="inquiry-list-main">
                    <span className="inquiry-list-title"><strong>{inquiry.name}</strong><time>{formatDate(inquiry.createdAt)}</time></span>
                    <span className="inquiry-list-company">{inquiry.company}</span>
                    <span className="inquiry-list-preview">{inquiry.interest} · {inquiry.message}</span>
                    <span className={`inquiry-status ${inquiry.status}`}>{inquiry.status}</span>
                  </span>
                </button>
              ))}
              {filteredInquiries.length === 0 && <div className="inquiry-empty"><Inbox size={25} /><strong>No inquiries here</strong><span>{inquiries.length ? 'Try another filter or search.' : 'Submit the public form in this browser to see an inquiry here.'}</span></div>}
            </div>
          </section>

          <section className="inquiry-detail-panel" aria-label="Selected inquiry">
            {selected ? <>
              <div className="inquiry-detail-head">
                <div><span className={`inquiry-status ${selected.status}`}>{selected.status}</span><p className="inquiry-detail-date"><CalendarDays size={14} /> Received {formatDate(selected.createdAt)}</p></div>
                <label className="inquiry-status-select">Status<select value={selected.status} onChange={(event) => updateStatus(event.target.value as InquiryStatus)}><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="archived">Archived</option></select></label>
              </div>
              <h2 className="inquiry-detail-title">{selected.interest}</h2>
              <div className="inquiry-contact-card"><span className="inquiry-detail-avatar">{selected.name.slice(0, 1).toUpperCase()}</span><div><strong>{selected.name}</strong><span><Building2 size={13} /> {selected.company}</span></div></div>
              <div className="inquiry-contact-lines"><a href={`mailto:${encodeURIComponent(selected.email)}`}><Mail size={15} />{selected.email}<ArrowUpRight size={13} /></a>{selected.phone && <a href={`tel:${encodeURIComponent(selected.phone)}`}><UserRound size={15} />{selected.phone}<ArrowUpRight size={13} /></a>}</div>
              <div className="inquiry-message-box"><div><MessageSquareText size={15} /><span>Message</span></div><p>{selected.message}</p></div>
              <div className="inquiry-detail-footer"><Clock3 size={14} /> Updated {formatDate(selected.updatedAt)}{selected.updatedBy && <span> in this browser</span>}<a href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent('Re: Your VYRO inquiry')}`}><Mail size={14} /> Reply</a></div>
            </> : <div className="inquiry-empty inquiry-detail-empty"><Inbox size={28} /><strong>Select an inquiry</strong><span>Choose one from the inbox to view its details.</span></div>}
          </section>
        </div>
        <footer className="inquiry-admin-footer"><span><Monitor size={14} /> Separate frontend preview</span><span>VYRO inquiry inbox</span></footer>
      </div>
    </main>
  );
}
