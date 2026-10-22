# Quick ERP backend API handoff

## Handoff boundary

Frontend workflows are complete using realistic mock/API-ready services. Replace mock persistence at the service boundary without changing approved screens, routes, query keys, public service DTOs, transitions or validation feedback unless agreed. This document describes existing operations, not an invented REST endpoint catalog. Endpoint naming, versioning, database design and deployment remain backend decisions.

All source paths below are relative to the repository root. TypeScript interfaces, public service methods and Zod schemas are the detailed contract. Some active DTOs live alongside their services. Domain summaries below cover entities/shapes, actions, filters, scope/permissions, files and integration handoffs.

## Shared transport contract

See [apiTypes.ts](../src/core/api/apiTypes.ts), [apiClient.ts](../src/core/api/apiClient.ts), [apiError.ts](../src/core/api/apiError.ts) and [common.ts](../src/shared/types/common.ts).

```ts
interface ApiResponse<T> { data: T; status: number; message?: string }
interface PaginatedResult<T> {
  data: T[]; total: number; page: number; pageSize: number; totalPages?: number;
}
type PaginatedApiResponse<T> = ApiResponse<PaginatedResult<T>>;
interface ApiErrorResponse {
  status: number; message: string; errors?: Record<string, string[]>; code?: string;
}
```

`ApiResponse` is the client transport result: fetch wraps the HTTP JSON body in `data` and supplies actual HTTP `status`. The HTTP success body is the requested domain DTO, **not a second ApiResponse envelope**. For a list, the body is `{ data: [...], total, page, pageSize, totalPages? }`. Service adapters unwrap the transport wrapper so hooks retain their existing DTO:

```ts
const response = await apiClient.get<PaginatedResult<Customer>>(agreedPath, {
  params: { search: 'Acme', page: 1, pageSize: 10 }, signal,
});
return response.data;
```

- Pagination is one-based; total is the number of matching rows before slicing. totalPages is optional and may be derived. Preserve domain additions such as summary/unreadCount. LeadListResponse currently has only data/total: project a canonical server page into that public DTO rather than changing its UI.
- HTTP errors may contain `{ message, code, errors }`; actual HTTP status is authoritative. Field validation uses arrays of strings and HTTP 422. ApiError exposes 401/403/404/422/5xx helpers and safely handles malformed/non-JSON error bodies. Network/cancellation errors remain native fetch errors.
- HTTP 204 becomes `{ data: undefined, status: 204 }`; use a void service response. Detail methods currently return null or throw depending on the service; preserve the expected UI handling.
- String/number/boolean query values are encoded; false/zero JSON bodies work. FormData lets fetch set its multipart boundary. The generic client reads JSON successes; agree on a separate authorized binary/download adapter for files/exports.
- Request config accepts AbortSignal and optional fetch credentials. The scaffold can read a legacy bearer-token key; mock auth stores no real tokens. Explicit Authorization headers take precedence. Decide production cookie/CORS/CSRF or bearer/refresh strategy; do not treat the legacy key as an implemented session strategy. Automatic retries/timeouts are not configured.
- Existing DTOs use string IDs, ISO date/time strings and numeric amounts/quantities. Agree decimal precision, currency rounding, date-only versus instant/timezone semantics and optional/null fields; map at the service boundary.
- Browser-supplied actor IDs, tenant IDs, permissions and permittedBranchIds are mock context, never server authority.

## Required backend rules

