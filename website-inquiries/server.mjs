import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createWebsiteAuth } from './auth.mjs';

const directory = process.env.INQUIRY_DATA_DIR || fileURLToPath(new URL('./private/', import.meta.url));
mkdirSync(directory, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(directory, 'inbox.sqlite'));
const auth = await createWebsiteAuth(db, directory);
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

createServer({ requestTimeout: 15000 }, async (request, response) => {
  const send = (status, data) => {
    request.resume();
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(data));
  };
  try {
    const path = request.url.split('?')[0];
    if (await auth.handle(request, response, path, readBody, send)) return;
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
    if (!auth.authenticated(request)) {
      request.resume();
      return send(401, { error: 'Please sign in to the website admin account.' });
    }
    if (request.method === 'GET' && path === root) return send(200, list.all());
    const match = /^\/website-api\/inquiries\/([0-9a-f-]{36})$/.exec(path);
    if (request.method === 'PATCH' && match) {
      const { status, previous } = await readBody(request);
      if (!auth.requireOrigin(request)) throw new InputError(403, 'Invalid request origin.');
      if (!statuses.has(status) || !statuses.has(previous)) throw new InputError(400, 'Invalid inquiry status.');
      if (!update.run(status, new Date().toISOString(), auth.email, match[1], previous).changes) {
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
}).listen(Number(process.env.INQUIRY_PORT || 8011), '127.0.0.1', () => console.log('Website inquiry service ready.'));
