import assert from 'node:assert/strict';
import { apiClient, apiConfig, ApiError, type PaginatedApiResponse } from '@/core/api';
import { env } from '@/core/config/environment';

Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => 'qa-token' }, configurable: true });
let response = new Response(JSON.stringify({ id: 'record-1' }), { status: 200 });
let capturedUrl = ''; let capturedOptions: RequestInit = {};
globalThis.fetch = async (input, options) => {
  capturedUrl = String(input); capturedOptions = options ?? {};
  if (options?.signal?.aborted) throw options.signal.reason;
  return response.clone();
};
assert.equal(env.useMocks, false, 'the false environment flag is respected');
const result = await apiClient.get<{ id: string }>('/records', { params: { search: 'A & B', page: 2, enabled: false }, credentials: 'include' });
assert.deepEqual(result, { data: { id: 'record-1' }, status: 200 });
const url = new URL(capturedUrl);
assert.equal(url.pathname, '/api/v1/records'); assert.equal(url.searchParams.get('search'), 'A & B'); assert.equal(url.searchParams.get('enabled'), 'false');
assert.equal(capturedOptions.credentials, 'include');
assert.equal(new Headers(capturedOptions.headers).get('Authorization'), 'Bearer qa-token');
response = new Response('{}');
await apiClient.post('/records', false, { headers: { Authorization: 'Explicit adapter credential' } });
assert.equal(capturedOptions.body, 'false');
assert.equal(new Headers(capturedOptions.headers).get('Authorization'), 'Explicit adapter credential');
await apiClient.patch('/records', 0); assert.equal(capturedOptions.body, '0');
const file = new FormData(); file.append('file', new Blob(['content']), 'file.txt');
await apiClient.post('/uploads', file, { headers: { 'content-type': 'multipart/form-data' } });
assert.equal(capturedOptions.body, file);
assert.equal(new Headers(capturedOptions.headers).has('Content-Type'), false, 'fetch owns the multipart boundary');

const previousBase = apiConfig.baseUrl;
apiConfig.baseUrl = '/api/v1';
Object.defineProperty(globalThis, 'location', { value: { origin: 'https://erp.example.test' }, configurable: true });
await apiClient.get('records'); assert.equal(capturedUrl, 'https://erp.example.test/api/v1/records');
apiConfig.baseUrl = previousBase;
response = new Response(JSON.stringify({ data: [{ id: 'record-1' }], total: 1, page: 1, pageSize: 10 }));
const page: PaginatedApiResponse<{ id: string }> = await apiClient.get('/records');
assert.equal(page.data.total, 1); assert.equal(page.data.data[0].id, 'record-1');
response = new Response(null, { status: 204 });
assert.deepEqual(await apiClient.delete<void>('/records/record-1'), { data: undefined, status: 204 });

response = new Response(JSON.stringify({ status: 200, message: 'Invalid record', code: 'VALIDATION', errors: { name: ['Required'], unsafe: [false], scalar: 'wrong' } }), { status: 422 });
await assert.rejects(apiClient.post('/records', {}), (error: unknown) => {
  assert.ok(error instanceof ApiError); assert.equal(error.status, 422); assert.ok(error.isValidation);
  assert.equal(error.message, 'Invalid record'); assert.equal(error.code, 'VALIDATION'); assert.deepEqual(error.errors, { name: ['Required'] }); return true;
});
for (const body of ['null', '[]', '{"message":42,"code":false,"errors":[]}','not JSON']) {
  response = new Response(body, { status: 403, statusText: 'Forbidden' });
  await assert.rejects(apiClient.get('/records'), (error: unknown) => error instanceof ApiError && error.isForbidden && error.message === 'Forbidden');
}
const abort = new AbortController(); const reason = new DOMException('Cancelled', 'AbortError'); abort.abort(reason);
await assert.rejects(apiClient.get('/records', { signal: abort.signal }), error => error === reason);
console.log('API QA passed: transport/pagination contracts, URL/query encoding, credentials, JSON/multipart bodies, no-content responses, safe HTTP errors, cancellation and mock configuration. No live backend calls were made.');