1. **Authentication:** enforce authentication/authorization; implement production token or secure-cookie strategy, login/logout, recovery/change password, MFA/challenges/recovery and session management. Demo CAPTCHA/MFA/session metadata are not production security.
2. **Tenant isolation:** verify membership from the server session. Never trust browser tenantId as the security boundary. Validate related IDs, files, exports and aggregates within that tenant.
3. **Branch grants:** validate active/requested branches, both transfer endpoints, warehouses/locations and company-wide aggregation against server grants.
4. **RBAC:** enforce exact action and sensitive-field permissions even when the UI hides routes/buttons. Keep platform and tenant catalogs separate; role names are descriptive.
5. **Files:** product images/files, HR, accounting, projects, documents, supplier/customer and support attachments need server storage, metadata/versions and authorized previews/downloads. Validate content/size/type and linked ownership; object URLs are not persistence.
6. **Payments:** PayHere secrets, checkout signatures, verified webhooks, duplicate notifications and final paid status are backend-owned. Demo actions cannot authorize production payment.
7. **Messaging:** email/SMS/WhatsApp credentials, sending/retries/delivery/webhooks are backend-owned. Frontend settings contain no provider secrets; current sends record mock history only.
8. **Accounting:** backend authority covers postings, ledger, COGS, valuation/cost layers, journal balancing, locked periods and tax rules. Current reference-cost/tax/FX previews are not finalized policy.
9. **Offline sync:** validate queued POS/stock commands, recheck grants, enforce idempotency/duplicate protection and stock concurrency, and return deterministic conflict/retry outcomes. Ignore mockOutcome as production authority.

## Domain contracts

### Auth

**Sources/shapes:** `src/core/auth/authService.ts`, `mockAuthService.ts`, `AuthProvider.tsx`, `types/authService.ts`, `types/user.ts`, `securityService.ts`; `src/features/settings/security/services/loginActivityService.ts`; auth form schemas in `src/features/auth/schemas/securitySchemas.ts`. User supplies id/tenantId/name/email/roleId/read-only roleName/branchIds/defaultBranchId/status. AuthStatus/LoginResult and RestoredAuthSession describe login/challenge/restore states.

**Actions/filters/access:** login, async restore, completeLogin/logout, CAPTCHA/MFA verification/resend, reset/change password, MFA enrollment/recovery and session listing/revocation. Credential/user/session lookups are not public searchable identity lists. Identity/tenant/role/branch grants must come from the account, with platform sessions separated. No user/role switch operation exists. Profile is read-only; no avatar-edit API workflow is defined.

**Files/handoff:** no specific upload. Replace identity-only browser sessions and mock challenge service. AuthService's current completion/logout hooks are synchronous local hooks; coordinate awaited server revocation with callers. If the backend returns multiple roles/effective permissions, map the single-role User contract and PermissionProvider together. Retain query clearing, account-provider resets and protection against late auth responses after logout.

### Tenants / company

**Sources/shapes:** `src/core/tenant/TenantProvider.tsx`, `types/tenant.ts`, `mocks/tenants.ts`; `src/features/settings/company/services/companyService.ts`, adjacent Company type/schema; `src/features/platform/services/platformService.ts`, `types/platform.ts`. Tenant/Company and PlatformTenant/Input carry profile, currency/timezone/locale, status, plan and entitlements.

**Actions/filters/access:** own-company load/update; platform tenant create/update/suspend/reactivate/subscription lifecycle. TenantProvider currently reads fixtures directly. Platform foundation lists are filtered in UI and have no established server page DTO. Company uses settings.company grants; platform lifecycle uses platform grants. Tenant users remain pinned to their account's tenant.

**Files/handoff:** agree branding asset storage where required. Server provisioning must consistently create company/default branches/grants/subscription. Separate mock platform/company stores and company demo fallback are not production tenant provisioning; never copy another company's fallback profile.

### Branches

**Sources/shapes:** `src/core/branch/branchService.ts`, `BranchProvider.tsx`, `branchAccess.ts`, `types/branch.ts`; `src/features/settings/branches/schemas/branchSchema.ts`. Branch, GetBranchesParams, PaginatedBranchesResult and CreateBranchInput include code/name/main/active/manager/address data.

**Actions/filters/access:** paginated list, all/options/detail and create/update/delete. Search/status/page/pageSize come from GetBranchesParams. Branches are tenant-owned; settings.branches actions govern management. BranchProvider has broader visibility for branch-management grants; verify the same approved policy server-side. Selecting a branch is frontend scope, not a grant.

**Files/handoff:** none specific. Validate defaults/main branches/deletion dependencies; keep IDs consistent across user grants, warehouse/location, operational records and report filters. Preserve restored branch selection after grants load.

### Users

