import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Bot, History, Plus, RotateCcw, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { useTenant } from '@/core/tenant/tenant-context';
import type { TenantModule } from '@/core/tenant/tenantEntitlements';
import { useAiAssistant } from '../hooks/useAiAssistant';
import { AssistantResponse } from './AssistantResponse';

type Suggestion = { question: string; module?: TenantModule; permissions: string[]; tenantAdminOnly?: boolean };
const SUGGESTIONS: Suggestion[] = [
  { question: 'Show posted invoice face amounts this month by currency.', module: 'sales', permissions: ['sales.view'] },
  { question: 'Show stock balances and reorder levels.', module: 'inventory', permissions: ['inventory.stock.view'] },
  { question: 'Show overdue invoices.', module: 'sales', permissions: ['sales.view'] },
  { question: 'Give me customer names and details.', module: 'customers', permissions: ['customers.view'] },
  { question: 'How many suppliers do we have?', module: 'suppliers', permissions: ['suppliers.suppliers.view'] },
  { question: 'Give me supplier names and details.', module: 'suppliers', permissions: ['suppliers.suppliers.view'] },
  { question: 'Show employee names and designations.', module: 'hr', permissions: ['hr.employees.view'] },
  { question: 'What are the latest purchase orders?', module: 'purchases', permissions: ['purchase.view'] },
  { question: "Show this month's expenses.", module: 'finance', permissions: ['finance.expenses.view'] },
];

const PLATFORM_SUGGESTIONS = [
  'Explain how Quick ERP subscriptions work.',
  'What platform AI information is available?',
];

type LauncherDrag = {
  originY: number;
  pointerId: number;
  startY: number;
  moved: boolean;
};

const LAUNCHER_SIZE = 52;
const LAUNCHER_EDGE_GAP = 16;

function clampLauncherY(position: number) {
  return Math.min(Math.max(LAUNCHER_EDGE_GAP, position), Math.max(LAUNCHER_EDGE_GAP, window.innerHeight - LAUNCHER_SIZE - LAUNCHER_EDGE_GAP));
}

function defaultLauncherY() {
  return clampLauncherY(window.innerHeight - LAUNCHER_SIZE - 24);
}

