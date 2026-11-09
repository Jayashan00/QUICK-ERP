import { Bot, Database } from 'lucide-react';
import type { AiSource } from '../types';

type JsonRecord = Record<string, unknown>;
type AnswerBlock = { type: 'text'; content: string } | { type: 'list'; items: string[] };

const INTERNAL_FIELDS = new Set(['module', 'tool', 'tenantId', 'productId', 'items', 'count', 'returned', 'resource', 'label', 'greeting', 'help', 'sensitiveFieldsIncluded']);
const TITLE_FIELDS = new Set(['name', 'legalName', 'title', 'subject', 'firstName', 'lastName', 'customer', 'reference', 'referenceNumber', 'ticketNumber', 'code']);
const SUBTITLE_FIELDS = new Set(['reference', 'referenceNumber', 'ticketNumber', 'code', 'sku', 'employeeCode', 'designationName']);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function humanize(value: string) {
  return value
    .replace(/^get/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function cleanInline(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .trim();
}

function answerBlocks(content: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let textLines: string[] = [];
  let listItems: string[] = [];
  const flushText = () => { if (textLines.length) blocks.push({ type: 'text', content: textLines.join(' ') }); textLines = []; };
  const flushList = () => { if (listItems.length) blocks.push({ type: 'list', items: listItems }); listItems = []; };

  content.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { flushText(); flushList(); return; }
    const listed = line.match(/^(?:\d+[.)]|[-*])\s+(.+)$/);
    if (listed) { flushText(); listItems.push(cleanInline(listed[1])); return; }
    flushList(); textLines.push(cleanInline(line));
  });
  flushText(); flushList();
  return blocks;
}

function PlainAnswer({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      {answerBlocks(content).map((block, blockIndex) => block.type === 'text' ? (
        <p key={`text-${blockIndex}`} className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{block.content}</p>
      ) : (
        <ol key={`list-${blockIndex}`} className="space-y-2">
          {block.items.map((item, itemIndex) => (
            <li key={`${itemIndex}-${item}`} className="flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700">{itemIndex + 1}</span>
              <span className="min-w-0 text-sm leading-5 text-slate-700">{item}</span>
            </li>
          ))}
        </ol>
      ))}
    </div>
  );
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat().format(value);
  if (Array.isArray(value)) return value.map(displayValue).join(', ') || '—';
  if (isRecord(value)) return Object.entries(value).map(([key, nested]) => `${humanize(key)}: ${displayValue(nested)}`).join(' · ');
  return String(value).replace(/_/g, ' ');
}

function detailEntries(record: JsonRecord) {
  return Object.entries(record).filter(([key, value]) =>
    !INTERNAL_FIELDS.has(key) && !TITLE_FIELDS.has(key) && !SUBTITLE_FIELDS.has(key)
    && key !== 'id' && key !== 'status' && value !== null && value !== undefined && value !== '',
  );
}

function recordTitle(record: JsonRecord, index: number) {
  const fullName = [record.firstName, record.lastName].filter(Boolean).join(' ');
  return String(record.name || record.legalName || record.title || record.subject || fullName || record.customer
    || record.reference || record.referenceNumber || record.ticketNumber || record.code || record.employeeCode || `Result ${index + 1}`);
}

function statusClasses(status: string) {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  if (/(inactive|suspended|terminated|overdue|failed|offline)/.test(normalized)) return 'bg-red-50 text-red-700';
  if (/(pending|leave|degraded|draft|partial)/.test(normalized)) return 'bg-amber-50 text-amber-700';
  return 'bg-emerald-50 text-emerald-700';
}

function RecordCard({ record, index }: { record: JsonRecord; index: number }) {
  const title = recordTitle(record, index);
  const subtitles = ['reference', 'referenceNumber', 'ticketNumber', 'code', 'employeeCode', 'designationName', 'sku']
    .map((key) => record[key])
    .filter((value) => value !== null && value !== undefined && value !== '' && String(value) !== title)
    .map(String);
  const status = typeof record.status === 'string' ? record.status : null;
  const details = detailEntries(record);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs font-semibold text-blue-700">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="min-w-0 break-words text-sm font-semibold leading-5 text-slate-900">{title}</h4>
            {status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClasses(status)}`}>{displayValue(status)}</span>}
          </div>
          {subtitles.length > 0 && <p className="mt-1 break-words text-xs leading-4 text-slate-500">{subtitles.join(' · ')}</p>}
        </div>
      </div>

      {details.length > 0 && (
        <dl className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {details.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[minmax(88px,0.42fr)_minmax(0,1fr)] gap-3 py-2 text-xs leading-5">
              <dt className="font-medium text-slate-500">{humanize(key)}</dt>
              <dd className="min-w-0 break-words text-slate-800">{displayValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function SummaryGrid({ data }: { data: JsonRecord }) {
  const entries = Object.entries(data).filter(([key, value]) =>
    !INTERNAL_FIELDS.has(key) && key !== 'branchId' && value !== null && value !== undefined && value !== '',
  );
  if (!entries.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{humanize(key)}</dt>
          <dd className="mt-1 break-words text-sm font-semibold leading-5 text-slate-800">{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

interface AssistantResponseProps {
  content: string;
  source?: AiSource;
  data?: unknown;
  suggestions?: string[];
  onSuggestion?: (question: string) => void;
}

export function AssistantResponse({ content, source, data, suggestions = [], onSuggestion }: AssistantResponseProps) {
  const structured = isRecord(data) ? data : null;
  const items = structured && Array.isArray(structured.items) ? structured.items.filter(isRecord) : [];
  const isIntroduction = source?.tool === 'greeting' || source?.tool === 'capabilities';
  const title = isIntroduction ? 'VYRO Assistant' : source ? humanize(source.tool) : 'Assistant Response';
  const fallbackUsed = content.includes('AI provider was temporarily unavailable');

  return (
    <div className="w-[96%] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><Bot className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-[11px] text-slate-500">{isIntroduction ? 'Here to help with your ERP' : 'Authorized ERP result'}</p>
        </div>
        {source?.module && !isIntroduction && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{source.module}</span>}
      </div>

      <div className="space-y-3 p-4">
        {items.length > 0 ? (
          <>
            <p className="text-xs leading-5 text-slate-500">{items.length} record{items.length === 1 ? '' : 's'} found in your permitted scope.</p>
            <div className="space-y-2.5">{items.map((item, index) => <RecordCard key={String(item.id ?? item.reference ?? index)} record={item} index={index} />)}</div>
          </>
        ) : (
          <>
            <PlainAnswer content={content} />
            {structured && !isIntroduction && <SummaryGrid data={structured} />}
          </>
        )}

        {suggestions.length > 0 && onSuggestion && (
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Example questions for your role</p>
            <div className="grid gap-2">
              {suggestions.map((question) => (
                <button key={question} type="button" onClick={() => onSuggestion(question)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs leading-5 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {fallbackUsed && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-700">Shown directly from authorized ERP data while the AI provider reconnects.</p>}
      </div>

      {source && !isIntroduction && (
        <div className="flex items-center gap-1.5 border-t border-slate-100 px-4 py-2.5 text-[10px] font-medium text-slate-400">
          <Database className="h-3 w-3" />
          <span className="capitalize">{source.module}</span>
          <span aria-hidden="true">·</span>
          <span>{title}</span>
        </div>
      )}
    </div>
  );
}