**Sources/shapes:** `src/core/auth/userService.ts`, `types/user.ts`; `src/features/settings/users/services/userOptionService.ts`, schemas/userSchema.ts. User/CreateUserInput, GetUsersParams/PaginatedUsersResult; UserOption is a minimal assignment projection rather than sensitive personnel data.

**Actions/filters/access:** team CRUD/status/detail and scoped assignment options; search/status/roleId/branchId/departmentId/page/pageSize. Tenant-wide identities carry branch grants. Team management uses settings/users permissions; minimal CRM/Sales option lookup must remain usable without exposing private account data. UI components no longer import mockUsers.

**Files/handoff:** no dedicated user upload workflow. Role/status/branch changes must update real session authority and invalidate caches. Mock user management and seeded credential stores are separate; do not reproduce that separation as production identity authority.

### Roles / Permissions

**Sources/shapes:** `src/core/permissions/roleService.ts`, PermissionProvider.tsx, permissionScope.ts, types/role.ts, tenantPermissionConstants.ts, platformPermissionConstants.ts; `src/features/settings/roles/services/permissionMatrixService.ts`. Role/RoleWithUsage, permission strings, checks and matrix/catalog DTOs.

**Actions/filters/access:** role CRUD/list/detail, usage, save scoped permissions and matrix lookup; search/status/page/pageSize via GetRolesParams. Guard system/assigned role deletion. Tenant/platform scope cannot cross. Preserve exact existing workflow aliases (quotation.approve, purchase.view, salesOrder.edit) and granular resource keys; role display names never grant access.

**Files/handoff:** none. Resolve effective grants consistently with authenticated identity; update caches after administrative changes. Permission assignment remains separate from role metadata changes.

### CRM

**Sources/shapes:** `src/features/crm/leads/services/leadService.ts`, leadActivityService.ts, leadConversionService.ts; `src/features/crm/opportunities/services/opportunityService.ts`; adjacent types/schemas. Lead/LeadActivity/Opportunity, form/conversion values, LeadListParams/Response and GetOpportunitiesParams/PaginatedOpportunities.

**Actions/filters/access:** lead CRUD, calls/email/meetings/notes/activity status, qualification/lost reasons, conversion; opportunities CRUD/stage/won/lost/reopen/pipeline and quotation handoff. Lead conversion must atomically create/link a Customer and mark converted; converted is not a free-form status edit. Scope is tenant + branch. Lead search/status/source/page; opportunity owner/customer/stage/status/close-date filters follow its params. Use leads/CRM activity/opportunity grants and leads.convert.

**Files/handoff:** no dedicated CRM upload service; linked customer documents use the library. Keep scoped owner/customer/lead lookups, lost reasons and source IDs. An email activity record is not an actual send operation.

### Customers

**Sources/shapes:** `src/features/customers/services/customerService.ts`, types/customer.ts, schemas/customerSchema.ts. Customer/code/type/status/contact/address/commercial/credit/tax fields, CreateCustomerInput and GetCustomersParams -> PaginatedResult<Customer>.

**Actions/filters/access:** list/detail/create/update/delete/export. Existing detail is a modal/list flow. Search name/code/email/phone, status/type/page/pageSize; sorting is currently UI behavior rather than a defined server sort parameter here. Current customer records are tenant + branch scoped. customers.view/create/edit/delete/export guard actions.

**Files/handoff:** document metadata needs shared server-backed storage. CRM/Sales/Accounting use the same customer IDs/balances; do not create independent analytics customer records.

### Suppliers

**Sources/shapes:** `src/features/suppliers/services/supplierService.ts`, types/supplier.ts, schemas/supplier.schema.ts. Supplier/contact/address/tax/bank/payment terms, Note/Activity/Transaction, balance/statement/performance, GetSuppliersParams/PaginatedSuppliersResult.

**Actions/filters/access:** tenant directory CRUD/status, notes CRUD, documents, purchase history, transactions, balance, dated statements and performance. Search/status/category/country/sort/page filters follow GetSuppliersParams. Identity is tenant-wide; transaction/history branch/date requests must be intersected with server grants. Actual keys are suppliers.suppliers.*. Protect bank data and exports according to agreed policy.

