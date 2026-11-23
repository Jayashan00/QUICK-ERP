# Website inquiries in Super Admin

Website contact submissions appear in **Super Admin > Inquiries** at `/super-admin/inquiries`.
Sign in with an existing ERP super admin account at `/login`. Old `/inquiry-admin`
bookmarks redirect to the protected super admin page. Tenant admins and other tenant
users cannot read or update this inbox.

The separate website admin login is retired. Its old cookies and credentials no longer
grant access, and `/website-api/auth/*` endpoints return 404. Password changes and
sign-out use the existing ERP account controls.

## Local use

Use Node.js 22.13 or newer. Start the ERP backend, run
`node website-inquiries/server.mjs` from the project root, and start the frontend in
another terminal. The frontend must use real ERP authentication (`VITE_USE_MOCKS=false`).
Browser-only demo identities cannot authorize access to real contact inquiries.

The inquiry service validates each admin bearer token with the ERP `/api/v1/auth/me`
endpoint and requires `user.isSuperAdmin === true`. Expired/revoked sessions and
disabled accounts are rejected by the ERP. If the ERP is unavailable, admin access
is denied while public contact submissions can still be saved.

| Variable | Default |
| --- | --- |
| `INQUIRY_PORT` | `8011` |
| `INQUIRY_DATA_DIR` | `website-inquiries/private` |
| `INQUIRY_ERP_API_URL` | `http://127.0.0.1:8000/api/v1` |

Only configure `INQUIRY_ERP_API_URL` to a trusted ERP backend; session tokens are
sent there. For a remote ERP backend, use HTTPS.

## Existing data and deployment

The contact form still posts to `/website-api/inquiries`. Records stay in the same
`inbox.sqlite` database with their existing IDs, timestamps and statuses. No data
migration or deletion is needed. Status changes record the ERP super admin's email.

Deploy **both** the frontend and the inquiry service. From the updated release folder,
run `sudo bash website-inquiries/install.sh` to install/restart the service, then publish
the updated frontend. The existing Jenkins deployment only publishes the ERP backend
and frontend, so the inquiry-service installation is also required for this update.
The EC2 full setup script already runs the inquiry installer.

Keep the nginx `/website-api/` proxy and rate limit from
`deploy/ec2/nginx-quickerp.conf`. On a fresh installation, apply that configuration,
validate and reload nginx. Serve the public website over HTTPS.

On EC2 the database remains in `/var/lib/vyro-inquiries`. Back up the private directory
while the service is stopped, or use SQLite's online backup. ERP PostgreSQL backups
do not include this inbox. Legacy website credential files/tables are unused and are
not deleted by this update.

## Verification

Run `node --test website-inquiries/server.test.mjs` from the project root and
`npm run qa:inquiries` from `frontend`. Tests exercise the request handler with a
temporary SQLite database and stubbed ERP identity responses, plus the frontend
request adapter. They never read or modify your real inbox or user accounts.

After deployment, submit a test contact inquiry and verify it under Super Admin >
Inquiries, including a status change. This verifies the running ERP, inquiry service,
and nginx connection together.
