# Quick ERP Backend (Spring Boot + PostgreSQL)

Backend for the Quick ERP React frontend. It provides sign-in, tenant-isolated storage of all ERP data in
PostgreSQL, multi-user synchronisation, the public web-shop API and tenant provisioning.

- Java 21, Spring Boot 3.3.5, PostgreSQL 16 (14+ works), Flyway migrations
- Base URL: `http://localhost:8000/api/v1`, the address the frontend already uses

## How it works with the frontend

The frontend keeps all its business rules (sales, purchasing, inventory, accounting, HR, POS, etc.).
Each module's records are registered with a small persistence layer in the frontend (`src/core/persistence`).
After sign-in, the frontend:

1. loads the tenant's data from `GET /state`;
2. saves every change (only the changed records) to `POST /state/batch` right after each action, and every 5 seconds;
3. pulls changes made by other users from `GET /state/changes` every 5 seconds.

The server only returns and accepts what the signed-in user is allowed to see and change (see
"Security rules enforced by the server").

On an empty database the server writes the starter tenant itself (roles, users, branches, settings, chart of
accounts and, with `SEED_DEMO_DATA=true`, the demo records), from `seed/starter-data.json`. A new tenant created
with the provisioning API gets its roles, settings and owner from the server too. Collections the server has
never stored are filled once from the frontend's built-in starter data at the first sign-in; roles and users never are.

PostgreSQL tables (see `src/main/resources/db/migration/V1__initial_schema.sql`):

| Table | Purpose |
|---|---|
| `tenants` | Organizations and their status (suspending a tenant blocks its sign-in) |
| `app_users` | Login accounts: BCrypt password hash, status, role, lockout counters |
| `erp_records` | One JSONB document per ERP record, keyed by tenant, collection and record id |
| `erp_collections` | Collections each tenant has saved at least once |
| `erp_record_history` | Every insert, update and delete, with user and time (audit trail) |
| `password_reset_tokens` | One-time password reset links (only hashes are stored), valid for 30 minutes |
| `stored_files` | Uploaded product images, product documents and company documents |
| `revoked_tokens` | Sessions ended with "Sign out" (kept until the token would have expired) |

Two-factor authentication columns (`mfa_*`) and the session version (`token_version`) are on `app_users`.

## Run locally

Requirements: Java 21 (JDK) and PostgreSQL. Maven is not required; use the included wrapper.

1. Create the database (once):

   ```sql
   CREATE USER quickerp WITH PASSWORD 'quickerp';
   CREATE DATABASE quickerp OWNER quickerp;
   ```

2. Start the backend from this folder:

   ```bash
   # macOS / Linux
   ./mvnw spring-boot:run
   # Windows
   mvnw.cmd spring-boot:run
   ```

   Flyway creates the tables. On an empty database the starter tenant and users are created.

3. Check it: open http://localhost:8000/api/v1/health and you should see `{"status":"ok","database":"up"}`.

4. Start the frontend with backend mode on. In the frontend root, create `.env` (or `.env.local`):

   ```
   VITE_API_BASE_URL="http://localhost:8000/api/v1"
   VITE_USE_MOCKS="false"
   ```

   then run `npm run dev` and open http://localhost:3000.

### Starter accounts

All starter users have the password `QuickERP123!` (setting `SEED_DEFAULT_PASSWORD`). Change them before going live.

| Email | Role |
|---|---|
| admin@quickerp.test | Administrator (tenant-001) |
| superadmin@quickerp.test | Super Admin (platform console) |
| sales@quickerp.test, sales.executive@quickerp.test | Sales |
| accountant@quickerp.test | Accountant |
| hr@quickerp.test | HR |
| inventory@quickerp.test | Inventory |
| cashier@quickerp.test, pos.supervisor@quickerp.test | POS |
| viewer@quickerp.test | Read-only |

In backend mode there is no demo captcha. Sign-in is protected by rate limits and account lockout. Two-factor authentication is real
(TOTP authenticator apps, see below) and is switched on by each user under **Security** (`/security`).

## Run with Docker

```bash
cp .env.example .env      # then set DB_PASSWORD and JWT_SECRET
docker compose up -d --build
```

This starts PostgreSQL 16 and the backend on port 8000.

## Build a jar

