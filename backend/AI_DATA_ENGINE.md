# Quick ERP AI data engine (Version 2, Step 2)

The engine is a server-side, read-only library. It is registered as `ErpDataGateway` behind
`AiExecutionGateway.executeStructured(operation, arguments, accessContext)`. It does not add a
public data-query REST endpoint. Step 3 uses the ten operation descriptors from
`ErpDataGateway.operations()` and their typed input records in `ErpQueryRequest`. The existing
chat and conversation REST contracts remain unchanged. Function calling is documented in
`AI_FUNCTION_CALLING.md`.

## Operations and contracts

| Operation | Input | Result |
|---|---|---|
| `discover_erp_resources` | `{}` | Authorized resource summaries |
| `get_resource_schema` | `{ "resource": "sales_invoices" }` | Safe field types and verified relationships |
| `resolve_erp_branch` | `{ "name": "Colombo" }` | ID of a branch in the caller's allowed set |
| `resolve_erp_period` | `{ "period": "last_month" }` | Tenant timezone dates with inclusive start and exclusive end |
| `query_erp_records` | `Query` | Projected records, count, pagination and scope |
| `search_erp_records` | `Search` | Safe matches grouped by authorized resource |
| `aggregate_erp_data` | `Aggregate` | Database-calculated decimal groups and metric definition |
| `compare_erp_data` | `Compare` | Same aggregation over explicit periods; difference when comparable |
| `get_related_erp_records` | `Related` | One verified relationship, with both sides authorized |
| `search_erp_knowledge` | `{ "search": "GRN" }` | Bounded, sourced facts from checked-in contracts |

Example direct Java call (the integration tests use the same gateway and query methods):

```java
JsonNode arguments = mapper.readTree("""
  {"resource":"sales_invoices","select":["id","invoiceDate","status","currency","totalAmount"],
   "filters":[{"field":"status","operator":"eq","value":"posted"}],
   "sort":[{"field":"invoiceDate","direction":"desc"}],"limit":25}
  """);
JsonNode result = gateway.executeStructured("query_erp_records", arguments, trustedAccessContext);
```

