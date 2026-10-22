/**
 * Pure encode/decode helpers used by the persistence bridge.
 *
 * A registered list is stored as one backend record per item (keyed by the
 * item's `id`) plus an `__order__` record that keeps the original array order.
 * Lists whose items have no unique id are stored as a single `__all__` record.
 * Maps, sets and objects are stored as a single `__value__` record.
 */
import type { StateAccessor } from './stateRegistry';

export const ALL_RECORD = '__all__';
export const ORDER_RECORD = '__order__';
export const VALUE_RECORD = '__value__';
const RESERVED = new Set([ALL_RECORD, ORDER_RECORD, VALUE_RECORD]);
const MAX_RECORD_ID_LENGTH = 200;

/** Record id -> JSON text of the record. */
export type EncodedCollection = Map<string, string>;

export interface StoredRecord {
  collection: string;
  recordId: string;
  data: unknown;
}

export interface CollectionChange {
  recordId: string;
  data: unknown;
  deleted: boolean;
}

export function recordIdOf(row: unknown): string | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const value = (row as { id?: unknown }).id;
  const id = typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
  if (!id || id.length > MAX_RECORD_ID_LENGTH || RESERVED.has(id)) return null;
  return id;
}

/** Tenant id carried by a record, either as `tenantId` or as `scope.tenantId`. */
export function tenantIdOf(row: unknown): string | undefined {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return undefined;
  const record = row as { tenantId?: unknown; scope?: { tenantId?: unknown } };
  if (typeof record.tenantId === 'string') return record.tenantId;
  if (record.scope && typeof record.scope === 'object' && typeof record.scope.tenantId === 'string') return record.scope.tenantId;
  return undefined;
}

function toJson(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value) ?? 'null';
}

export function encodeCollection(accessor: StateAccessor): EncodedCollection {
  const encoded: EncodedCollection = new Map();
  if (accessor.kind === 'value') {
    encoded.set(VALUE_RECORD, toJson(accessor.get()));
    return encoded;
  }
  const rows = accessor.get();
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = recordIdOf(row);
    if (id === null || seen.has(id)) {
      encoded.set(ALL_RECORD, toJson(rows));
      return encoded;
    }
    seen.add(id);
    ids.push(id);
  }
  rows.forEach((row, index) => encoded.set(ids[index], toJson(row)));
  encoded.set(ORDER_RECORD, toJson(ids));
  return encoded;
}

/** Loads a collection from the records returned by the backend. */
export function decodeCollection(accessor: StateAccessor, records: StoredRecord[]): void {
  if (accessor.kind === 'value') {
    const stored = records.find((record) => record.recordId === VALUE_RECORD);
    if (stored) accessor.set(stored.data);
    return;
  }
  let all: unknown;
  let order: unknown;
  const byId = new Map<string, unknown>();
  for (const record of records) {
    if (record.recordId === ALL_RECORD) all = record.data;
    else if (record.recordId === ORDER_RECORD) order = record.data;
    else byId.set(record.recordId, record.data);
  }
  if (byId.size === 0 && all !== undefined) {
    accessor.set(Array.isArray(all) ? all : []);
    return;
  }
  accessor.set(orderRows(byId, order));
}

function orderRows(byId: Map<string, unknown>, order: unknown): unknown[] {
  const result: unknown[] = [];
  const remaining = new Map(byId);
  if (Array.isArray(order)) {
    for (const id of order) {
      const key = String(id);
      if (remaining.has(key)) {
        result.push(remaining.get(key));
        remaining.delete(key);
      }
    }
  }
  for (const row of remaining.values()) result.push(row);
  return result;
}

/** Applies incremental changes pulled from the backend to a loaded collection. */
export function applyChanges(accessor: StateAccessor, changes: CollectionChange[]): void {
  if (accessor.kind === 'value') {
    const latest = [...changes].reverse().find((change) => change.recordId === VALUE_RECORD && !change.deleted);
    if (latest) accessor.set(latest.data);
    return;
  }
  const allChange = [...changes].reverse().find((change) => change.recordId === ALL_RECORD && !change.deleted);
  const recordChanges = changes.filter((change) => !RESERVED.has(change.recordId));
  if (allChange && recordChanges.length === 0) {
    accessor.set(Array.isArray(allChange.data) ? allChange.data : []);
    return;
  }
  const byId = new Map<string, unknown>();
  const unkeyed: unknown[] = [];
  for (const row of accessor.get()) {
    const id = recordIdOf(row);
    if (id === null || byId.has(id)) unkeyed.push(row);
    else byId.set(id, row);
  }
  for (const change of recordChanges) {
    if (change.deleted) byId.delete(change.recordId);
    else byId.set(change.recordId, change.data);
  }
  const orderChange = [...changes].reverse().find((change) => change.recordId === ORDER_RECORD && !change.deleted);
  const currentOrder = orderChange ? orderChange.data : accessor.get().map((row) => recordIdOf(row)).filter((id) => id !== null);
  accessor.set([...orderRows(byId, currentOrder), ...unkeyed]);
}

/** Keeps only the rows that belong to the tenant (rows without a tenant are kept). */
export function restrictToTenant(accessor: StateAccessor, tenantId: string): void {
  if (accessor.kind !== 'list') return;
  const rows = accessor.get();
  const kept = rows.filter((row) => {
    const owner = tenantIdOf(row);
    return owner === undefined || owner === '' || owner === tenantId;
  });
  if (kept.length !== rows.length) accessor.set(kept);
}

export function diffCollection(previous: EncodedCollection | undefined, current: EncodedCollection): { upserts: Array<[string, string]>; deletes: string[] } {
  const upserts: Array<[string, string]> = [];
  const deletes: string[] = [];
  for (const [id, json] of current) {
    if (previous?.get(id) !== json) upserts.push([id, json]);
  }
  if (previous) {
    for (const id of previous.keys()) {
      if (!current.has(id)) deletes.push(id);
    }
  }
  return { upserts, deletes };
}