```bash
./mvnw clean package
java -jar target/quick-erp-backend.jar
```

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8000` | HTTP port |
| `DB_URL` | `jdbc:postgresql://localhost:5432/quickerp` | JDBC URL |
| `DB_USERNAME` / `DB_PASSWORD` | `quickerp` / `quickerp` | Database credentials |
| `JWT_SECRET` | random at start-up | Token signing key, at least 32 characters. **Set it in production**, otherwise everyone is signed out on restart |
| `JWT_TTL_HOURS` | `24` | Session length |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173` | Comma-separated frontend URLs. Add your production frontend URL |
| `SEED_ENABLED` | `true` | Create starter tenant and users on an empty database |
| `SEED_DEMO_DATA` | `true` | `true`: full demo data. `false`: configuration only (roles, branches, settings, chart of accounts); use in production |
| `SEED_DEFAULT_PASSWORD` | `QuickERP123!` | Password of the starter users |
| `NEW_USER_INITIAL_PASSWORD` | `ChangeMe123!` | Password given to users created in Settings > Users. Empty: new users must use "Forgot password" or get a password from an administrator (required in production) |
| `APP_ENVIRONMENT` | `development` | `production` makes the server refuse to start with unsafe settings |
| `FORWARD_HEADERS_STRATEGY` | `native` | Use the client address from `X-Forwarded-For` (trusted from private-network proxies only), so rate limits work behind a proxy |
| `MAX_JSON_BYTES` | `16777216` | Largest JSON request body; larger requests get HTTP 413 |
| `MAX_LOGIN_FAILURES` / `LOGIN_LOCK_MINUTES` | `10` / `15` | Account lockout after failed sign-ins |
| `PASSWORD_RESET_URL` | `http://localhost:3000/reset-password` | Frontend page used in reset emails. Use your production URL |
| `MAIL_FROM` | `no-reply@quickerp.local` | Sender address of reset emails |
| `SPRING_MAIL_HOST`, `SPRING_MAIL_PORT`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`, `SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH=true`, `SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE=true` | not set | SMTP server for reset emails. **Without it, reset emails are written to the backend log** |

More settings, such as the public shop collections and the provisioning template, are in `src/main/resources/application.yml`.

## API

All responses are JSON. Errors have the form `{ "status", "code", "message", "errors"? }`, which the frontend's `ApiError` reads.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Health and database check |
| POST | `/auth/login` | none | `{email, password}` → `{token, expiresAt, user, tenant}` |
| GET | `/auth/me` | Bearer | Current user and tenant |
| POST | `/auth/change-password` | Bearer | `{currentPassword, newPassword}` → `{token, expiresAt}`. Other sessions are signed out; use the returned token |
| POST | `/auth/logout` | Bearer | Ends this session: the token stops working immediately |
| POST | `/auth/logout-all` | Bearer | Signs the caller out on every device |
| POST | `/auth/mfa/verify` | none | Second sign-in step `{challenge, code}` → session (code from the app or a recovery code) |
| GET | `/auth/mfa` | Bearer | `{enabled}` |
| POST | `/auth/mfa/setup` | Bearer | `{secret, otpauthUrl}` to add to an authenticator app |
| POST | `/auth/mfa/enable` | Bearer | `{code}` → `{recoveryCodes}` (8 one-time codes) |
| POST | `/auth/mfa/disable` | Bearer | `{code}` |
| POST | `/auth/password-reset/request` | none | `{email}`: sends a reset link (always 204) |
| POST | `/auth/password-reset/confirm` | none | `{token, password}` |
| POST | `/files` | Bearer | Multipart upload (`file`, max 20 MB; images, PDF, Word, Excel, CSV, text) → `{id, path, ...}` |
| GET | `/files/{id}?key=...` | link key | Download or display a stored file |
| GET | `/state` | Bearer | All data of the caller's tenant |
| GET | `/state/changes?since=N` | Bearer | Records changed after sequence N (header `X-Client-Id` skips own changes) |
| POST | `/state/batch` | Bearer | `{clientId, changes:[{collection, recordId, data, deleted}], seeded:[...]}` |
| POST | `/users/{userId}/password` | Bearer (user admin) | `{password}`: an administrator sets a user's password |
| POST | `/users/{userId}/mfa/reset` | Bearer (user admin) | Turns off two-factor sign-in for a user who lost their phone |
| POST | `/platform/tenants/{tenantId}/provision` | Bearer (Super Admin) | Create a tenant with an owner login (see below) |
| GET | `/public/shop/{tenantId}/state` | none | Web-shop catalogue data |
| GET | `/public/shop/{tenantId}/orders/{orderId}` | none | Order tracking |
| POST | `/public/shop/{tenantId}/batch` | none | Add web orders and reviews (insert only, rate limited) |

### Sign-in flow

1. `POST /auth/login` with email and password. If the user has two-factor authentication, the response has
   `mfaRequired: true` and a 5-minute `challenge` instead of a token.
2. `POST /auth/mfa/verify` with the challenge and a 6-digit code from the authenticator app (or a recovery code).
   Each code works once.

### Security rules enforced by the server

The browser runs the ERP screens and business logic; the server decides what each signed-in user may
read and change. Every rule below is covered by the automated tests (`src/test`).

**Sign-in and sessions**
- Passwords are stored with BCrypt. Repeated failures lock the account; sign-in, two-factor and reset requests are rate limited.
- Every request re-checks the user and tenant in the database: deactivating a user or suspending a tenant takes effect immediately.
- "Sign out" revokes the token on the server. Changing or resetting a password, an administrator setting a password,
  deactivating a user or changing their email signs that user out on every device (token versions).

**Tenant data** (`GET /state`, `GET /state/changes`, `POST /state/batch`)
- Every request is limited to the caller's tenant; Super Admin works in the separate `platform` scope
  (and reads `support.tickets` across tenants).
- `app.access.rules` in `application.yml` decides per collection who may read and who may write. Writing always
  requires reading. Users never receive collections they cannot read (accounting and payroll for a cashier, for
  example); those collections are still listed as existing, so the browser does not fill them with demo data.
- Salary and personal fields of `hr.employees` are hidden from users without `hr.employees.view` or
  `hr.payroll.view`; when such a user saves an employee, the hidden values are kept.
- Audit trails (`core.auditEvents`, `accounting.audit`, `hr.audit`, `documents.audit`, `projects.audit`,
  `hr.advanced.logs`) are append-only: records cannot be changed and deletions are ignored.
- Some settings screens create a default record the first time they are read for a tenant or branch (POS reads
  printer, cash drawer and receipt settings, for example). For `app.access.default-creatable-collections`, any user
  who can read the collection may add that first record; existing records still need the write permissions.
- A save identical to what is stored is skipped without a permission check.
- Collections without a rule are open to every user of the tenant, because the browser updates them as side
  effects of other modules (a POS sale updates stock and sales handoffs). Tighten them in `application.yml`.

**Roles and users**
- Only the server creates the starter tenant's roles and users (starter data) and a new tenant's roles and owner
  (provisioning); a browser can never seed them.
- Changing roles needs a role-management permission. Nobody can give a role permissions they do not hold
  themselves, change a role more powerful than their own, change their own role, or delete a role still assigned.
- Managing users needs `users.*` or `settings.users.create/edit/delete`. A user administrator can only assign roles
  within their own permissions and cannot change, deactivate, reset the password of or reset two-factor for an
  account with more permissions than theirs.
- Without user-management permission, users can change only their own name, phone and picture.
- No change may leave the organization without an active administrator (a role with `*`).

**Accounting** (`accounting.journals`)
- Status workflow: draft → pending approval → approved/rejected → posted → reversed (rejected → draft).
- Approving or rejecting needs `finance.journals.approve`; posting or reversing needs `finance.journals.post`.
- The browser saves snapshots, so several steps can arrive in one save (for example a journal created and posted
  while offline). The new status must be reachable through the workflow and the user needs the permission for
  every step on the way; new journals count as starting from draft.
- A posted journal needs at least two lines, no negative or two-sided lines, and equal debits and credits.
- Posted and reversed journals cannot be edited or deleted; only draft and rejected journals can be deleted.

**Edit conflicts**
- Every record has a version that goes up with each save. The browser sends the version it last saw; if someone
  else saved the record in the meantime, the save is refused instead of overwriting their work, and the browser
  shows their latest version with a message so the user can make the change again.

**Stock**
- The quantity on hand of a stock balance can only change through stock movements: in every save, the change must
  equal the total of the new movements (quantity after minus quantity before) for the same product, variant,
  warehouse and location saved with it. Movements are append-only, a balance cannot be moved to another product or
  location, and only an empty balance can be removed. The browser always sends a balance with its movements.

**Public web shop**
- The shop can read only `app.public-shop.readable-collections` and add records only to `storefront.orders` and
  `storefront.reviews`.
- Orders are re-priced on the server from the store's own catalogue (flash sale, quantity tier, selling price, tax
  code): a visitor cannot choose prices, taxes, totals, the order status or the payment status. Products must be
  active and the branch must exist.
- Reviews need a completed order of the same branch and always start as `pending` (moderation).

**Requests and configuration**
- JSON bodies larger than `MAX_JSON_BYTES` are refused with HTTP 413 before they are read into memory.
- With `APP_ENVIRONMENT=production` the server will not start with a missing JWT secret, the default database or
  starter password, demo data, a shared initial password for new users, wildcard CORS, no access rules, or a
  non-https reset link. It lists every problem in the log.
- Without SMTP, production never writes email contents (reset links) to the log.

### Creating a new tenant with a working login

Tenants created in the Super Admin console are recorded there. To give a new company a login, call the provisioning API as Super Admin.
It copies roles, branches and settings from a template tenant, which must have signed in at least once:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@quickerp.test","password":"QuickERP123!"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')

curl -X POST http://localhost:8000/api/v1/platform/tenants/acme-lanka/provision \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Acme Lanka","ownerName":"Owner Name","ownerEmail":"owner@acme.lk","ownerPassword":"StrongPass123","templateTenantId":"tenant-001"}'
```

