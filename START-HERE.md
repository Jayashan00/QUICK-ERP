# Quick ERP: complete system (frontend + backend)

This folder is everything you need:

| Folder | What it is |
|---|---|
| `frontend/` | **Your newest frontend** (QUICK-ERP-main) with the connection to the backend added |
| `backend/` | The Spring Boot backend (Java 21) with PostgreSQL |
| `deploy/ec2/` | Automatic setup for an AWS EC2 server |

You do **not** need Docker. Do Part A first (your own computer), then Part B when you are ready for AWS.

---

## Part A: run it on your Windows computer

### A1. Install three programs (once)

1. **Java 21 (JDK)**: https://adoptium.net/temurin/releases/?version=21 → Windows, x64, **JDK**, `.msi`.
   In the installer turn on **"Set JAVA_HOME variable"**.
2. **Node.js 22 (LTS)**: https://nodejs.org → download the **22.x LTS** Windows installer, install with defaults.
3. **PostgreSQL 16**: https://www.postgresql.org/download/windows/ → "Download the installer" → version 16.
   During install it asks for a password for the **postgres** user: choose one and **write it down**. Keep port **5432**.

Check: open **Command Prompt** (press Windows key, type `cmd`, Enter) and run:

```
java -version
node -v
```

You should see `21...` and `v22...`. If not, restart the computer and try again.

### A2. Put the folder in place

Unzip `QUICK-ERP-Complete.zip` to a simple path without spaces, for example:

```
C:\QuickERP\QUICK-ERP-Complete
```

### A3. Create the database (once)

1. Open **SQL Shell (psql)** from the Start menu (installed with PostgreSQL).
2. Press **Enter** for Server, Database, Port and Username (keeps the defaults), then type the **postgres**
   password from step A1.
3. Paste these two lines (choose your own password instead of `MyStrongPass123`) and press Enter:

```
CREATE USER quickerp WITH PASSWORD 'MyStrongPass123';
CREATE DATABASE quickerp OWNER quickerp;
```

You should see `CREATE ROLE` and `CREATE DATABASE`. Type `\q` to close.

### A4. Start the backend

1. Open `C:\QuickERP\QUICK-ERP-Complete\backend\start-backend.bat` with **Notepad**
   (right-click → Show more options → Edit).
2. Replace `PUT-YOUR-DATABASE-PASSWORD-HERE` with the password from A3 (`MyStrongPass123` in the example). Save.
3. **Double-click** `start-backend.bat`. A black window opens. The first start downloads libraries
   (internet needed, 3-10 minutes).
4. It is ready when the window shows `Started QuickErpApplication`. **Keep this window open.**
5. Check in your browser: http://localhost:8000/api/v1/health → `{"status":"ok","database":"up"}`.

### A5. Start the frontend

Open a **second** Command Prompt and run:

```
cd C:\QuickERP\QUICK-ERP-Complete\frontend
npm install
npm run dev
```

(`npm install` is needed only the first time. If PowerShell blocks `npm`, use Command Prompt, or type `npm.cmd`.)

Open **http://localhost:3000** in your browser.

### A6. Sign in

| Email | Role |
|---|---|
| `admin@quickerp.test` | Administrator (everything) |
| `superadmin@quickerp.test` | Super Admin (platform console) |
| `cashier@quickerp.test`, `pos.supervisor@quickerp.test` | POS |
| `sales@quickerp.test`, `accountant@quickerp.test`, `hr@quickerp.test`, `inventory@quickerp.test`, `viewer@quickerp.test` | Other roles |

Password for all: `QuickERP123!` (demo accounts for your computer only).

Your data is now saved in PostgreSQL: refresh the page or sign in from another browser and it is still there.

### Every next time

1. Double-click `backend\start-backend.bat` (wait for `Started QuickErpApplication`).
2. In a Command Prompt: `cd C:\QuickERP\QUICK-ERP-Complete\frontend` then `npm run dev`.
3. Open http://localhost:3000.

### If something goes wrong

| What you see | Fix |
|---|---|
| `'java' is not recognized` | Install Java 21 (A1) with "Set JAVA_HOME", then open a new Command Prompt |
| Backend window: `password authentication failed for user "quickerp"` | The password in `start-backend.bat` differs from the one in A3 |
| Backend window: `Connection to localhost:5432 refused` | PostgreSQL is not running: Start menu → Services → start "postgresql-x64-16" |
| Backend window: `Port 8000 was already in use` | Another backend is running; close it (or restart the computer) |
| Browser: "Cannot reach the Quick ERP server" | The backend window is closed or not finished starting |
| Sign-in says "Invalid email or password" | Use the emails above with `QuickERP123!` |

To start again with a fresh database: in SQL Shell run `DROP DATABASE quickerp;` and
`CREATE DATABASE quickerp OWNER quickerp;`, then start the backend again.

---

## Part B: put it on AWS EC2 (live)

### B1. Create the server (AWS console)

1. EC2 → **Launch instance**.
2. Name: `quick-erp`. Image: **Ubuntu Server 24.04 LTS**. Type: **t3.medium** (2 vCPU, 4 GB) or larger.
3. Key pair: create one, download the `.pem` file, keep it safe.
4. Network settings → allow **SSH (22) from My IP**, **HTTP (80)** and **HTTPS (443)** from anywhere.
   Do **not** open 8000 or 5432.
