import assert from 'node:assert/strict';
import { ApiError } from '@/core/api/apiError';
import {
  getMaintenanceState,
  subscribeMaintenance,
  triggerMaintenance,
  clearMaintenanceState,
  checkMaintenanceStatus,
} from '@/core/maintenance/maintenanceState';

console.log('Running VYRO Maintenance Mode Frontend QA tests...');

// 1. ApiError maintenance classification
const maintError = new ApiError({
  status: 503,
  code: 'PLATFORM_MAINTENANCE',
  message: 'System upgrade in progress.',
  expectedEndTime: '2026-11-20T04:00:00Z',
  startAt: '2026-11-19T22:00:00Z',
});

assert.equal(maintError.status, 503, 'ApiError retains HTTP 503 status');
assert.equal(maintError.code, 'PLATFORM_MAINTENANCE', 'ApiError retains code');
assert.equal(maintError.isMaintenance, true, 'isMaintenance returns true for 503 PLATFORM_MAINTENANCE');
assert.equal(maintError.expectedEndTime, '2026-11-20T04:00:00Z', 'expectedEndTime is accessible');
assert.equal(maintError.startAt, '2026-11-19T22:00:00Z', 'startAt is accessible');

const normalError = new ApiError({
  status: 400,
  code: 'BAD_REQUEST',
  message: 'Invalid payload',
});
assert.equal(normalError.isMaintenance, false, 'isMaintenance returns false for non-503 errors');

// 2. Maintenance state reactivity & triggers
let notifiedState = getMaintenanceState();
const unsubscribe = subscribeMaintenance((state) => {
  notifiedState = state;
});

triggerMaintenance({
  message: 'Emergency maintenance underway.',
  startAt: '2026-11-19T22:00:00Z',
  endAt: '2026-11-20T02:00:00Z',
});

assert.equal(notifiedState.active, true, 'Subscriber received active maintenance notification');
assert.equal(notifiedState.message, 'Emergency maintenance underway.', 'Subscriber received custom message');
assert.equal(notifiedState.endAt, '2026-11-20T02:00:00Z', 'Subscriber received end time');

clearMaintenanceState();
assert.equal(notifiedState.active, false, 'Clear maintenance resets active state');
unsubscribe();

// 3. Mock fetch for status polling
const previousFetch = globalThis.fetch;
try {
  let fetchCalled = false;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    fetchCalled = true;
    const url = String(input);
    assert.ok(url.includes('/platform/maintenance/status'), 'Polls correct status URL');
    return new Response(
      JSON.stringify({
        active: true,
        enabled: true,
        message: 'Database optimization in progress.',
        startAt: '2026-11-19T20:00:00Z',
        endAt: '2026-11-20T05:00:00Z',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const status = await checkMaintenanceStatus();
  assert.ok(fetchCalled, 'checkMaintenanceStatus performed fetch');
  assert.equal(status.active, true);
  assert.equal(status.message, 'Database optimization in progress.');
  assert.equal(status.endAt, '2026-11-20T05:00:00Z');
} finally {
  globalThis.fetch = previousFetch;
}

console.log('VYRO Maintenance Mode Frontend QA tests PASSED successfully!');