### Setting a user's password (administrator)

```bash
curl -X POST http://localhost:8000/api/v1/users/usr-004/password \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"password":"NewPass123!"}'
```

## Production checklist

1. In `.env`: `APP_ENVIRONMENT=production`, a strong `DB_PASSWORD`, `JWT_SECRET` (`openssl rand -base64 48`),
   `SEED_DEMO_DATA=false`, a strong `SEED_DEFAULT_PASSWORD`, `NEW_USER_INITIAL_PASSWORD=` (empty),
   `CORS_ALLOWED_ORIGINS=https://your-frontend`, `PASSWORD_RESET_URL=https://your-frontend/reset-password`, SMTP settings.
2. Put a reverse proxy with HTTPS (nginx, Caddy) in front of port 8000. Keep `BACKEND_BIND=127.0.0.1`.
3. Start: `docker compose up -d --build`. If the server stops at start-up, the log lists the settings to fix.
4. Sign in as each starter account once and change its password, or deactivate the starter accounts you do not need.
   Create your company with the provisioning API (below), using `tenant-001` as the template.
5. Back up the database daily (for example `pg_dump`) and test restoring it.

## Upgrading an existing database

Flyway applies `V3__security_hardening.sql` automatically. Existing sessions keep working. Starter data is only
written to an empty database, so an existing database keeps its data. The roles and users in a database created
with an older version were uploaded by the first browser that signed in: check them in Settings > Roles and
Settings > Users after upgrading.

