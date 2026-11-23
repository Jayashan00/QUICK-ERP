import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { createInquiryService } from './server.mjs';

test('contact inquiries are preserved and managed only by ERP super admins', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'vyro-inquiry-test-'));
  const tokens = new Map([
    ['super-token', { email: 'super@example.test', isSuperAdmin: true }],
    ['tenant-token', { email: 'admin@example.test' }],
    ['false-token', { email: 'admin@example.test', isSuperAdmin: false }],
    ['fake-role', { email: 'admin@example.test', isSuperAdmin: 'true' }],
  ]);
  let offline = false;
  let authCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    authCalls++;
    assert.equal(url, 'http://erp.test/api/v1/auth/me');
    const user = tokens.get(options.headers.Authorization?.replace(/^Bearer /, ''));
    return new Response(JSON.stringify(user ? { user } : { error: 'Unauthorized' }), {
      status: offline ? 503 : user ? 200 : 401, headers: { 'Content-Type': 'application/json' },
    });
  };
  let service = createInquiryService({ directory, erpApiUrl: 'http://erp.test/api/v1/' });
  async function call(path = '/website-api/inquiries', method = 'GET', token, body, extraHeaders = {}) {
    const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    request.url = path;
    request.method = method;
    request.headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...extraHeaders };
    let status;
    let data;
    const response = {
      writeHead(code) { status = code; },
      end(value) { data = JSON.parse(value); },
    };
    await service.handler(request, response);
    assert.ok(status, 'handler must send a response');
    return { status, data };
  }
  const details = { name: 'Contact customer', email: 'customer@example.test', company: 'Test company', phone: '+94123456789', interest: 'ERP demo', message: 'Please contact me.', contact_check: '' };
  let id;
  try {
    await t.test('public contact submission persists without ERP authentication', async () => {
      offline = true;
      const saved = await call(undefined, 'POST', undefined, details);
      assert.equal(saved.status, 201);
      assert.ok(saved.data.id);
      id = saved.data.id;
      assert.equal(authCalls, 0);
      offline = false;
    });
    await t.test('anonymous, legacy cookie, tenant, and forged credentials cannot access the inbox', async () => {
      assert.equal((await call()).status, 401);
      assert.equal((await call(undefined, 'GET', undefined, undefined, { cookie: 'vyro_website_session=legacy' })).status, 401);
      for (const token of ['tenant-token', 'false-token', 'fake-role', 'forged-token']) {
        const expected = token === 'forged-token' ? 401 : 403;
        assert.equal((await call(undefined, 'GET', token)).status, expected);
        assert.equal((await call(`/website-api/inquiries/${id}`, 'PATCH', token, { status: 'archived', previous: 'new' })).status, expected);
      }
    });
    await t.test('super admin reads contact details and updates status with their ERP identity', async () => {
      const inbox = await call(undefined, 'GET', 'super-token');
      assert.equal(inbox.status, 200);
      assert.equal(inbox.data.length, 1);
      assert.equal(inbox.data[0].message, details.message);
      const changed = await call(`/website-api/inquiries/${id}`, 'PATCH', 'super-token', { status: 'contacted', previous: 'new', updatedBy: 'forged@example.test' });
      assert.equal(changed.status, 200);
      assert.equal(changed.data.status, 'contacted');
      assert.equal(changed.data.updatedBy, 'super@example.test');
    });
    await t.test('invalid status, stale edits and spam submissions are rejected', async () => {
      assert.equal((await call(`/website-api/inquiries/${id}`, 'PATCH', 'super-token', { status: 'invalid', previous: 'contacted' })).status, 400);
      assert.equal((await call(`/website-api/inquiries/${id}`, 'PATCH', 'super-token', { status: 'archived', previous: 'new' })).status, 409);
      assert.equal((await call(undefined, 'POST', undefined, { ...details, contact_check: 'bot' })).status, 400);
    });
    await t.test('legacy authentication endpoints are removed', async () => {
      for (const path of ['config', 'login', 'logout', 'password']) {
        assert.equal((await call(`/website-api/auth/${path}`, path === 'config' ? 'GET' : 'POST')).status, 404);
      }
    });
    await t.test('ERP outage and revoked sessions fail closed', async () => {
      offline = true;
      assert.equal((await call(undefined, 'GET', 'super-token')).status, 503);
      assert.equal((await call(`/website-api/inquiries/${id}`, 'PATCH', 'super-token', { status: 'archived', previous: 'contacted' })).status, 503);
      offline = false;
      const admin = tokens.get('super-token');
      tokens.delete('super-token');
      assert.equal((await call(undefined, 'GET', 'super-token')).status, 401);
      tokens.set('super-token', admin);
    });
    await t.test('existing inquiry data survives service restart', async () => {
      service.close();
      service = createInquiryService({ directory, erpApiUrl: 'http://erp.test/api/v1' });
      const inbox = await call(undefined, 'GET', 'super-token');
      assert.equal(inbox.status, 200);
      assert.equal(inbox.data.length, 1);
      assert.equal(inbox.data[0].id, id);
      assert.equal(inbox.data[0].status, 'contacted');
      assert.equal(inbox.data[0].updatedBy, 'super@example.test');
    });
  } finally {
    service.close();
    globalThis.fetch = originalFetch;
    const relativePath = relative(tmpdir(), directory);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('Unsafe test cleanup path');
    await rm(directory, { recursive: true, force: true });
  }
});