export function AiAssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { branchId } = useBranch();
  const { currentTenant } = useTenant();
  const { hasAnyPermission, permissions } = usePermissions();
  const scopeKey = [user?.tenantId, user?.id, user?.roleId, branchId,
    permissions.slice().sort().join(','), currentTenant?.entitlements.enabledModules.slice().sort().join(',')].join('|');
  const { messages, conversationId, isLoading, error, send, retry, clear, newConversation,
    openConversation, deleteConversation, history, isHistoryOpen, setHistoryOpen,
    hasOlderMessages, isLoadingOlder, loadEarlier } = useAiAssistant(branchId, scopeKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const preserveScroll = useRef<{ height: number; top: number } | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<LauncherDrag | null>(null);
  const suppressLauncherClickRef = useRef(false);
  const [launcherY, setLauncherY] = useState<number | null>(null);

  const suggestions = useMemo(() => user?.isSuperAdmin
    ? PLATFORM_SUGGESTIONS.map((question) => ({ question }))
    : SUGGESTIONS.filter((item) =>
      (!item.tenantAdminOnly || user?.roleId === 'role-001')
      && (!item.module || currentTenant?.entitlements.enabledModules.includes(item.module))
      && hasAnyPermission(item.permissions),
    ).sort((a, b) => Number(b.module && pathname.includes(`/${b.module}`))
      - Number(a.module && pathname.includes(`/${a.module}`))).slice(0, 8),
    [currentTenant, hasAnyPermission, pathname, user?.isSuperAdmin, user?.roleId]);

  useEffect(() => { drawerRef.current?.toggleAttribute('inert', !open); }, [open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); return; }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const controls = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), a[href], input:not(:disabled)')]
        .filter(item => item.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawerRef.current.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open]);
  useEffect(() => {
    const pane = scrollRef.current;
    if (!pane) return;
    if (preserveScroll.current) {
      pane.scrollTop = pane.scrollHeight - preserveScroll.current.height + preserveScroll.current.top;
      preserveScroll.current = null;
    } else pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);
  useEffect(() => {
    setLauncherY(defaultLauncherY());
    dragRef.current = null;
  }, [pathname]);

  useEffect(() => {
    const keepLauncherVisible = () => setLauncherY((current) => current === null ? defaultLauncherY() : clampLauncherY(current));
    window.addEventListener('resize', keepLauncherVisible);
    return () => window.removeEventListener('resize', keepLauncherVisible);
  }, []);

  const startLauncherDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { originY: launcherY ?? rect.top, pointerId: event.pointerId, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveLauncher = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < 4) return;
    drag.moved = true;
    setLauncherY(clampLauncherY(drag.originY + deltaY));
  };

  const finishLauncherDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suppressLauncherClickRef.current = drag.moved;
    if (drag.moved) window.setTimeout(() => { suppressLauncherClickRef.current = false; }, 0);
    if (drag.moved) setLauncherY(clampLauncherY(drag.originY + event.clientY - drag.startY));
    dragRef.current = null;
  };

  const submit = () => {
    const question = draft.trim();
    if (!question || isLoading) return;
    setDraft('');
    void send(question);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (suppressLauncherClickRef.current) { suppressLauncherClickRef.current = false; return; }
          setOpen(true);
        }}
        onPointerDown={startLauncherDrag}
        onPointerMove={moveLauncher}
        onPointerUp={finishLauncherDrag}
        onPointerCancel={finishLauncherDrag}
        style={launcherY !== null ? { top: launcherY } : undefined}
        className={`fixed right-6 z-40 grid h-[52px] w-[52px] touch-none cursor-pointer place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 active:cursor-grabbing ${launcherY === null ? 'bottom-6' : ''} ${open ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        disabled={open}
        aria-hidden={open}
        aria-label="Open VYRO Assistant"
        title="Open assistant · drag up or down"
      >
        <Bot className="h-6 w-6" />
      </button>

      {open && <div className="fixed inset-0 z-40 bg-slate-950/25 sm:bg-transparent" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        ref={drawerRef}
        className={`fixed inset-y-0 right-0 z-50 flex w-full transform flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 motion-reduce:transition-none sm:max-w-xl lg:max-w-2xl ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-label="VYRO Assistant"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><Bot className="h-5 w-5" /></span>
            <div><h2 className="font-semibold text-slate-900">VYRO Assistant</h2>
              <p className="max-w-44 truncate text-xs text-slate-500">{isHistoryOpen ? 'Recent conversations' : conversationId ? 'Current conversation' : 'New conversation'}{branchId ? ` · ${branchId}` : ''}</p></div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setHistoryOpen(!isHistoryOpen)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Conversation history" aria-pressed={isHistoryOpen}><History className="h-4 w-4" /></button>
            <button type="button" onClick={newConversation} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="New conversation"><Plus className="h-4 w-4" /></button>
            <button type="button" onClick={() => void clear()} disabled={isLoading || !conversationId} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40" aria-label="Delete current conversation"><Trash2 className="h-4 w-4" /></button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close VYRO Assistant"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-5" aria-live="polite">
          {isHistoryOpen && <section aria-label="Recent conversations" className="space-y-2">
            {history.isLoading && <p className="text-sm text-slate-500">Loading conversations…</p>}
            {history.isError && <button type="button" onClick={() => void history.refetch()} className="text-sm text-blue-700">Could not load conversations. Retry</button>}
            {history.data?.length === 0 && <p className="text-sm text-slate-500">No conversations in this access scope.</p>}
            {history.data?.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
              <button type="button" onClick={() => void openConversation(item.id)} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left text-sm text-slate-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500" aria-current={item.id === conversationId ? 'page' : undefined}>
                <span className="block truncate font-medium">{item.title}</span><span className="text-xs text-slate-500">{new Date(item.updatedAt).toLocaleString()}</span>
              </button>
              <button type="button" onClick={() => void deleteConversation(item.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4" /></button>
            </div>)}
          </section>}
          {!isHistoryOpen && <>
          {hasOlderMessages && <button type="button" onClick={() => {
            if (scrollRef.current) preserveScroll.current = { height: scrollRef.current.scrollHeight, top: scrollRef.current.scrollTop };
            void loadEarlier();
          }} disabled={isLoadingOlder}
            className="mx-auto block rounded-lg px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">
            {isLoadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
          </button>}
          {messages.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-blue-600" />Ask about your ERP data</div>
              {suggestions.length > 0 && <div className="mt-4 grid gap-2">{suggestions.map((item) => (
                <button key={item.question} type="button" onClick={() => void send(item.question)} className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50">{item.question}</button>
              ))}</div>}
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant'
                ? <AssistantResponse
                    content={message.content}
                    data={message.data}
                    source={message.source}
                    suggestions={message.source?.tool === 'greeting' || message.source?.tool === 'capabilities' ? suggestions.map((item) => item.question) : undefined}
                    onSuggestion={(question) => { void send(question); }}
                  />
                : <div className={`max-w-[88%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm leading-6 text-white shadow-sm ${message.failed ? 'opacity-60' : ''}`}><p className="whitespace-pre-wrap">{message.content}</p></div>}
            </div>
          ))}

          {isLoading && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className="flex gap-1" aria-label="Assistant is typing"><i className="h-2 w-2 animate-bounce rounded-full bg-slate-400" /><i className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" /><i className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" /></span></div></div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            {suggestions.length > 0 && <div className="mt-3 grid gap-2">{suggestions.map((item) => (
              <button key={item.question} type="button" onClick={() => void send(item.question)} disabled={isLoading} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-xs leading-5 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">{item.question}</button>
            ))}</div>}
            <button type="button" onClick={retry} disabled={isLoading} className="mt-3 inline-flex items-center gap-1 font-semibold text-red-700 hover:text-red-900"><RotateCcw className="h-3.5 w-3.5" />Retry</button>
          </div>}
          </>}
        </div>

        {!isHistoryOpen && <footer className="border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} rows={1} maxLength={2000} placeholder="Ask about sales, stock, HR…" className="max-h-28 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
            <button type="button" onClick={submit} disabled={!draft.trim() || isLoading} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" aria-label="Send question"><Send className="h-4 w-4" /></button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">AI may make mistakes. Verify important figures in the ERP module.</p>
        </footer>}
      </aside>
    </>
  );
}