5. Storage: **30 GB** gp3. Launch.
6. EC2 → Elastic IPs → **Allocate** → **Associate** it with the instance (the address then never changes).

### B2. Point your domain (recommended)

At your domain provider add an **A record**, for example `erp.yourcompany.lk` → the Elastic IP.
Wait until it works (a few minutes to an hour).

### B3. Upload this folder to the server

On your computer, in Command Prompt (Windows 10/11 include `scp` and `ssh`):

```
scp -i C:\path\to\your-key.pem C:\path\to\QUICK-ERP-Complete.zip ubuntu@YOUR-ELASTIC-IP:~
ssh -i C:\path\to\your-key.pem ubuntu@YOUR-ELASTIC-IP
```

Now you are on the server. Run:

```
sudo apt-get update && sudo apt-get install -y unzip
unzip QUICK-ERP-Complete.zip
cd QUICK-ERP-Complete/deploy/ec2
chmod +x setup-server.sh
```

### B4. Install and start everything (one command)

With your domain (gives HTTPS automatically):

```
sudo ./setup-server.sh erp.yourcompany.lk you@yourcompany.lk
```

Without a domain (testing only, http, development mode):

```
sudo ./setup-server.sh
```

It takes 5-15 minutes. At the end it prints **your address, the admin email and a new random password**.
Write them down. Open the address and sign in. Change the password right away (Security page).

The server starts with your roles, branches, settings and chart of accounts, and **no demo transactions**.
All passwords and secrets were generated randomly and stored in `/etc/quickerp/backend.env`.

### B5. After going live

- **Backups (do this):** `sudo cp backup-database.sh /etc/cron.daily/quickerp-backup && sudo chmod +x /etc/cron.daily/quickerp-backup`.
  Also turn on EBS snapshots in AWS (Data Lifecycle Manager), so a copy exists outside the server.
- **Email for password resets:** edit `sudo nano /etc/quickerp/backend.env`, fill in `SPRING_MAIL_*` (for example
  Amazon SES SMTP), then `sudo systemctl restart quickerp-backend`.
- **Your company:** sign in as `superadmin@quickerp.test` and create your company, or use the starter company and
  rename it in Settings → Company.
- **See the backend log:** `sudo journalctl -u quickerp-backend -f`
- **Update to a new version:** upload the new zip, unzip, and run `sudo ./setup-server.sh <same domain> <same email>`
  again. Data and passwords are kept.

---

## Optional: check the connection yourself

With the backend running on your computer (Part A, demo data), open a second Command Prompt:

```
cd C:\QuickERP\QUICK-ERP-Complete\frontend
npm run qa:backend
```

It signs in, saves, tests an edit conflict between two users and a stock receipt, and prints PASS or FAIL for each
step. It adds test records, so use it only on your computer's demo database, never on the live server.

## What was checked before delivery

- Frontend (your newest version, with the backend connection added): TypeScript typecheck, lint, **all 21 QA
  suites**, production build.
- Backend: **54 automated tests on PostgreSQL 16**, using the starter data exported from this frontend and signing in
  as each starter role, including edit conflicts and the stock ledger; deliberate-breakage checks (each protection
  removed on purpose made a test fail).
- **455 real saves** produced by this frontend's workflows (POS, inventory, purchasing, sales, accounting, HR,
  projects, documents, notifications, support) replayed against the backend as the role that does the work: all
  accepted, except an accountant creating a tax rate, which the frontend also restricts to Settings → Taxes.
- **End-to-end over HTTP**: the frontend's real sync code against the backend's real logic and database, 14 checks
  passed (sign-in and load, saving, an edit conflict between two users, pulling other users' changes, a large save
  split into several requests, stock with and without movements). This is the `npm run qa:backend` check.
- The EC2 nginx configuration was checked with nginx itself.

Not checked by me: starting the Spring Boot application itself and the EC2 script on a real server (my build
environment cannot download Spring Boot or reach AWS). Steps A4 and B4 are those first starts; if anything
fails, send me the last 50 lines of the backend window or of `sudo journalctl -u quickerp-backend -n 50`.

## What the server guarantees

- Each company sees only its own data; each user only what their role allows (salaries, accounting and payroll
  are hidden from roles without those permissions).
- Nobody can give themselves more permissions, and the last administrator cannot be removed.
- Journals follow approval and posting rules; posted journals are balanced and cannot be edited.
- Stock on hand only changes through recorded stock movements.
- A save never silently overwrites someone else's newer change.
- Web-shop prices, taxes and totals are recalculated on the server.
- Audit trails cannot be edited; every change is kept with user and time.

## Known limitations (also in backend/README.md)

- POS sale totals, discounts and payroll amounts are calculated in the browser; the server controls who may save
  them and keeps a history of every change, but does not recalculate them.
- Small shared lists (gift-card and loyalty balances, notification read flags) are saved as one value: when two
  users change one at the same moment, the second user gets the conflict message and repeats the action.
- Each browser loads all data its user may read; very large data sets make sign-in slower over time.
