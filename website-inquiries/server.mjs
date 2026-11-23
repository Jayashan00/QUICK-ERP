import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export function createInquiryService({
  directory = process.env.INQUIRY_DATA_DIR || fileURLToPath(new URL('./private/', import.meta.url)),
  erpApiUrl = process.env.INQUIRY_ERP_API_URL || 'http://127.0.0.1:8000/api/v1',
} = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(directory, 'inbox.sqlite'));
  erpApiUrl = erpApiUrl.replace(/\/$/, '');
  db.exec(`CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, company TEXT NOT NULL,
    phone TEXT, interest TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, updatedBy TEXT
  )`);
  const insert = db.prepare(`INSERT INTO inquiries
    (id,name,email,company,phone,interest,message,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`);
  const list = db.prepare('SELECT * FROM inquiries ORDER BY createdAt DESC, rowid DESC');
  const update = db.prepare('UPDATE inquiries SET status=?, updatedAt=?, updatedBy=? WHERE id=? AND status=?');
  const find = db.prepare('SELECT * FROM inquiries WHERE id=?');
  const statuses = new Set(['new', 'contacted', 'qualified', 'archived']);
  const root = '/website-api/inquiries';

  class InputError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }

  // Check the real ERP session on every request, including revocation and account changes.
  // Never trust browser role flags, old website cookies, or an unverified JWT payload.
  async function requireSuperAdmin(request) {
    const authorization = request.headers.authorization;
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      throw new InputError(401, 'Please sign in with your ERP super admin account.');
    }
    let response;
    try {
      response = await fetch(`${erpApiUrl}/auth/me`, {
        headers: { Authorization: authorization, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
    } catch {
      throw new InputError(503, 'The ERP sign-in service is unavailable. Please try again.');
    }
    if (response.status === 401) throw new InputError(401, 'Your ERP session has expired. Please sign in again.');
    if (response.status === 403) throw new InputError(403, 'Only ERP super admins can manage website inquiries.');
    if (!response.ok) throw new InputError(503, 'The ERP sign-in service is unavailable. Please try again.');
    let identity;
    try { identity = await response.json(); }
    catch { throw new InputError(503, 'The ERP sign-in service returned an invalid response.'); }
    if (identity?.user?.isSuperAdmin !== true) {
      throw new InputError(403, 'Only ERP super admins can manage website inquiries.');
    }
    if (typeof identity.user.email !== 'string' || !identity.user.email) {
      throw new InputError(503, 'The ERP sign-in service returned an invalid identity.');
    }
    return identity.user;
  }

  async function readBody(request) {
    if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
      throw new InputError(415, 'Send the form as JSON.');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > 16384) throw new InputError(413, 'The form is too large.');
      chunks.push(chunk);
    }
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (body && typeof body === 'object' && !Array.isArray(body)) return body;
    } catch { /* Return the same error for malformed or empty JSON. */ }
    throw new InputError(400, 'Invalid form data.');
  }

  function field(body, name, max) {
    const value = body[name];
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
      throw new InputError(400, 'Please check the ' + name + ' field.');
    }
    return value.trim();
  }

  const handler = async (request, response) => {
    const send = (status, data) => {
      request.resume();
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    };
    try {
      const path = request.url.split('?')[0];
      // The separate website account and all of its authentication endpoints are retired.
      if (path.startsWith('/website-api/auth/')) return send(404, { error: 'Use your ERP super admin account.' });
      if (request.method === 'POST' && path === root) {
        const body = await readBody(request);
        if (body.website || body.contact_check) {
          throw new InputError(400, 'Your inquiry was not saved. Refresh the page and enter your details again.');
        }
        const email = field(body, 'email', 254);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError(400, 'Enter a valid email address.');
        const now = new Date().toISOString();
        const id = randomUUID();
        insert.run(id, field(body, 'name', 100), email, field(body, 'company', 120),
          body.phone == null || body.phone === '' ? null : field(body, 'phone', 40),
          field(body, 'interest', 100), field(body, 'message', 2000), now, now);
        return send(201, { id, createdAt: now });
      }
      const match = /^\/website-api\/inquiries\/([0-9a-f-]{36})$/.exec(path);
      if (!(request.method === 'GET' && path === root) && !(request.method === 'PATCH' && match)) {
        return send(404, { error: 'Unknown inbox endpoint.' });
      }
      const admin = await requireSuperAdmin(request);
      if (request.method === 'GET' && path === root) return send(200, list.all());
      if (request.method === 'PATCH' && match) {
        const { status, previous } = await readBody(request);
        if (!statuses.has(status) || !statuses.has(previous)) throw new InputError(400, 'Invalid inquiry status.');
        if (!update.run(status, new Date().toISOString(), admin.email, match[1], previous).changes) {
          throw new InputError(409, 'The inquiry has changed. Refresh the inbox and try again.');
        }
        return send(200, find.get(match[1]));
      }
      send(404, { error: 'Unknown inbox endpoint.' });
    } catch (error) {
      if (!(error instanceof InputError)) console.error('Inquiry request failed', error.code || error.name);
      send(error instanceof InputError ? error.status : 500,
        { error: error instanceof InputError ? error.message : 'The inquiry service is unavailable. Please try again.' });
    }
  };
  return { handler, close: () => db.close() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const service = createInquiryService();
  const server = createServer({ requestTimeout: 15000 }, service.handler);
  server.listen(Number(process.env.INQUIRY_PORT || 8011), '127.0.0.1', () => console.log(`Website inquiry service ready on port ${server.address().port}.`));
}
