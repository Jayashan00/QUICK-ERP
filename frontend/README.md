# Quick ERP

Quick ERP is the multi-tenant SaaS ERP frontend owned by Quick Solutions. It provides a tenant/company ERP workspace, branch-aware operational workflows, permission-aware analytics, a public storefront, and a separate Super Admin platform workspace.

**Frontend workflows are complete using realistic mock/API-ready services.** Backend development is the next handoff stage. The backend team should replace mock persistence with real APIs without changing approved frontend behavior unless agreed. This is frontend feature completion, not a claim of production security, live payments, permanent storage, or browser end-to-end certification.

See [Backend API handoff](docs/BACKEND_API_HANDOFF.md) for source-backed domain contracts, scope rules, workflow actions, and integration decisions. The focused [auth handoff](src/core/auth/README.md) describes the authentication adapter.

## Stack

React 18, TypeScript (strict), Vite 6, Tailwind CSS 4, React Router 6, TanStack Query 5, React Hook Form, Zod, react-hot-toast, Lucide React, and Recharts. ESLint checks TypeScript and React hooks. Node-based service QA uses esbuild.

## Run locally

Use Node.js 22 or newer and npm (QA runners target Node 22).

```bash
npm ci
# Copy .env.example to .env.local if you need to override defaults.
npm run dev
```

Vite is configured for port 3000. Open the URL printed by Vite if that port is occupied. Use `npm run build` followed by `npm run preview` to preview the production bundle. On Windows, use `npm.cmd` if PowerShell execution policy blocks `npm.ps1`.

Development mock login: `admin@quickerp.test` / `QuickERP123!`. The mock security check is `ERP38`; Admin MFA code is `123456`. Cashier and supervisor accounts use `cashier@quickerp.test` and `pos.supervisor@quickerp.test` with the same password. These fixtures are for frontend testing. The account menu has no identity/role switcher; sign out and sign in to test another account. Production builds omit development login hints and the sidebar environment label.

## Architecture

```text
src/
  app/       Bootstrap, providers, layouts, routes, navigation, global styles
  core/      API transport, auth, tenant, branch, permissions, tenant audit
  features/  Domain pages, components, hooks, query keys, services, types, schemas, mocks
  shared/    Reusable UI/forms/tables, feedback, utilities, common contracts
scripts/     Isolated service/workflow regression runners
docs/       Backend handoff documentation
```

The `@/*` alias resolves to `src/*`. Routes in `src/app/routes/` use lazy-loaded domain pages. Pages consume hooks/services; TanStack Query keys include tenant/branch context where applicable. Services own mock storage and aggregation. Dashboard/report/search data is derived from existing domain services rather than independent business datasets. Zod schemas describe form validation; backend validation must repeat and strengthen those checks.

Authentication composition is `AuthProvider -> TenantProvider -> PermissionProvider -> BranchProvider -> SyncProvider`. Account-bound providers reset when the authenticated identity changes. `authService` delegates to `mockAuthService`; session restoration is asynchronous and pending login/challenge responses cannot restore an account after logout. The existing `User` contract contains the account's tenant, role ID/display name, assigned branch IDs and default branch. Profile is read-only.

## Workspace separation and scope

- Tenant ERP uses `/dashboard` and domain routes. TenantProvider pins the company to the authenticated account. Normal users cannot change their own identity/role through the header.
- Super Admin uses `/super-admin/*`, dedicated platform services, and platform permissions. Platform tenant, plan, subscription, feature-flag, support and health views are separated from tenant analytics.
- BranchProvider resolves the active branch from permitted branches and restores its saved selection after grants load. Company-wide views aggregate only permitted branches.
- Product master data and supplier identities are tenant-wide. Stock is tenant + branch + warehouse/location + product/variant scoped. Customers, leads and opportunities currently follow branch-scoped services; preserve those contracts unless a migration is agreed.
- PermissionProvider resolves tenant/platform-scoped permission strings. Routes, navigation, actions and sensitive views use permissions, not role names. Preserve the actual permission catalog, including existing workflow aliases. Frontend hiding is not server authorization.

## Implemented modules

| Domain | Current frontend workflows |
| --- | --- |
| Dashboards and global search | Main ERP and 11 module overviews, date filters, Recharts, operational alerts/approvals/recent records; click/Ctrl+K search with scoped records and existing-route navigation |
| CRM and Customers | Leads, activities, follow-ups, qualified/lost/conversion flow, opportunities and Kanban pipeline, customer directory/forms/detail |
| Suppliers | Tenant directory, contacts/commercial/bank terms, notes, documents, statements, performance and purchase handoffs |
| Products and Services | Categories/brands/UOM/attributes, variants, identifiers, images/documents/specifications, supplier links, bundles, related products, imports/exports, price lists and quantity tiers |
| Sales | Quotation approvals, orders, deliveries, invoices, payments, returns/credit notes, recurring invoices, commissions, flash sales, review moderation and abandoned carts |
| Purchasing | Requests/approval, RFQ, supplier quotation comparison/selection, PO approval/send, GRN, invoice matching, returns, supplier payment handoff |
| Inventory and Stock | Branch/location balances, warehouses, locations, batches/serials/expiry, movement ledger, adjustments/transfers/requests, counts/mobile counts, returns/wastage, reorder, velocity, valuation/planning reports and settings |
| POS and Storefront | Shifts/cash drawer, scanning/cart/checkout/split payments, refunds, receipts/reports/customer display, kitchen/web orders; public catalog/cart/checkout/tracking/reviews |
| Accounting | Accounts/openings, journals/approval/posting, ledger/trial balance/statements, receivables/payables/settlements, expenses, bank matching, reports, tax/FX preparation, budgets/assets and source handoffs |
| HR and Payroll | Employees/organization, shifts/attendance/corrections, leave/overtime, salaries/loans/commissions/payroll/payslips, biometric import; recruitment, onboarding, training, reviews/OKRs, feedback, policies, HR tickets, assets and exit |
| Projects | Projects/milestones/tasks/Kanban/dependencies/team, timesheets/approvals, expenses, profitability and billing handoffs |
| Documents | Shared linked document library, categories, metadata, versions, sensitivity, expiry/reminders, preview/download and archive |
| Notifications | Shared header inbox and notification center, read/archive state, operational alerts, notices/acknowledgements, templates and channel settings |
| Reports and Audit | 63 service-derived reports across seven categories; scoped read-only audit events, sensitivity/security access and exports |
| Support and Offline Sync | Tenant tickets/replies/attachments/statuses with shared platform support; scoped persistent POS/stock queue, retries/conflicts and duplicate protection in mocks |
| Settings and Platform | Company/branches/users/roles/permissions/organization, finance/localization/numbering/integrations/devices/security; separate platform administration |

