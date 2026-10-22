import { useId, useMemo, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Boxes, BriefcaseBusiness, Building2, Clock3, FileText, Headphones, PackageSearch, Search, ShoppingCart, Target, Users, WalletCards, LoaderCircle } from 'lucide-react';
import { Modal } from '@/shared/components/common/Modal';
import { Button } from '@/shared/components/common/Button';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { readRecentSearches, rememberSearch } from '../utils/recentSearches';
import type { GlobalSearchResult, SearchModule } from '../types/globalSearch';

const icons = { CRM: Target, Customers: Users, Suppliers: Building2, Products: PackageSearch, Sales: ShoppingCart, Purchases: ShoppingCart, Inventory: Boxes, Finance: WalletCards, HR: Users, Projects: BriefcaseBusiness, Documents: FileText, Support: Headphones };
const resultKey = (row: GlobalSearchResult) => `${row.module}/${row.type}/${row.id}`;
export function GlobalSearchPanel({ onClose, inputRef }: { onClose: () => void; inputRef: RefObject<HTMLInputElement> }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const search = useGlobalSearch(query);
  const listId = useId();
  const groups = useMemo(() => {
    const grouped = new Map<SearchModule, GlobalSearchResult[]>();
    search.results.forEach(row => grouped.set(row.module, [...(grouped.get(row.module) ?? []), row]));
    return [...grouped];
  }, [search.results]);
  const ordered = groups.flatMap(([, rows]) => rows);
  const activeIndex = Math.max(0, ordered.findIndex(row => resultKey(row) === selected));
  const recent = useMemo(() => readRecentSearches(search.recentKey), [search.recentKey]);
  const select = (row: GlobalSearchResult) => {
    rememberSearch(search.recentKey, query);
    onClose(); navigate(row.route);
  };
  const updateQuery = (value: string) => { setQuery(value); setSelected(''); };
  return createPortal(<Modal isOpen onClose={onClose} title="Global Search" maxWidth="720px" initialFocusRef={inputRef} footer={<p className="text-xs text-slate-500">Arrow keys to select / Enter to open / Esc to close</p>}>
    <div className="space-y-4">
      <label htmlFor={`${listId}-input`} className="sr-only">Search Quick ERP records</label>
      <div className="relative"><Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input id={`${listId}-input`} ref={inputRef} role="combobox" aria-autocomplete="list" aria-expanded={ordered.length > 0} aria-controls={listId} aria-activedescendant={ordered.length ? `${listId}-option-${activeIndex}` : undefined} autoComplete="off" maxLength={120} value={query} placeholder="Search customers, products, invoices, orders and more..." className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={event => updateQuery(event.target.value)} onKeyDown={event => {
        if (search.isLoading) return;
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && ordered.length) {
          event.preventDefault(); const index = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + ordered.length) % ordered.length;
          setSelected(resultKey(ordered[index])); requestAnimationFrame(() => document.getElementById(`${listId}-option-${index}`)?.scrollIntoView({ block: 'nearest' }));
        } else if (event.key === 'Enter' && ordered.length) { event.preventDefault(); select(ordered[activeIndex]); }
      }} /></div>
      <p className="text-xs text-slate-500">Permitted records in your active branch, plus tenant-wide master data.</p>
      {!search.available ? <EmptyState title="Tenant search unavailable" message="Global ERP record search is available inside a signed-in tenant workspace." /> : query.trim().length < 2 ? <>
        <p className="py-3 text-sm text-slate-500">Search customers, products, invoices, orders and more. Type at least 2 characters.</p>
        {recent.length > 0 && <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent searches</h3><div className="space-y-1">{recent.map(term => <button type="button" key={term} onClick={() => { updateQuery(term); inputRef.current?.focus(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-blue-600"><Clock3 size={16} aria-hidden="true" className="shrink-0 text-slate-400" /><span className="truncate">{term}</span></button>)}</div></div>}
      </> : search.isLoading ? <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><LoaderCircle size={18} aria-hidden="true" className="animate-spin" />Searching permitted records...</div> : search.isError ? <ErrorState message="Search could not load. Try again." onRetry={() => void search.refetch()} /> : <>
        {search.unavailableModules.length > 0 && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><span>Some permitted sources could not load: {search.unavailableModules.join(', ')}.</span><Button size="sm" variant="secondary" onClick={() => void search.refetch()}>Retry</Button></div>}
        <div id={listId} role="listbox" aria-label="Search results" className="max-h-[50vh] overflow-y-auto overscroll-contain">
          {ordered.length ? groups.map(([module, rows]) => { const Icon = icons[module]; return <div key={module} role="group" aria-label={module} className="mb-3"><h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{module}</h3>{rows.map(row => { const index = ordered.indexOf(row); return <button type="button" role="option" tabIndex={-1} id={`${listId}-option-${index}`} aria-selected={index === activeIndex} key={resultKey(row)} onMouseEnter={() => setSelected(resultKey(row))} onClick={() => select(row)} className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-blue-600 ${index === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}`}><Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-slate-900">{row.title}</p>{row.subtitle && <p className="mt-0.5 break-words text-xs text-slate-500">{row.subtitle}</p>}<p className="mt-1 text-[11px] text-slate-400">{row.type}</p></div></button>; })}</div>; }) : <EmptyState title="No results" message={`No results found for '${query.trim()}'.`} />}
        </div>
      </>}
    </div>
  </Modal>, document.body);
}
