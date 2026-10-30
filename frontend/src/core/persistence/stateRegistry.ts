/**
 * State registry for backend persistence.
 *
 * Feature services keep their records in module-level arrays, maps and objects.
 * Each service registers those holders here with a getter and a setter. The
 * persistence bridge (see persistenceBridge.ts) uses the registry to load the
 * tenant's data from the backend into those holders, and to detect and save
 * changes after the existing business logic has run.
 *
 * This module has no imports and no side effects, so it is safe to load from
 * the Node-based QA scripts as well as from the browser.
 */

export type ListAccessor = {
  kind: 'list';
  key: string;
  get: () => unknown[];
  set: (rows: unknown[]) => void;
};

export type ValueAccessor = {
  kind: 'value';
  key: string;
  get: () => unknown;
  set: (value: unknown) => void;
};

export type StateAccessor = ListAccessor | ValueAccessor;

const registry = new Map<string, StateAccessor>();

function add(accessor: StateAccessor) {
  const existing = registry.get(accessor.key);
  if (existing && import.meta.hot) {
    // Vite can re-evaluate a service module while preserving this registry module.
    // Rehydrate the replacement accessor so HMR neither crashes nor resets mock state.
    if (existing.kind !== accessor.kind) {
      throw new Error(`Persistence key "${accessor.key}" changed registration kind during hot reload.`);
    }
    if (accessor.kind === 'list' && existing.kind === 'list') accessor.set(existing.get());
    if (accessor.kind === 'value' && existing.kind === 'value') accessor.set(existing.get());
    registry.set(accessor.key, accessor);
    return;
  }
  if (existing) {
    throw new Error(`Persistence key "${accessor.key}" is registered twice.`);
  }
  registry.set(accessor.key, accessor);
}

/** Replaces the contents of an array in place, keeping the same array reference. */
export function replaceArray<T>(target: T[], rows: readonly T[]): void {
  target.length = 0;
  for (const row of rows) target.push(row);
}

/** Registers an array of records. Records with a unique `id` are stored one row per record. */
export function registerList<T>(key: string, get: () => T[], set: (rows: T[]) => void): void {
  add({
    kind: 'list',
    key,
    get: get as () => unknown[],
    set: set as (rows: unknown[]) => void,
  });
}

/** Registers a Map. It is stored as one value (an array of [key, value] entries). */
export function registerMap<K, V>(key: string, map: Map<K, V>): void {
  add({
    kind: 'value',
    key,
    get: () => Array.from(map.entries()),
    set: (value) => {
      map.clear();
      if (!Array.isArray(value)) return;
      for (const entry of value) {
        if (Array.isArray(entry) && entry.length === 2) map.set(entry[0] as K, entry[1] as V);
      }
    },
  });
}

/** Registers a Set. It is stored as one value (an array of members). */
export function registerSet<V>(key: string, set: Set<V>): void {
  add({
    kind: 'value',
    key,
    get: () => Array.from(set.values()),
    set: (value) => {
      set.clear();
      if (!Array.isArray(value)) return;
      for (const item of value) set.add(item as V);
    },
  });
}

/** Registers a plain object whose properties are replaced in place on load. */
export function registerObject<T extends object>(key: string, target: T): void {
  add({
    kind: 'value',
    key,
    get: () => target,
    set: (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const record = target as Record<string, unknown>;
      for (const property of Object.keys(record)) delete record[property];
      Object.assign(record, value as Record<string, unknown>);
    },
  });
}

export function getStateAccessors(): StateAccessor[] {
  return Array.from(registry.values());
}

export function getStateAccessor(key: string): StateAccessor | undefined {
  return registry.get(key);
}
