/**
 * Persistence bridge between the in-memory feature services and the backend.
 *
 * Tenant mode (signed-in users):
 *   1. Loads every registered collection for the user's tenant from GET /state.
 *      Collections the tenant has never saved are seeded from the built-in
 *      starter data (records of other tenants are dropped first).
 *   2. After each successful mutation, and every few seconds, compares every
 *      collection with the last saved snapshot and sends only the changed
 *      records to POST /state/batch.
 *   3. Pulls changes saved by other users from GET /state/changes and merges
 *      them into memory, then refreshes the React Query cache.
 *
 * Public mode (the customer web shop, no sign-in):
 *   Loads the read-only shop collections and saves new web orders and reviews.
 */
import { apiClient, ApiError } from '@/core/api';
import { queryClient } from '@/core/api/query';
import { getStateAccessor, getStateAccessors, type StateAccessor } from './stateRegistry';
import {
  ALL_RECORD,
  ORDER_RECORD,
  VALUE_RECORD,
  applyChanges,
  decodeCollection,
  diffCollection,
  encodeCollection,
  restrictToTenant,
  type CollectionChange,
  type EncodedCollection,
  type StoredRecord,
} from './stateCodec';

interface VersionedRecord extends StoredRecord {
  /** Goes up by one with every save on the server; sent back to detect edit conflicts. */
  version?: number;
}

interface StateResponse {
  cursor: number;
  collections: string[];
  records: VersionedRecord[];
}

interface ChangeRecord extends VersionedRecord {
  deleted: boolean;
}

interface ChangesResponse {
  cursor: number;
  records: ChangeRecord[];
}

interface BatchChange {
  collection: string;
  recordId: string;
  data: unknown;
  deleted: boolean;
  /** Version of the record this change is based on (0 = a new record); omitted for list order records. */
  baseVersion?: number;
}

interface BatchConflict {
  collection: string;
  recordId: string;
  data: unknown;
  deleted: boolean;
  version: number;
}

interface BatchResponse {
  cursor: number;
  applied: number;
  rejected: Array<{ collection: string; recordId: string; message: string }>;
  /** Changes refused because someone else saved the record first; the latest saved version is included. */
  conflicts?: BatchConflict[];
  /** The version each saved record has now. */
  versions?: Array<{ collection: string; recordId: string; version: number }>;
}

/** Collections that must always reach the server in the same request (stock balances and their movements). */
const LINKED_COLLECTIONS = new Set(['inventory.balances', 'inventory.movements']);
const CONFLICT_MESSAGE = 'Someone else saved a record you changed at the same time. Their latest version is now shown; please check it and make your change again.';

export type PersistenceStatus = 'idle' | 'loading' | 'synced' | 'saving' | 'offline';

type Mode = 'idle' | 'tenant' | 'public';

const SYNC_INTERVAL_MS = 5000;
const MUTATION_DEBOUNCE_MS = 250;
const MAX_CHANGES_PER_BATCH = 400;
const MAX_BATCH_CHARACTERS = 3_000_000;
export const PUBLIC_WRITABLE_COLLECTIONS = ['storefront.orders', 'storefront.reviews'] as const;

function createClientId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function groupByCollection<T extends StoredRecord>(records: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const list = grouped.get(record.collection);
    if (list) list.push(record);
    else grouped.set(record.collection, [record]);
  }
  return grouped;
}

function jsonOf(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value) ?? 'null';
}

class PersistenceBridge {
  private mode: Mode = 'idle';
  private scopeId = '';
  private generation = 0;
  private cursor = 0;
  private snapshot = new Map<string, EncodedCollection>();
  /** Server version of every loaded record, by collection and record id. */
  private versions = new Map<string, Map<string, number>>();
  /** Collections loaded in this session; only these are ever saved. */
  private loadedKeys = new Set<string>();
  private readonly clientId = createClientId();
  private timer: ReturnType<typeof setInterval> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private again = false;
  private unsubscribeMutations: (() => void) | null = null;
  private status: PersistenceStatus = 'idle';
  private readonly listeners = new Set<(status: PersistenceStatus) => void>();
  private unauthorizedHandler: (() => void) | null = null;
  private reportedRejections = new Set<string>();
  private rejectionHandler: ((message: string) => void) | null = null;

  get currentStatus(): PersistenceStatus {
    return this.status;
  }