## Tests

```bash
./mvnw test
```

The database tests run when `QUICKERP_TEST_DB_URL` points to a PostgreSQL database, for example with the
database from `docker compose`:

```bash
QUICKERP_TEST_DB_URL="jdbc:postgresql://localhost:5432/quickerp?user=quickerp&password=YOUR_DB_PASSWORD" ./mvnw test
```

They create a temporary schema, apply the migrations, load the starter data and the rules from `application.yml`,
and sign in as the starter users to check the rules above; the schema is dropped afterwards. Without the variable
they are skipped and the unit tests still run.

## Starter data

`src/main/resources/seed/starter-data.json` is exported from the frontend's built-in data. After changing that
data in the frontend, run `npm run seed:export` in the frontend root and rebuild the backend.

## Known limitations

- POS sale totals, discounts and payroll amounts are calculated in the browser. The server checks who may save them,
  keeps a history of every change, and enforces stock movements, journal rules and web-shop prices, but it does not
  recalculate POS sales or payroll.
- Some small shared lists are saved as one value (for example gift-card and loyalty balances, notification read
  flags). When two users change the same list at the same moment, the second one gets the conflict message and
  repeats the action; nothing is overwritten silently.
- Each browser loads all data its user may read and checks for changes every 5 seconds; very large data sets make
  sign-in slower over time.
- Rate limits are kept in memory, per server instance.
- Uploaded files are stored in PostgreSQL and opened by link (the link contains a random key).
- Two-factor setup shows the setup key and an `otpauth://` link, not a QR image.
- The login-activity list on the Security page shows starter sample sessions, not real device telemetry.
