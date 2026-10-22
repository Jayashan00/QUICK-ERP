/**
 * End-to-end check of the frontend's data sync against a RUNNING Quick ERP backend.
 * Uses the demo starter accounts and adds test records (a customer, 450 notifications, 3 units of stock),
 * so run it only on a development database with demo data, never on a live system.
 *
 *   npm run qa:backend                       (backend at http://localhost:8000/api/v1, password QuickERP123!)
 *   E2E_API=... E2E_PASSWORD=... npm run qa:backend
 */
import './backend-e2e-shims';
import '@/core/persistence/registeredStores';
import { persistenceBridge } from '@/core/persistence/persistenceBridge';
import { authenticateWithBackend } from '@/core/persistence/backendSession';
import { getStateAccessor } from '@/core/persistence/stateRegistry';

const API = process.env.E2E_API ?? 'http://localhost:8000/api/v1';
const PASSWORD = process.env.E2E_PASSWORD ?? 'QuickERP123!';
let failures = 0;
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };
const messages: string[] = [];
persistenceBridge.onRejected((m) => messages.push(m));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test code works with records of every collection
const list = (key: string) => getStateAccessor(key)!.get() as any[];

async function otherUser(email: string) {
  const login = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) })).json();
  const headers = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json', 'X-Client-Id': `other-${email}` };
  return {
    record: async (collection: string, recordId: string) => {
      const state = await (await fetch(`${API}/state`, { headers })).json();
      return (state.records as Array<{ collection: string; recordId: string; data: Record<string, unknown> & { name?: string; quantityOnHand?: number }; version: number }>)
        .find((r) => r.collection === collection && r.recordId === recordId);
    },
    save: async (collection: string, recordId: string, data: unknown, baseVersion: number) =>
      (await fetch(`${API}/state/batch`, { method: 'POST', headers, body: JSON.stringify({ clientId: `other-${email}`, changes: [{ collection, recordId, data, deleted: false, baseVersion }], seeded: [] }) })).json(),
  };
}

console.log(`End-to-end check of the frontend sync against the backend at ${API}`);
await authenticateWithBackend('admin@quickerp.test', PASSWORD);
await persistenceBridge.startTenant('tenant-001');
check(list('core.roles').some((r) => r.id === 'role-001'), 'frontend signs in and loads the server data (roles present)');
check(messages.length === 0, 'first load causes no rejected saves');

// 1. A change made in the frontend is saved on the server.
list('customers.records').push({ id: 'cust-e2e', tenantId: 'tenant-001', branchId: 'branch-001', name: 'E2E Customer' });
await persistenceBridge.flush();
const sales = await otherUser('sales@quickerp.test');
const saved = await sales.record('customers.records', 'cust-e2e');
check(saved?.data?.name === 'E2E Customer', 'a new record saved by the frontend is on the server');

// 2. Edit conflict: another user saves first; the frontend's stale save is refused and the latest version shown.
const otherSave = await sales.save('customers.records', 'cust-e2e', { ...saved.data, name: 'Changed by sales' }, saved.version);
check(otherSave.applied === 1, 'another user changes the same record');
list('customers.records').find((c) => c.id === 'cust-e2e').name = 'Changed by admin';
await persistenceBridge.flush();
check(messages.some((m) => m.includes('Someone else saved')), 'the frontend reports the edit conflict');
check(list('customers.records').find((c) => c.id === 'cust-e2e').name === 'Changed by sales', 'the frontend now shows the other user\'s latest version');
check((await sales.record('customers.records', 'cust-e2e')).data.name === 'Changed by sales', 'the other user\'s change was NOT overwritten');
messages.length = 0;
list('customers.records').find((c) => c.id === 'cust-e2e').name = 'Admin, second try';
await persistenceBridge.flush();
check(messages.length === 0 && (await sales.record('customers.records', 'cust-e2e')).data.name === 'Admin, second try', 'saving again on the latest version works');

// 3. Changes by other users arrive in the frontend.
const latest = await sales.record('customers.records', 'cust-e2e');
await sales.save('customers.records', 'cust-e2e', { ...latest.data, name: 'Pulled change' }, latest.version);
await (persistenceBridge as unknown as { pull(): Promise<void> }).pull();
check(list('customers.records').find((c) => c.id === 'cust-e2e').name === 'Pulled change', 'another user\'s change is pulled into the frontend');

// 4. Stock: a balance and its movement are saved together, even in a large save that is split into several requests.
const balance = list('inventory.balances').find((b) => typeof b.quantityOnHand === 'number')!;
const before = balance.quantityOnHand;
for (let i = 0; i < 450; i++) list('notifications.records').push({ id: `n-e2e-${i}`, tenantId: 'tenant-001', title: 'bulk', read: false });
balance.quantityOnHand = before + 3;
list('inventory.movements').push({ id: 'mv-e2e-1', tenantId: balance.tenantId, branchId: balance.branchId, warehouseId: balance.warehouseId, locationId: balance.locationId,
  productId: balance.productId, ...(balance.variantId ? { variantId: balance.variantId } : {}), type: 'goods_receipt', quantity: 3, quantityBefore: before, quantityAfter: before + 3,
  referenceNumber: 'E2E', movementDate: '2026-10-19', createdByName: 'E2E' });
messages.length = 0;
await persistenceBridge.flush();
check(messages.length === 0, 'large save (450+ records, split into requests) has no rejections');
check((await sales.record('inventory.balances', balance.id)).data.quantityOnHand === before + 3, 'stock received with its movement is on the server');
check(Boolean(await sales.record('notifications.records', 'n-e2e-449')), 'every part of the split save arrived');

// 5. Stock changed without a movement is refused by the server and reported.
balance.quantityOnHand = before + 100;
await persistenceBridge.flush();
check(messages.some((m) => m.includes('stock movements')), 'stock changed without a movement is refused and reported');
check((await sales.record('inventory.balances', balance.id)).data.quantityOnHand === before + 3, 'the server stock was not changed');

persistenceBridge.stop();
console.log(failures === 0 ? 'All end-to-end checks passed.' : `${failures} end-to-end check(s) failed.`);
process.exit(failures);