  subscribe(listener: (status: PersistenceStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onUnauthorized(handler: (() => void) | null): void {
    this.unauthorizedHandler = handler;
  }

  onRejected(handler: ((message: string) => void) | null): void {
    this.rejectionHandler = handler;
  }

  private setStatus(status: PersistenceStatus) {
    if (this.status === status) return;
    this.status = status;
    this.listeners.forEach((listener) => listener(status));
  }

  private setVersion(collection: string, recordId: string, version: number | undefined) {
    if (typeof version !== 'number' || !Number.isFinite(version)) return;
    let byRecord = this.versions.get(collection);
    if (!byRecord) {
      byRecord = new Map();
      this.versions.set(collection, byRecord);
    }
    byRecord.set(recordId, version);
  }

  private baseVersionOf(collection: string, recordId: string): number | undefined {
    if (this.mode !== 'tenant' || recordId === ORDER_RECORD) return undefined;
    return this.versions.get(collection)?.get(recordId) ?? 0;
  }

  private get headers() {
    return { 'X-Client-Id': this.clientId };
  }

  stop(): void {
    this.generation += 1;
    this.mode = 'idle';
    this.scopeId = '';
    this.cursor = 0;
    this.snapshot = new Map();
    this.versions = new Map();
    this.loadedKeys = new Set();
    if (this.timer) clearInterval(this.timer);
    if (this.debounce) clearTimeout(this.debounce);
    this.timer = null;
    this.debounce = null;
    this.unsubscribeMutations?.();
    this.unsubscribeMutations = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
    this.setStatus('idle');
  }

  /** Loads the signed-in tenant's data. `scopeId` is the tenant id, or "platform" for Super Admin. */
  async startTenant(scopeId: string): Promise<void> {
    this.stop();
    const generation = this.generation;
    this.setStatus('loading');
    const { data } = await apiClient.get<StateResponse>('/state', { headers: this.headers });
    if (generation !== this.generation) return;

    const grouped = groupByCollection(data.records);
    for (const record of data.records) this.setVersion(record.collection, record.recordId, record.version);
    const known = new Set(data.collections);
    const seeding: string[] = [];
    for (const accessor of getStateAccessors()) {
      this.loadedKeys.add(accessor.key);
      const stored = grouped.get(accessor.key);
      if (known.has(accessor.key) || stored) {
        decodeCollection(accessor, stored ?? []);
        this.snapshot.set(accessor.key, encodeCollection(accessor));
      } else {
        restrictToTenant(accessor, scopeId);
        seeding.push(accessor.key);
      }
    }
    this.mode = 'tenant';
    this.scopeId = scopeId;
    this.cursor = data.cursor;
    await this.flush(seeding);
    if (generation !== this.generation) return;
    this.beginLoop();
  }

  /** Loads the public shop data for a tenant (customer storefront, no sign-in). */
  async startPublic(tenantId: string): Promise<void> {
    this.stop();
    const generation = this.generation;
    this.setStatus('loading');
    const base = `/public/shop/${encodeURIComponent(tenantId)}`;
    const { data } = await apiClient.get<StateResponse>(`${base}/state`);
    if (generation !== this.generation) return;

    const grouped = groupByCollection(data.records);
    for (const key of data.collections) {
      const accessor = getStateAccessor(key);
      if (accessor) decodeCollection(accessor, grouped.get(key) ?? []);
    }
    this.mode = 'public';
    this.scopeId = tenantId;
    for (const key of PUBLIC_WRITABLE_COLLECTIONS) {
      const accessor = getStateAccessor(key);
      if (!accessor) continue;
      this.loadedKeys.add(key);
      this.snapshot.set(key, encodeCollection(accessor));
    }
    const orderMatch = /\/orders\/([^/?#]+)/.exec(window.location.pathname);
    if (orderMatch) await this.loadPublicOrder(decodeURIComponent(orderMatch[1]), generation);
    if (generation !== this.generation) return;
    this.beginLoop();
  }

  private async loadPublicOrder(orderId: string, generation: number) {
    const accessor = getStateAccessor('storefront.orders');
    if (!accessor) return;
    try {
      const { data } = await apiClient.get<unknown>(`/public/shop/${encodeURIComponent(this.scopeId)}/orders/${encodeURIComponent(orderId)}`);
      if (generation !== this.generation || !data) return;
      applyChanges(accessor, [{ recordId: orderId, data, deleted: false }]);
      this.snapshot.set(accessor.key, encodeCollection(accessor));
    } catch {
      // Unknown order ids show the storefront's own "order not found" state.
    }
  }

  private beginLoop() {
    this.setStatus('synced');
    this.timer = setInterval(() => void this.tick(), SYNC_INTERVAL_MS);
    this.unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.mutation.state.status === 'success') this.scheduleFlush();
    });
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private readonly handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.mode === 'idle' || !this.hasPendingChanges()) return;
    void this.flush();
    event.preventDefault();
    event.returnValue = '';
  };

