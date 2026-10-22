/**
 * Exports the frontend's built-in starter data for one tenant as the backend
 * seed file (../backend/src/main/resources/seed/starter-data.json, next to the frontend folder).
 *
 * The backend writes this data on an empty database, so the starter tenant is
 * complete before anyone signs in and no browser has to upload roles or users.
 *
 * Run from the frontend root:  npm run seed:export
 */
import { writeFileSync } from 'node:fs';
import '../src/core/persistence/registeredStores';
import { getStateAccessors } from '../src/core/persistence/stateRegistry';
import { encodeCollection, restrictToTenant } from '../src/core/persistence/stateCodec';

const tenantId = process.env.SEED_TENANT ?? 'tenant-001';
const output = process.env.SEED_OUTPUT ?? '../backend/src/main/resources/seed/starter-data.json';
// Platform-only data is created by the Super Admin console, not copied into a tenant.
const skipped = new Set(['platform.foundation']);

const collections: Record<string, Record<string, unknown>> = {};
for (const accessor of getStateAccessors()) {
  if (skipped.has(accessor.key)) continue;
  restrictToTenant(accessor, tenantId);
  const records: Record<string, unknown> = {};
  for (const [recordId, json] of encodeCollection(accessor)) records[recordId] = JSON.parse(json);
  if (accessor.key === 'core.users') {
    // Only this tenant's accounts; never a Super Admin flag.
    const keep = (user: { tenantId?: string; isSuperAdmin?: boolean }) => user.tenantId === tenantId && !user.isSuperAdmin;
    const clean = (user: Record<string, unknown>) => { const copy = { ...user }; delete copy.isSuperAdmin; return copy; };
    if (Array.isArray(records.__all__)) {
      records.__all__ = (records.__all__ as Array<Record<string, unknown>>).filter((user) => keep(user)).map(clean);
    } else {
      for (const [recordId, value] of Object.entries(records)) {
        if (recordId.startsWith('__')) continue;
        if (!keep(value as { tenantId?: string })) delete records[recordId];
        else records[recordId] = clean(value as Record<string, unknown>);
      }
      records.__order__ = Object.keys(records).filter((id) => !id.startsWith('__'));
    }
  }
  collections[accessor.key] = records;
}

writeFileSync(output, `${JSON.stringify({ tenantId, generatedAt: new Date().toISOString(), collections })}\n`);
console.log(`Exported ${Object.keys(collections).length} collections for ${tenantId} to ${output}`);