**Files/handoff:** shared Supplier files require storage/authorization. Historical summaries include legacy/mock projections; map authoritative Purchasing/Accounting without changing displayed DTOs. Bank details do not initiate a payment.

### Products

**Sources/shapes:** `src/features/products/services/*Service.ts`, types/product.ts, priceList.ts, productRelationships.ts, productHandoffs.ts and schemas/. Main adapters: productService, priceListService, productHandoffService, variant/image/document/specification/import/master-data/relationship services. Product/ListItem/Summary, variants/attributes, Category/Brand/UOM, images/files/specs, supplier links/bundles/related products, price lists/rules/tiers/resolved price.

**Actions/filters/access:** CRUD/status/archive/dependency-guarded deletion, identifier availability, variant generation/uniqueness, image primary/order, file/specification CRUD, supplier/bundle validation, master data, pricing resolution and import preview/import/export. GetProductsParams search/status/category/type/inventoryTracking/sort/page; result adds summary. Master data is tenant-wide, stock enrichment branch-specific. Use exact products/master-data/price-list/import/export/manage_prices/download grants.

**Files/handoff:** durable images/files, access URLs and unattached-file cleanup. CSV is parsed; Excel preview currently uses sample rows. Product CRUD must not mutate stock. Price/variant/bundle/tax resolution must be shared by Sales/POS/Storefront/Purchasing.

### Purchasing

**Sources/shapes:** `src/features/purchases/services/purchasingService.ts`, purchasingStore.ts, types/purchasing.ts, schemas/purchasingSchemas.ts. Request/RFQ/SupplierQuotation/PO/GRN/Invoice/Return, line/document/approval/audit and matching DTOs. types/purchaseOrder.ts is a retained legacy supplier-history model, not the canonical active PO.

**Actions/filters/access:** request create/update/submit/approve/reject/cancel; RFQ/quotation create/select; PO create/from-quotation/update/submit/approve/send/cancel; complete GRN, invoice/matching, returns, attachment/export/payment handoff. PurchasingListParams includes permitted branches, search/supplier/branch/warehouse/status/approval/date/sort/page; lists return data/total/page/pageSize. Tenant + permitted branch; exact PURCHASE_WORKFLOW/resource grants and source ownership constrain transitions.

**Files/handoff:** Purchase attachments use the library. GRNs/returns apply stock effects once via Inventory; invoice matching compares ordered/received/invoiced quantities. Supplier payment handoff references Accounting; prevent duplicate sources/overpayments and finalize posting server-side.

### Inventory

**Sources/shapes:** `src/features/inventory/services/inventoryService.ts`, warehouseService.ts, stockLocationService.ts, inventoryTrackingService.ts, inventorySettingsService.ts, inventoryReportService.ts, stockVelocityService.ts, inventoryExportService.ts; types/inventory.ts, inventorySettings.ts, stockVelocity.ts and schemas/inventorySchemas.ts. Warehouse/location/balance/movement/summary/batch/serial/product-stock/settings/report DTOs.

**Actions/filters/access:** warehouse/location CRUD/dependency guards, stock/batch/serial/expiry/ledger reads, product/variant branch detail, settings, velocity/valuation/ageing/margins/dead-stock/wastage/in-transit/reorder reports. Search/status/expiry/movement/date/sort/page and allowed-branch filters are defined in each params type. Keys include tenant/branch/warehouse/location/product/variant. Validate location/warehouse ownership. Base inventory.view plus granular resource/report/settings grants apply.

**Files/handoff:** scoped CSV/print/export; stock reports derive from balances/batches/movements, not separate persistence. ProductStockSummary belongs to inventoryStockService. Server-approved negative-stock/count settings govern mutations.

### Stock workflows

**Sources/shapes:** `src/features/inventory/services/stockWorkflowService.ts`, inventoryWorkflowService.ts, inventoryStockService.ts, stockAccountingService.ts; types/stockWorkflows.ts and inventory schemas. Adjustment/Transfer/BranchStockRequest/Count/ReturnWastage/ReorderWorkflowItem plus handoff/effect DTOs. stockService.ts is a compatibility alias, not a second stock API/store.