  private readonly handleVisibility = () => {
    if (document.visibilityState === 'hidden') void this.flush();
    else void this.tick();
  };

  scheduleFlush(): void {
    if (this.mode === 'idle') return;
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.debounce = null;
      void this.flush();
    }, MUTATION_DEBOUNCE_MS);
  }

  private async tick() {
    if (this.mode === 'idle') return;
    await this.flush();
    if (this.mode === 'tenant') await this.pull();
  }

  private writableAccessors(): StateAccessor[] {
    if (this.mode !== 'public') return getStateAccessors();
    return PUBLIC_WRITABLE_COLLECTIONS.map((key) => getStateAccessor(key)).filter((accessor): accessor is StateAccessor => Boolean(accessor));
  }

  private collectChanges(): { changes: BatchChange[]; encoded: Map<string, EncodedCollection> } {
    const changes: BatchChange[] = [];
    const encoded = new Map<string, EncodedCollection>();
    for (const accessor of this.writableAccessors()) {
      if (!this.loadedKeys.has(accessor.key)) continue;
      let current: EncodedCollection;
      try {
        current = encodeCollection(accessor);
      } catch (error) {
        console.error(`Quick ERP could not prepare "${accessor.key}" for saving.`, error);
        continue;
      }
      const { upserts, deletes } = diffCollection(this.snapshot.get(accessor.key), current);
      const isPublic = this.mode === 'public';
      let changed = false;
      for (const [recordId, json] of upserts) {
        if (isPublic && (recordId === ORDER_RECORD || recordId === ALL_RECORD || recordId === VALUE_RECORD)) continue;
        changes.push({ collection: accessor.key, recordId, data: JSON.parse(json) as unknown, deleted: false, baseVersion: this.baseVersionOf(accessor.key, recordId) });
        changed = true;
      }
      if (!isPublic) {
        for (const recordId of deletes) {
          changes.push({ collection: accessor.key, recordId, data: null, deleted: true, baseVersion: this.baseVersionOf(accessor.key, recordId) });
          changed = true;
        }
      }
      if (changed || !this.snapshot.has(accessor.key)) encoded.set(accessor.key, current);
    }
    return { changes, encoded };
  }

  hasPendingChanges(): boolean {
    try {
      return this.collectChanges().changes.length > 0;
    } catch {
      return false;
    }
  }

  /** Sends every local change to the backend. `seeded` marks collections saved for the first time. */
  async flush(seeded: string[] = []): Promise<void> {
    if (this.mode === 'idle' && seeded.length === 0) return;
    if (this.busy) {
      this.again = true;
      return;
    }
    this.busy = true;
    const generation = this.generation;
    try {
      const { changes, encoded } = this.collectChanges();
      if (changes.length === 0 && seeded.length === 0) {
        for (const [key, value] of encoded) this.snapshot.set(key, value);
        if (this.status !== 'synced') this.setStatus('synced');
        return;
      }
      this.setStatus('saving');
      const batches = this.chunk(changes);
      if (batches.length === 0) batches.push([]);
      const path = this.mode === 'public' ? `/public/shop/${encodeURIComponent(this.scopeId)}/batch` : '/state/batch';
      const conflicts: BatchConflict[] = [];
      for (let index = 0; index < batches.length; index += 1) {
        const isLast = index === batches.length - 1;
        const body = { clientId: this.clientId, changes: batches[index], seeded: isLast ? seeded : [] };
        const { data } = await apiClient.post<BatchResponse>(path, body, { headers: this.headers });
        if (generation !== this.generation) return;
        this.reportRejections(data.rejected ?? []);
        for (const saved of data.versions ?? []) this.setVersion(saved.collection, saved.recordId, saved.version);
        conflicts.push(...(data.conflicts ?? []));
      }
      for (const [key, value] of encoded) this.snapshot.set(key, value);
      if (conflicts.length > 0) await this.applyConflicts(conflicts);
      this.setStatus('synced');
    } catch (error) {
      this.handleError(error);
      if (seeded.length > 0) throw error;
    } finally {
      this.busy = false;
      if (this.again) {
        this.again = false;
        this.scheduleFlush();
      }
    }
  }

  /** Shows the latest saved version of records whose change was refused because someone else saved them first. */
  private async applyConflicts(conflicts: BatchConflict[]) {
    const byCollection = new Map<string, BatchConflict[]>();
    for (const conflict of conflicts) byCollection.set(conflict.collection, [...(byCollection.get(conflict.collection) ?? []), conflict]);
    for (const [key, items] of byCollection) {
      const accessor = getStateAccessor(key);
      if (!accessor) continue;
      const changes: CollectionChange[] = items.map((item) => ({ recordId: item.recordId, data: item.data, deleted: item.deleted }));
      applyChanges(accessor, changes);
      const snapshot = new Map(this.snapshot.get(key) ?? []);
      for (const item of items) {
        this.setVersion(key, item.recordId, item.version);
        if (item.deleted) snapshot.delete(item.recordId);
        else snapshot.set(item.recordId, jsonOf(item.data));
      }
      if (accessor.kind === 'list') {
        const order = encodeCollection(accessor).get(ORDER_RECORD);
        if (order !== undefined) snapshot.set(ORDER_RECORD, order);
      }
      this.snapshot.set(key, snapshot);
    }
    await queryClient.invalidateQueries();
    this.rejectionHandler?.(CONFLICT_MESSAGE);
  }

  /** Splits changes into requests; stock balances and their movements always travel together, first. */
  private chunk(all: BatchChange[]): BatchChange[][] {
    const linked = all.filter((change) => LINKED_COLLECTIONS.has(change.collection));
    const changes = all.filter((change) => !LINKED_COLLECTIONS.has(change.collection));
    const batches: BatchChange[][] = linked.length > 0 ? [linked] : [];
    let current: BatchChange[] = [];
    let size = 0;
    for (const change of changes) {
      const changeSize = jsonOf(change.data).length + change.collection.length + change.recordId.length;
      if (current.length > 0 && (current.length >= MAX_CHANGES_PER_BATCH || size + changeSize > MAX_BATCH_CHARACTERS)) {
        batches.push(current);
        current = [];
        size = 0;
      }
      current.push(change);
      size += changeSize;
    }
    if (current.length > 0) batches.push(current);
    return batches;
  }

  private async pull() {
    if (this.mode !== 'tenant' || this.busy) return;
    const generation = this.generation;
    try {
      const { data } = await apiClient.get<ChangesResponse>('/state/changes', {
        headers: this.headers,
        params: { since: this.cursor },
      });
      if (generation !== this.generation) return;
      if (this.busy) return; // a save started meanwhile; the next tick pulls again from the same cursor
      const grouped = groupByCollection(data.records);
      let applied = false;
      for (const [key, records] of grouped) {
        const accessor = getStateAccessor(key);
        if (!accessor) continue;
        const changes: CollectionChange[] = records.map((record) => ({ recordId: record.recordId, data: record.data, deleted: record.deleted }));
        for (const record of records) this.setVersion(key, record.recordId, record.version);
        applyChanges(accessor, changes);
        const snapshot = new Map(this.snapshot.get(key) ?? []);
        for (const change of changes) {
          if (change.deleted) snapshot.delete(change.recordId);
          else snapshot.set(change.recordId, jsonOf(change.data));
        }
        if (accessor.kind === 'list') {
          const order = encodeCollection(accessor).get(ORDER_RECORD);
          if (order !== undefined) snapshot.set(ORDER_RECORD, order);
        }
        this.snapshot.set(key, snapshot);
        applied = true;
      }
      this.cursor = Math.max(this.cursor, data.cursor);
      if (applied) await queryClient.invalidateQueries();
      if (this.status === 'offline') this.setStatus('synced');
    } catch (error) {
      this.handleError(error);
    }
  }

  private reportRejections(rejected: BatchResponse['rejected']) {
    for (const item of rejected) {
      const key = `${item.collection}:${item.recordId}:${item.message}`;
      if (this.reportedRejections.has(key)) continue;
      this.reportedRejections.add(key);
      console.warn(`Quick ERP server rejected ${item.collection}/${item.recordId}: ${item.message}`);
      this.rejectionHandler?.(item.message);
    }
  }

  private handleError(error: unknown) {
    if (error instanceof ApiError && error.status === 401 && this.mode === 'tenant') {
      this.unauthorizedHandler?.();
      return;
    }
    console.warn('Quick ERP could not reach the server; changes will be saved when the connection returns.', error);
    this.setStatus('offline');
  }
}

export const persistenceBridge = new PersistenceBridge();
