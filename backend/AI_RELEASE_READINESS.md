# AI Assistant release readiness (Version 2, Step 5)

## Decision

**NOT READY — BLOCKERS REMAIN.** This file records source and local test evidence; it is not a production approval. The verified data engine covers 17 of 88 catalog resources, live Gemini quality has not been measured against the corpus, the draft handoff has no authoritative AI confirmation service, and no staging, browser accessibility, load, or rollback rehearsal has been completed.

Local verification on 2026-11-27: `mvnw.cmd -q package` with an isolated PostgreSQL test URL passed **145 tests, zero failures, zero errors, two skipped optional live Gemini tests**. `pnpm typecheck`, `pnpm lint`, `pnpm qa:all` (**33 suites**), `pnpm qa:ai-evaluation`, and `pnpm build` passed after dependency updates. Lint reported six pre-existing warnings. `docker compose --env-file .env config --quiet`, frozen lockfile resolution, workflow YAML parsing and `git diff --check` passed. `pnpm audit --audit-level high` passed with three moderate advisories. These checks do not establish browser visual behavior, live provider quality, sustained concurrency, or staging health.
The optional `QuickErpMcpHttpIntegrationTest#liveChatReadsTheAuthorizedFixture` was then run once with a configured local Gemini key and synthetic tenant: **one test passed, zero failures**. It establishes one live provider/MCP path, not multilingual quality or broad task success.
The local Docker daemon was unavailable, so no container image build or container startup was verified.

## Architecture and security boundary

The React drawer sends an authenticated request to `/api/v1/ai/chat`. Spring resolves tenant, user, current branch, entitlements and permissions from current server state. The orchestrator offers only registered tools to Gemini. Direct dispatch reauthenticates the bearer and rechecks scope. The optional Java MCP transport authenticates each local HTTP request and now rechecks the principal at tool execution. The data engine uses an explicit resource and field registry, parameterized SQL and bounded result sizes. The assistant rechecks the scope before persisting and returning an answer. Conversation list, detail, continuation and deletion require the same current owner, branch and permission fingerprint. The model cannot call an action confirmation endpoint; three draft tools return handoff-only data for normal ERP forms.

The provider key stays in the backend. Provider response bodies are capped at 256,000 bytes before parsing. The answer guard replaces monetary figures without matching currency and numeric tool evidence, including when no tool was used; it is a narrow safety net and does not prove that all prose or counts are correct. Source record text remains untrusted and must not be treated as instruction. Audit rows contain metadata, token counts, outcome and latency rather than prompts or record payloads. Retention cleanup removes expired AI conversations and request counters.

## Resource coverage

`ErpResourceRegistry.coverage()` is the executable inventory: **88 catalog names, 17 validated, 11 fully queryable within safe fields, 6 partial, 71 unsupported**. This is field-limited coverage, not full ERP functional coverage.

| Status | Resources | Limit |
|---|---|---|
| Full within approved fields | customers, suppliers, leads, sales quotations, sales orders, deliveries, purchase orders, goods receipts, stock balances, stock movements, projects | Only declared scalar fields and verified relationships; no arbitrary collections. |
| Partial | products, opportunities, expenses, employees, sales invoices, purchase invoices | Currency, sensitive HR fields, and net revenue or cash semantics restrict aggregation. |
| Unsupported or intentionally restricted | 71 remaining catalog names, including payroll, POS, web orders, payments, documents, support, notifications and audit logs | Absent from dynamic discovery until collection, field, branch and record-level rules are validated. |

The exact unsupported names and reasons come from the registry. An unsupported query must ask for clarification or say the resource is unavailable; it must never synthesize an answer.

## Quality evaluation

`ai-evaluation/scenarios.jsonl` contains 30 version-controlled scenarios covering single words, short and complete requests, financial comparison, relationships, follow-ups, Singlish, Sinhala, typos, ambiguity, prompt injection and draft actions. The corpus deliberately contains **questions and expected behaviors**, not model-generated reference answers. The PostgreSQL integration fixture in `ErpQueryEngineIntegrationTest` provides two tenants, two branches, scoped roles and independently asserted USD/LKR invoice totals, stock quantities and comparisons.

Run `pnpm qa:ai-evaluation` in `frontend` to validate the corpus. In staging, execute each case using a purpose-built synthetic tenant and record one JSONL observation per case. Each observation requires `id`, `tools` (array), `argumentValid`, `businessCorrect`, `grounded`, `taskSuccess`, `appropriate`, `authorized` (booleans), and `latencyMs` (number). Then run `node frontend/scripts/score-ai-evaluation.mjs path/to/observations.jsonl` from the repository root. Missing cases or measurements fail; the scorer never infers a pass from the expected behavior. Keep raw observations with the release evidence, excluding prompts containing real customer data.

Initial release gates: all 13 critical scenarios pass authorization, business correctness, grounding and task success; all authorization checks pass; structured arguments pass at least 95%; supported tasks pass at least 90%; expected tool selection passes at least 90%. Track p95 latency and compare it with the configured 60-second total request timeout. These thresholds need review after a statistically larger, representative staging sample. **Live results for this corpus: not measured.**

## Capability status