**Actions/filters/access:** adjustments decide; transfers approve/dispatch/in-transit/receive/complete; requests decide/convert; count create/get/save draft/complete/decide; returns/wastage decide; reorder purchase handoff. WorkflowListParams search/status/date/branch/page and allowed branches. Both transfer endpoints and tracked selections require grants within one tenant; create/approve/receive/count permissions differ.

**Files/handoff:** related documents use the library where present. Atomic balance/reservation/batch/serial/movement changes and exactly-once source effects are required. Approval-required counts apply corrections only on approval. Reference-cost previews become journal drafts needing accounting review/approval/posting.

### Sales

**Sources/shapes:** `src/features/sales/services/salesService.ts`, salesStore.ts, flashSaleService.ts; canonical types/sales.ts with compatibility re-exports, schemas/salesSchemas.ts. Quotation/Order/Delivery/Invoice/Payment/Return/CreditNote/RecurringInvoice/CommissionSummary, lines/approval/history and flash-sale DTOs.

**Actions/filters/access:** quotation submit/approve/reject/send/accept/expire/cancel; order create/from-quotation/update/confirm/process/cancel; delivery completion; invoice approve/send/void; receive payment; return/credit note; recurring create/toggle; commissions/attachment/export/mock print/share/email and flash-sale schedule/disable. SalesListParams search/customer/branch/warehouse/salesperson/status/paymentStatus/date/sort/page/permitted branches. Use existing SALES_WORKFLOW/resource grants; e.g. quotation.approve, salesOrder.edit, invoice.approve, payment.receive.

**Files/handoff:** Sales attachments need storage, real sending/recurrence need jobs. Stock reservation/delivery/return and receivable/payment/commission handoffs must share IDs with Inventory/Accounting/HR. POS orders already use the Sales order type. Enforce flash-sale overlap/product/branch ownership and source uniqueness.

### POS

**Sources/shapes:** `src/features/pos/posService.ts`, receiptMessageService.ts, posDisplay.ts; Checkout schema, PosSale/Refund/Shift, tracked items, split tender, promotions/gift/loyalty and ReceiptMessage.

**Actions/filters/access:** open shift/drawer confirmation, cash movements/expected cash/count/approval, active shift, checkout/refund/restock, receipts/reprint and reports. Service reads use TenantBranchScope; date/cashier/payment reports aggregate scoped arrays, not a server page DTO. pos.view/sell/discount/refund/shift.* and report/reprint/settings grants apply. Validate cashier/open shift/warehouse/location/tracking; approval uses another authorized user.

**Files/handoff:** local receipt printing; server-owned send history/delivery. Checkout must reprice, validate tender, allocate bundle/stock once, and persist linked Sales/Accounting handoffs. Device tests/customer display are mocks/browser state, not physical-device connectivity.

### Storefront

**Sources/shapes:** `src/features/storefront/storefrontService.ts`, reviewService.ts, abandonedCartService.ts; productHandoffService; CartItem/CheckoutDetails/StoreOrder/tracking token/CustomerReview/CartSnapshot.

**Actions/filters/access:** public catalog/search/quote/place/track; staff list/confirm/advance/cancel; review submission/moderation; abandoned-cart save/convert/list. simulatePayHere is demo-only. Public routes live under /shop/:tenantId/:branchId. Expose only enabled tenant/branch saleable data; tracking validates a server-issued credential. Staff fulfilment/reviews/cart access follows existing Sales/POS grants and allowed branches. No server pagination DTO is defined for these queues.

**Files/handoff:** use authorized product image URLs. Server repricing/stock/tax/reservation and fulfilment must be atomic. PayHere signing/verified callbacks determine real payment state. Anonymous cart snapshots currently track this browser only; retention/consent/recovery jobs are undecided.

### Accounting

