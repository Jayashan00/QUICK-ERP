import assert from 'node:assert/strict';
import { saveInquiry, readInquiries, changeInquiryStatus, InquiryApiError } from '../src/features/inquiry-admin/inquiryStorage';
import { env } from '../src/core/config/environment';
import { APP_CONSTANTS } from '../src/shared/constants/appConstants';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => storage.get(key) ?? null } });
env.useMocks = false;
const inquiry = {
  id: 'test-inquiry', name: 'Customer', email: 'customer@example.test', company: 'Test company',
  phone: null, interest: 'ERP', message: 'Please arrange a demo', status: 'new' as const,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: null,
};
let expectedMethod = 'POST';
let expectedPath = '/website-api/inquiries';
let expectedToken: string | null = null;
let status = 201;
let responseBody: unknown = { id: inquiry.id, createdAt: inquiry.createdAt };
globalThis.fetch = async (input, options) => {
  assert.equal(input, expectedPath);
  assert.equal(options?.method ?? 'GET', expectedMethod);
  const headers = new Headers(options?.headers);
  assert.equal(headers.get('Authorization'), expectedToken);
  if (expectedMethod === 'PATCH') assert.deepEqual(JSON.parse(String(options?.body)), { status: 'contacted', previous: 'new' });
  return new Response(JSON.stringify(responseBody), { status, headers: { 'Content-Type': 'application/json' } });
};

await saveInquiry({ ...inquiry, contact_check: '' });
assert.throws(() => readInquiries(), (error: unknown) => error instanceof InquiryApiError && error.status === 401);
storage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, 'erp-session');
expectedToken = 'Bearer erp-session';
expectedMethod = 'GET';
responseBody = [inquiry];
status = 200;
assert.deepEqual(await readInquiries(), [inquiry]);
expectedMethod = 'PATCH';
expectedPath += '/test-inquiry';
responseBody = { ...inquiry, status: 'contacted', updatedBy: 'super@example.test' };
assert.deepEqual(await changeInquiryStatus(inquiry, 'contacted'), responseBody);
status = 409;
responseBody = { error: 'The inquiry has changed.' };
await assert.rejects(changeInquiryStatus(inquiry, 'contacted'), (error: unknown) => error instanceof InquiryApiError && error.status === 409);
expectedMethod = 'GET';
expectedPath = '/website-api/inquiries';
status = 403;
responseBody = { error: 'Only ERP super admins can manage website inquiries.' };
await assert.rejects(readInquiries(), (error: unknown) => error instanceof InquiryApiError && error.status === 403);
status = 401;
await assert.rejects(readInquiries(), (error: unknown) => error instanceof InquiryApiError && error.status === 401);
env.useMocks = true;
assert.throws(() => readInquiries(), /require the ERP backend/);
// The public form must never send an administrator's token, even in the same browser.
expectedToken = null;
expectedMethod = 'POST';
status = 201;
responseBody = { id: inquiry.id, createdAt: inquiry.createdAt };
await saveInquiry({ ...inquiry, contact_check: '' });
console.log('Inquiry client QA passed: public submissions, ERP bearer tokens, status edits, access errors, conflicts, and demo-mode guidance.');