The public shop routes are `/shop/:tenantId/:branchId`, `/cart`, `/checkout`, and `/orders/:orderId` beneath that scope. Opportunity-to-quotation creation is implemented, not a placeholder. Manufacturing is not an active module or route.

## Mock persistence and integration limits

Most business stores are in memory and reset on a full reload. Identity/selected-branch sessions use localStorage or sessionStorage according to Remember Me. Offline queue, anonymous cart snapshots, customer display and recent search state use scoped browser storage; browser persistence is not a database. Logout clears session/legacy identity keys and query caches and resets account-bound provider state; durable business data/queued operations remain intact.

Mock imports/uploads/printing/exports and approval transitions are working frontend flows. External file storage, device connectivity, messaging delivery, payments and authentication are not connected. CSV parsing exists in relevant modules; accounting Excel selection currently uses a sample preview. File object/blob URLs do not replace server storage.

Only posted manual/source journal drafts and opening balances affect the mock ledger. Operational records require accounting handoff review/approval/posting; reference-cost inventory previews, VAT/WHT, depreciation and FX preparation are not finalized accounting policy. The backend must be authoritative for postings, costing, valuation, taxes and statutory payroll rules. PayHere demo actions do not charge money. Receipt email/SMS/WhatsApp actions record mock send history only.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_APP_NAME` | `Quick ERP` | Application metadata configuration |
| `VITE_APP_ENV` | `development` | Environment metadata; does not control Vite development guards |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Future HTTP client base URL; absolute or same-origin relative URL |
| `VITE_USE_MOCKS` | `true` | Adapter configuration flag; explicit `false` is respected |

`VITE_USE_MOCKS=false` does **not** connect the current domain services or auth adapter to an API: those adapters still explicitly use mocks. Replace them at the service boundary first. `import.meta.env.DEV/PROD` controls development-only UI. Vite substitutes environment values at build time; every `VITE_*` value is public. Put no API secrets, PayHere secrets, SMTP/SMS/WhatsApp credentials or private signing keys in frontend env files. `.env.local` is ignored; `.env.example` is the public template.

## Validation commands

```bash
npm run typecheck # TypeScript project build check, no application JS emit
npm run lint      # ESLint
npm run build     # TypeScript plus Vite production build
npm run qa:all    # All service/regression suites sequentially, stop on first failure
```

`qa:all` discovers individual `qa:*` scripts from package.json (excluding itself) in declaration order. Every suite runs in a fresh Node process, so mock mutations do not contaminate other suites. Runners bundle into temporary directories and clean them afterward; they do not contact a backend or change production data.

Individual suites remain available: `qa:products`, `qa:inventory`, `qa:purchasing`, `qa:sales`, `qa:suppliers`, `qa:accounting`, `qa:hr`, `qa:advanced-hr`, `qa:projects`, `qa:documents`, `qa:pos`, `qa:sync`, `qa:notifications`, `qa:audit`, `qa:support`, `qa:reports`, `qa:dashboard`, `qa:module-dashboards`, `qa:auth`, `qa:search`, and `qa:api`.

These checks cover source contracts, schemas, service workflows, approvals, aggregation, tenant/branch access, permissions, authentication sessions, search and HTTP transport. They are not browser/device/end-to-end tests. Run browser acceptance testing again when real APIs are integrated. Vite currently emits dependency annotation, mixed import and large-chunk advisories; these are separate from TypeScript/lint errors and broken routes.

## Backend integration expectations

Keep service method return shapes, hooks/query keys, routes, validation feedback and approved workflows stable. Use the shared `apiClient`, `ApiResponse<T>`, `PaginatedResult<T>` and `ApiError` contract; unwrap transport responses inside service adapters. Do not change every page to know HTTP details.

Enforce authentication, tenant isolation, branch grants, granular permissions, sensitive file access and workflow transitions on the server. Browser-supplied actor IDs, permission lists and permitted-branch arrays are mock context, not authority. Agree on token/cookie strategy, endpoint/version naming, money/date serialization, accounting policies, production file storage, payment callbacks, messaging credentials and sync idempotency before replacing each mock domain. The detailed source map and acceptance checks are in [BACKEND_API_HANDOFF.md](docs/BACKEND_API_HANDOFF.md).