**Sources/shapes:** `src/features/accounting/accountingService.ts`, fxRevaluationService.ts; active DTOs live in those services. AccountingScope/Account/Journal/Line/OpeningBalance/Settlement/Expense/BankLine/LedgerRow/ReferenceRecord/Handoff/PostingDefault/VatReturnDraft/WithholdingRecord/FX positions. Period/tax settings are in tenantSettingsService.

**Actions/filters/access:** account/opening/journal saves, approval/posting/source journal preparation, settlements/expense approvals, bank matching/finalization, ledger/trial balance/statements/profit-loss/balance-sheet/cash flow, AR/AP/matching/tax preparation, reference budgets/assets/cost centers/recurring and FX review. Filters support branch/date/search/status; many reads return arrays/derived summaries. AccountingScope is tenant/activeBranchId/permittedBranchIds. finance resource view/create/approve/post/reconcile/export grants apply.

**Files/handoff:** journal/expense/import documents need storage/row validation. CSV parses; Excel selection uses sample preview. Only posted journals/openings affect the ledger; operational handoffs require mapping/review. Server defines immutable postings/reversals/period locks/COGS/costing/FX/depreciation/VAT/WHT; settlement allocation prevents overpayment/duplication and does not itself transfer bank funds.

### HR / Payroll

**Sources/shapes:** `src/features/hr/hrService.ts`, advancedHrService.ts, types/employee.ts; routes are in `src/app/routes/hr.routes.tsx`, and schemas are in HR forms/services. Employee/HrScope, Shift/Roster/Attendance/Correction, Leave/Holiday/Overtime, pay items/revisions/loans/commissions/Payroll/lines/payslips; Job/Candidate/Onboarding/Training/Review/Okr/Feedback/Policy/Ticket/Asset/Exit.

**Actions/filters/access:** employee/shift/roster, attendance/corrections, leave/overtime/loan/revision/commission approval, payroll prepare/review/approve, biometric preview/import; recruitment/hiring, onboarding/training/reviews/OKRs/private feedback/policies/tickets/assets/exit checklist. Tenant + allowed branches; branch/employee/department/status/date/period filters are often UI filters on scoped arrays. Granular hr resource/action/sensitive grants apply; minimal employee lookups must not return salary/private feedback.

**Files/handoff:** identity/contracts/certificates/policies/HR attachments and payslips need authorized storage. Organization comes from Settings, commission from Sales collections, payroll from Accounting handoffs. Mock EPF/ETF/payroll formulas require approved statutory policy; biometric hardware is not connected.

### Projects

**Sources/shapes:** `src/features/projects/projectService.ts`, ProjectsPage.tsx; ProjectScope aliases HrScope. Canonical Project/Milestone/Task/TeamMember/Timesheet/ProjectExpense/Billing/ProjectAudit are exported by the service. Older types/project.ts is a different seed/read model, not the active task enum.

**Actions/filters/access:** project save/status, milestone progress, task/dependency/Kanban, team allocation, timesheet submit/decide, expenses/approval, profitability and billing handoffs. Tenant + permitted branches; customer/manager/status/task/employee/date filters currently operate over scoped reads. projects resource view/create/edit/assign/approve/complete/export grants and ownership checks apply. Use active task statuses including backlog/to_do/blocked.

**Files/handoff:** documents/receipts need storage. Source uniqueness prevents duplicate fixed/milestone/time/expense billing; approved timesheets/expenses determine current profitability and Sales/Accounting handoffs.

### Documents

**Sources/shapes:** `src/features/documents/documentService.ts`, DocumentsPage.tsx; `src/shared/types/document-record.ts`. CompanyDocument extends DocumentRecord, with category/version/audit/scope/filter/upload DTOs.

**Actions/filters/access:** library/detail/linked reads, category save, upload/progress, metadata/version updates, authorized view/download/version/archive, audit and reminder handoffs. Tenant/active/permitted branches; search/category/module/entity/uploader/date/expiry/MIME/sort/page/archive filters. documents.view/upload/edit/download/archive/categories/view_sensitive differ. linkedPublic is an internal limited metadata path, not public sensitive-file access.