| Capability | Status | Evidence or limitation |
|---|---|---|
| Conversation history and current-scope isolation | PARTIAL | Repository and integration tests; no browser end-to-end run. |
| Dynamic discovery, query, filter and aggregation | PARTIAL | 17 validated resources; registry and PostgreSQL tests. |
| Financial exactness for supported sample calculations | PARTIAL | Decimal and currency assertions for synthetic invoices; net revenue and cash flow unsupported. |
| Gemini function calling | PARTIAL | Mock protocol tests; live corpus not run. |
| MCP authenticated transport | PARTIAL | Local HTTP integration tests; deployment proxy and concurrent restart behavior not rehearsed. |
| Tables, bar charts, KPI cards and record links | PARTIAL | Source render QA; browser and accessibility testing not completed. |
| Draft action preparation | PARTIAL | Read-only tool and handoff tests; existing ERP form remains responsible for save. |
| AI confirmation and idempotent backend execution | NOT IMPLEMENTED | No authoritative business domain write service for the three handoffs. |
| Rate limiting, usage tokens and retention | PARTIAL | PostgreSQL counters, token audit and retention tests; tenant cost budget and alerts not implemented. |
| Monitoring and load performance | PARTIAL | Audit latency and `/health` database check; no measured load or external alerting. |
| Controlled production rollout | BLOCKED | Requires staging evidence, tenant-by-tenant chatbot entitlement, key management and deployment approval. |

## Configuration and deployment

`backend/.env.example` lists required values. Set `APP_ENVIRONMENT=production`, database credentials, a strong `JWT_SECRET`, HTTPS `CORS_ALLOWED_ORIGINS`, `PASSWORD_RESET_URL`, backend-only `GEMINI_API_KEY`, limits and retention. Disable demo seeding and shared initial passwords. `ProductionGuard` checks unsafe core settings at startup. Docker Compose forwards all AI limit and MCP variables; it is a local template, not proof of a secure production network. Keep the backend private behind HTTPS and do not expose `/api/v1/mcp` through a public proxy. The MCP client accepts only a local `127.0.0.1` endpoint. Assign chatbot entitlements only to pilot tenants and verify module permissions separately.

`AI_ENABLED=false` is the global AI kill switch. It rejects chat, history and MCP tool access at the shared access boundary, without turning off the rest of ERP. Its default is `true` to preserve current development behavior, so production operators must explicitly set it to `false` until a pilot is approved. The tenant `chatbot` entitlement remains the per-company rollout control after the global switch is enabled.

`GET /api/v1/health` returns 503 when the database is unavailable. `GET /api/v1/health/ai` returns 503 when AI is disabled, the provider key is absent, the registry is empty, or MCP transport configuration is inconsistent. It returns only a coarse status. Neither endpoint calls Gemini, so a staging probe must additionally authenticate, ask a synthetic permitted question, verify a scoped tool result, exercise MCP if enabled, and check audit/retention state without logging secrets. Provider failures must be reported as unavailable; the ERP application must continue to work.

The 2026-11-27 frontend dependency audit initially found three high advisories in `source-map-js`, Vite and Zod. The lockfile now selects patched versions, and `pnpm audit --audit-level high` exits successfully with **three remaining moderate advisories**. Two involve the React Router 6 line and one is transitive `minimatch`; upgrading across major versions requires a separate compatibility review. The CI audit gate rejects new high or critical findings. Backend dependency scanning and container image scanning still require CI/security tooling and review before release.

For a small local concurrency check, set `AI_LOAD_TOKEN` for a synthetic user and `AI_LOAD_BRANCH`, then run `node frontend/scripts/run-ai-load-smoke.mjs` from the repository root. Optional `AI_LOAD_REQUESTS` (maximum 100) and `AI_LOAD_CONCURRENCY` (maximum 10) bound provider cost. The harness refuses remote hosts and prints only status counts and p50/p95 latency. It has not been run without a dedicated synthetic account and quota.

## Rollout and recovery runbook

1. Back up the database and record the current image, migration version, configuration and tenant entitlement snapshot. Review pending Flyway migrations; never edit applied migrations.
2. Deploy to isolated staging with synthetic data, run backend and frontend gates, the 30-case corpus, browser keyboard/contrast checks, and concurrent user tests. Record p50/p95 latency, provider tokens, tool calls, error rates and database query times. Verify no cross-tenant or cross-branch disclosure.
3. Review dependency scans and secret scans. A high-severity finding without mitigation is a release blocker. Confirm quota and cost alerts with the provider account owner.
4. Pilot one explicitly selected tenant. Enable chatbot entitlement for approved roles only. Watch audit error codes, 429 rates, provider failures, latency and cost. Stop expansion if any tenant boundary, accuracy or action-safety gate fails.
5. For rollback, revoke chatbot entitlement for pilot tenants first, then restore the previous backend/frontend images. Keep compatible database migrations; use a tested forward repair or a separately approved database restore if a migration is incompatible. Preserve AI audit evidence and investigate affected conversations. Do not delete data merely to hide an incident.
6. For an incident, disable new AI requests through tenant entitlements, retain metadata logs, rotate exposed provider or API credentials, assess affected tenant/branch scope, notify the incident owner and document recovery checks before re-enabling.

No production deployment or rollback was performed as part of this implementation.
