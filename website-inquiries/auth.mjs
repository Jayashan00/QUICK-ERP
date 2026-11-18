import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const hashToken = value => createHash('sha256').update(value).digest('hex');
const cookieName = 'vyro_website_session';

export async function createWebsiteAuth(db, directory) {
  const accountFile = join(directory, 'admin-account.json');
  if (!existsSync(accountFile)) {
    const email = (process.env.INQUIRY_ADMIN_EMAIL || 'website-admin@vyro.com').trim().toLowerCase();
    const password = randomBytes(24).toString('base64url');
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(password, salt, 64)).toString('hex');
    writeFileSync(accountFile, JSON.stringify({ email, salt, hash }), { flag: 'wx', mode: 0o600 });
    writeFileSync(join(directory, 'initial-login.txt'), 'Email: ' + email + '\nPassword: ' + password + '\n',
      { mode: 0o600 });
  }
  const account = JSON.parse(readFileSync(accountFile, 'utf8'));
  db.exec('CREATE TABLE IF NOT EXISTS website_sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
  const cleanup = db.prepare('DELETE FROM website_sessions WHERE expires <= ?');
  const getSession = db.prepare('SELECT token FROM website_sessions WHERE token = ? AND expires > ?');
  const addSession = db.prepare('INSERT INTO website_sessions VALUES (?, ?)');
  const removeSession = db.prepare('DELETE FROM website_sessions WHERE token = ?');
  const attempts = new Map();
  let verifying = false;

  function token(request) {
    const cookie = (request.headers.cookie || '').split(';').map(part => part.trim())
      .find(part => part.startsWith(cookieName + '='));
    return cookie ? cookie.slice(cookieName.length + 1) : '';
  }

  function cookie(request, value, age) {
    const secure = request.headers['x-forwarded-proto'] === 'https';
    return cookieName + '=' + value + '; Path=/website-api; HttpOnly; SameSite=Strict; Max-Age=' + age
      + (secure ? '; Secure' : '');
  }

  function requireOrigin(request) {
    const scheme = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    return request.headers.origin === scheme + '://' + request.headers.host;
  }

  return {
    email: account.email,
    authenticated(request) {
      return Boolean(getSession.get(hashToken(token(request)), Date.now()));
    },
    requireOrigin,
    async handle(request, response, path, readBody, send) {
      if (path === '/website-api/auth/config' && request.method === 'GET') {
        send(200, { email: account.email });
        return true;
      }
      if (path === '/website-api/auth/login' && request.method === 'POST') {
        const body = await readBody(request);
        if (!requireOrigin(request)) { send(403, { error: 'Invalid sign-in origin.' }); return true; }
        const now = Date.now();
        for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
        const address = request.headers['x-real-ip'] || request.socket.remoteAddress;
        const entry = attempts.get(address) || { count: 0, until: now + 15 * 60 * 1000 };
        if (verifying || entry.count >= 5 || attempts.size >= 10000) {
          request.resume();
          send(429, { error: 'Too many sign-in attempts. Please try again later.' });
          return true;
        }
        entry.count++;
        attempts.set(address, entry);
        if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length > 256) {
          send(401, { error: 'Invalid email or password.' }); return true;
        }
        if (verifying) {
          send(429, { error: 'Please try signing in again in a moment.' }); return true;
        }
        verifying = true;
        let valid = false;
        try {
          const supplied = await deriveKey(body.password, account.salt, 64);
          valid = timingSafeEqual(supplied, Buffer.from(account.hash, 'hex'))
            && body.email.trim().toLowerCase() === account.email;
        } finally { verifying = false; }
        if (!valid) { send(401, { error: 'Invalid email or password.' }); return true; }
        attempts.delete(address);
        cleanup.run(now);
        removeSession.run(hashToken(token(request)));
        const session = randomBytes(32).toString('base64url');
        const seconds = body.remember === true ? 7 * 24 * 3600 : 8 * 3600;
        addSession.run(hashToken(session), now + seconds * 1000);
        response.setHeader('Set-Cookie', cookie(request, session, seconds));
        send(200, { email: account.email });
        return true;
      }
      if (path === '/website-api/auth/logout' && request.method === 'POST') {
        if (!requireOrigin(request)) { send(403, { error: 'Invalid sign-out origin.' }); return true; }
        removeSession.run(hashToken(token(request)));
        response.setHeader('Set-Cookie', cookie(request, '', 0));
        send(200, {});
        return true;
      }
      return false;
    },
  };
}