**Files/handoff:** current validation includes MIME/extension pairs and 10 MB limit; repeat server-side. Agree storage IDs/version retention/progress/signed access URLs. Validate linked ownership/category/reminder<=expiry. Backend reminder jobs should use Notifications rather than a second alert system.

### Notifications

**Sources/shapes:** `src/features/notifications/services/notificationService.ts`, types/notifications.ts, schemas/notificationSchemas.ts. NotificationRecord/Scope/Filters/ListResult adds unreadCount; Notice and Template input/response DTOs.

**Actions/filters/access:** list/read/read-all/archive/restore/publish, notices CRUD/acknowledge, template CRUD/test and channel configuration. Search/archive/read/type/priority/module/branch/date/page filters. Tenant/user audience, company/branch/user targeting and requiredPermission constrain rows and counts. notifications/notices/template/preference grants plus underlying module permissions apply.

**Files/handoff:** none specific. Operational notifications currently derive from business records; backend events must retain audience/sourceKey idempotency and per-user read/archive state. Real channel sends require server credentials/jobs/delivery. Reuse the shared header dropdown and notification center.

### Support

**Sources/shapes:** `src/features/support/services/supportTicketService.ts`, types/support.ts, schemas/supportSchemas.ts. Ticket/Detail/conversation/timeline, create/reply/status/priority commands, Scope/Filters/ListResponse.

**Actions/filters/access:** create/list/detail/dashboard/export/reply/status/priority/files and platform support responses. Search/status/priority/category/module/branch/creator/date/sort/page. Users see own tickets unless support.manage; branchless company tickets and allowed branch tickets follow the service policy. support.view/create/reply/close/manage/export; platform responses require platform grants. addMockSupportResponse is a demo operation, not tenant authority to impersonate support.

**Files/handoff:** shared Support attachments/reply IDs need ownership-checked storage/download. Preserve creation/reply/status/attachment notifications and audit. Platform support delegates to this service rather than a second ticket dataset.

### Reports

**Sources/shapes:** `src/features/reports/services/reportService.ts`, reportCatalog.ts, types/report.ts and utils/. ReportRequest { reportId, scope, filters }; ReportResponse { definition, generatedAt, columns, rows, kpis, chart, sourceModules }.

**Actions/filters/access:** 63 definitions in sales/purchases/inventory/finance/hr/projects/pos, getReport/export/print. dateFrom/dateTo/branch plus report-specific customer/supplier/product/user/warehouse/location/status. Tenant + active/permitted branches; category/report/export/print grants differ. Exports follow current helpers; do not promise workbook parsing/content not implemented.

**Files/handoff:** large server exports may need authorized downloads while preserving columns/formats/filters. Derive from authoritative business data/posted financial values, not independent report-only stores. qa:reports covers source consistency and scoped envelopes.

### Audit

**Sources/shapes:** `src/core/audit/auditEventService.ts`, types.ts; `src/features/audit/services/auditExportService.ts`. TenantAuditEntry/input/access/filters/page; legacy entries are adapted.

**Actions/filters/access:** internal record/recordLegacy, immutable list/export; read-only UI without edit/delete. Search/user/module/action/branch/sensitivity/date/sort/page; tenant + allowed branches and branchless company events. audit.view/export/security.view/sensitive.view gate rows; platform audit stays separate.

**Files/handoff:** authorized exports. Server creates authoritative actor/entity/reference/action/snapshots/time/sensitivity evidence transactionally; browser events are not security evidence. Agree retention/immutability/redaction.

### Offline Sync

**Sources/shapes:** `src/features/sync/services/syncService.ts`, SyncProvider.tsx, types/sync.ts. QueueItem/EnqueueInput, Conflict/AccessScope and keep_local/use_server resolution; statuses pending_sync/syncing/synced/failed/conflict, modules POS/stock.

**Actions/filters/access:** enqueue/dedup/persist/restore/process/retry/conflict decisions/remove/clear/subscribe. Status/module/branch UI filters, no server page DTO. Tenant/permitted branches, sync.view/manage and queued requiredPermission; server revalidates current source user/branch grants. Current process simulates outcomes rather than replaying production commands.