`Query` supports `resource`, `select`, flat `filters`, `logic` (`and`/`or`), `sort`, `search`,
`limit`, `offset`, and `branchIds`. A filter has `field`, `operator`, and typed `value`.
Supported operators are `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `before`, `after`, `between`,
`in`, `contains`, `icontains`, and `starts_with`. Date `between` uses a start-inclusive,
end-exclusive ISO date pair; numeric `between` includes both ends. There is no nested Boolean
expression, regex, arbitrary JSON path, or user-provided SQL. `Aggregate` uses the same filters
plus `metric` (`count`, `sum`, `avg`, `min`, `max`, `count_distinct`), `field`, `groupBy` and optional
`dateBucket` (`month`/`year`). `Compare` supplies one aggregate contract, a date field and 2–12
explicit periods; it applies the same metric, status and scope filters to each period. `Related`
uses `sourceResource`, `sourceId`, `targetResource`, and optional `limit`.

Results contain `operation`, `status` (`SUCCESS` or `EMPTY`), `resource`, `source`, `generatedAt`,
`data`, and relevant counts, branch scope, filters, currency, metric definition and truncation.
Invalid or unauthorized input uses the existing `ApiException` JSON error convention. An empty
result means no *accessible* matching records; it does not establish that no records exist outside
the caller's scope.

## Resource coverage

The legacy catalog lists **88** resource names. Step 2 validates **17** against registered
frontend collections and TypeScript models: **11 fully queryable within their approved safe
fields**, **6 partial**, **71 unsupported**. `ErpResourceRegistry.coverage()` returns these counts
and reasons programmatically. Every validated resource supports safe discovery, schema, search,
filter, sort, page and count. Numeric aggregates are available only on explicitly marked fields.

| Coverage | Resources | Notes |
|---|---|---|
| Full within safe fields | `customers`, `suppliers`, `leads`, `sales_quotations`, `sales_orders`, `deliveries`, `purchase_orders`, `goods_receipts`, `stock_balances`, `stock_movements`, `projects` | Approved scalar fields only; line arrays are not flattened. |
| Partial | `products`, `opportunities`, `expenses`, `employees`, `sales_invoices`, `purchase_invoices` | Product prices, opportunity values and expenses have no reliable per-record currency for aggregation; employee salary and personal details are excluded; invoice values are not net revenue or cash. |
| Unsupported | Remaining 71 legacy keys, including `sales_payments`, `payment_methods`, `leave_requests`, `web_orders`, payroll, POS, documents, support, notifications and audit logs | Several have unverified mappings or special scope/field rules. For example, `sales_payments` and `settings.paymentMethods` have no corresponding registered list, the leave catalog needs model validation, and online orders are registered under `storefront.orders` rather than being interchangeable with `pos.webOrders`. They are absent from discovery and fail closed. |

`ErpResourceRegistry` contains each supported collection, module, required view permission,
branch rule, currency field and safe scalar field list. Schema discovery exposes field type and
allowed search, filter, sort and aggregation flags. Adding a resource requires verifying the
registered collection and TypeScript model, defining safe fields and permissions, checking its
branch and record visibility, defining meaningful numeric fields and relationships, then adding
PostgreSQL tests. No natural-language keyword rule is required.

Verified one-hop relationships include lead to opportunity, opportunity to quotation, customer
to quotation/order/invoice, quotation to order, order to delivery/invoice, delivery to invoice,
supplier to purchase order/invoice, purchase order to goods receipt/invoice, goods receipt to
purchase invoice, and product to stock balance/movement. The target's view permission and row
scope are checked independently. Project tasks are excluded because their stored records do not
carry the parent project's tenant and branch fields; a secure parent join needs further work.

## Access and storage rules

The trusted `AccessContext` comes from the Step 1 backend resolver. The engine checks chatbot
entitlement, tenant/platform separation, module entitlement and view permission for every
resource. The SQL always binds the authenticated tenant and the server-owned collection name.
Branch-scoped resources use the selected branch by default; explicitly requested branch IDs
must all be in the authenticated user's allowed set. Resources without a branch field reject
branch filtering. Sensitive resources with special row restrictions remain unsupported until
their exact `StateStore` visibility rules can be applied in SQL. Results expose only descriptor
fields; nested objects, bank details, salaries, tokens and audit metadata are never projected.

The query reads `erp_records` in a read-only transaction. It excludes deleted and `__order__`
rows. Individual object rows are preferred when present; `__all__` arrays are expanded only
when no individual rows exist, matching the frontend persistence decoder and preventing double
counts. `__value__` configuration rows are not queryable. Filtering, counting, grouping, sorting
and pagination run in PostgreSQL. Values are bound parameters; SQL field expressions come only
from compiled server-owned descriptors. V12 adds a narrow partial branch expression index for
individual rows; the existing `(tenant_id, collection, record_id)` primary key supports the
collection lookup. Queries are limited to 100 rows, 10 filters, 100 groups, 3 sort fields,
5,000 offset, five search resources, and a 3-second JDBC timeout by default. Limits are
configurable with `AI_QUERY_MAX_ROWS`, `AI_QUERY_DEFAULT_ROWS`, `AI_QUERY_TIMEOUT_MS`,
`AI_QUERY_MAX_FILTERS`, and `AI_QUERY_MAX_AGGREGATION_GROUPS`.

## Business accuracy

Aggregations use PostgreSQL numeric values and Java `BigDecimal`. Missing or nonnumeric selected
amounts cause `metric_unreliable`; they are never treated as zero. Monetary groups always include
their verified ISO currency field, and a missing or invalid currency is rejected. No exchange
conversion is performed. Invoice amount aggregations require an explicit status filter. The
result definition identifies them as stored document face values, paid amounts or outstanding
amounts; it does not call them revenue, profit or cash flow. Credit notes, returns, tax treatment
and POS overlap are not netted into a revenue metric. Expense amount aggregation is disabled
because the stored expense model has no currency field. Stock on-hand, committed, reserved,
available and in-transit quantities are separate fields; no inventory valuation is inferred.

The date resolver handles today/yesterday, calendar weeks, months, quarters, years, last N days
or calendar months, custom ranges, and current/previous financial years. It reads
`settings.general.timezone` and `weekStartsOn`, plus `settings.financialYear.startMonth/startDay`
for tenant periods. UTC is reported when timezone is absent; invalid configured zones or
financial-year starts fail. Comparison periods are explicit start-inclusive/end-exclusive dates
and report timezone. A zero comparison baseline returns `NOT_COMPARABLE` instead of an infinite
percentage. Rolling-month interpretation needs an explicit definition before it can be added.

Knowledge search currently indexes five short facts verified against the checked-in purchase,
sales, inventory and project models and the AI access service. It checks module and view
permission and returns source identifiers. Full workflow guides are not present in this backend
workspace, so approval procedures and payroll-accounting explanations are not indexed.

## Step 3 handoff

Use `ErpDataGateway.operations()` to advertise the ten operation names and descriptions, then
pass structured arguments to `executeStructured`. Keep `AccessContext` server-derived. Gemini
must never supply tenant, user, role or permissions, and its output must pass the strict argument
validator before execution. The returned JSON is safe for response generation; tool results
remain out of conversation metadata and audit prompts. Gemini and MCP now use this contract
through the Step 3 adapters.