**Files/handoff:** no specific upload. Generic Record<string, unknown> payload is not a validated domain command. Agree versioned POS/stock payloads, idempotency keys/duplicate response semantics/concurrency versions/conflict DTOs, device/user ownership and retention/encryption/re-login replay. Logout preserves queued business operations intentionally.

## Other existing surfaces

| Surface | Sources | Scope, actions and integration |
| --- | --- | --- |
| Finance/localization/numbering settings | src/features/settings/finance/services/tenantSettingsService.ts and adjacent types/schemas | Tenant defaults/periods/taxes/terms/payment methods/sequences/preferences; exact settings grants. Server owns numbering uniqueness/concurrency and period/tax validity. |
| Organization | src/features/settings/organization/services/departmentService.ts, designationService.ts and types/schemas | Tenant CRUD/search/status/branch/department/page filters where defined; shared user/employee references and dependency guards; settings/HR grants. |
| Integrations/devices | src/features/settings/integrations/services/integrationSettingsService.ts; src/features/settings/devices/services/deviceSettingsService.ts; adjacent types/schemas | Tenant channel configuration/tests and masked bank details; branch device settings/tests are mock. Exact settings grants; secrets only on server, hardware strategy separate. |
| Platform | src/features/platform/services/platformService.ts, types/platform.ts, schemas/platformSchemas.ts | Foundation of tenants/plans/subscriptions/features/users/settings/maintenance/health/usage/audit; dedicated platform grants. Real billing/health/usage/provisioning authority required. Support delegates to shared tickets. |
| Dashboards | src/features/dashboard/services/dashboardService.ts, moduleDashboardService.ts, types/dashboard.ts, types/moduleDashboard.ts and module aggregators | Date period/range, tenant/active/permitted branches, permission-based metrics/charts/approvals/alerts/recent rows and partial source errors. Optional server aggregation must preserve semantics without new business datasets. |
| Global search | src/features/global-search/services/globalSearchService.ts, types/globalSearch.ts and hooks | Debounced/cached permitted service index, query >=2, case-insensitive token matching, scoped DTOs/existing routes. Backend can provide equivalent search or existing list queries; endpoint choice undecided. Recent terms are user/tenant/branch local. |

## Mock ownership and migration

Fixtures live in feature mocks/ directories, core auth/tenant/branch/permission mocks and shared/mocks. Mutable stores include productStore, inventoryStore, purchasingStore and salesStore; Accounting/HR/Projects/POS/Documents/settings also initialize records inside service files. Replacing fixture imports alone does not connect those stores to a database.

Compatibility exports/types remain where callers use them (legacy supplier purchase history/project seeds, Sales invoice aliases and stockService). Active service DTOs are authoritative; map older read models deliberately. Do not introduce second approval, document, audit or notification systems.

Some UI components still consume non-user fixtures for options/previews (for example CRM customer/lead options and employee history seeds). Replace those with scoped lookup services during domain integration. Auth cleanup removed direct mock-user UI imports, not all mock dependencies. VITE_USE_MOCKS=false respects the flag but does not create real adapters or activate absent APIs.

## Validation and open decisions

Run npm ci, npm run typecheck, npm run lint, npm run build and npm run qa:all. The 21 individual QA suites run sequentially in fresh processes, without live APIs; retain mocks/regressions during integration. Add backend contract tests and browser acceptance coverage for auth/restore/logout, branch switching, permissions, CRUD/approval/drill-downs, files/printing and desktop/tablet/mobile states. Platform-specific and browser/end-to-end certification are not provided by the service suites.

Agree at kickoff: session/token/cookie/refresh/MFA/revocation; endpoint/version/error fields; currency/date precision; provisioning/grants/sensitive access; transaction and numbering boundaries; stock/payment/source idempotency; posting/costing/tax/FX/depreciation/payroll policy; files/workbook imports; payment/messaging webhooks/jobs; hardware connectivity; offline command/retention/conflict rules; deployment SPA deep-link rewrites, bundle budgets and request cancellation/timeouts.

No backend endpoints, new business features or UI redesign are introduced by this handoff pass.
