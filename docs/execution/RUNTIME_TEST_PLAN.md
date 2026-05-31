---
oli-version: "1.0"
based-on:
  - docs/product/PERFORMANCE.md
  - docs/product/THREAT_MODEL.md
  - docs/product/ROLE_PERMISSION_MATRIX.md
  - docs/product/modules/*/API_CONTRACTS.md
  - docs/audits/codebase-map/CODE_ROUTE_MAP.json (v5)
  - docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json (v5)
last-modified: 2026-05-31T00:00:00Z
last-modified-by: oli-runtime-plan
---

# Runtime Test Plan — Dentalemon

> **Design-time, template-emitting artifact.** Every k6 / axe-core / DAST snippet
> below is a TEMPLATE with placeholders (`{base_url}`, `{auth_token}`, payloads).
> The team fills these in and runs them with its own test infrastructure. This
> document plans runtime tests; it does not execute them.

> **Boot-smoke (2026-05-31 run — PASS):** the api-ts server (`services/api-ts`, port 7213,
> `bun src/index.ts`) booted headless and bound successfully —
> `🚀 Server running on http://0.0.0.0:7213`, job scheduler started (9 jobs), no
> errors/fatals/unhandled-rejections in startup log. Probe results: `GET /livez` → 200,
> `GET /auth/ok` → 200, `GET /auth/get-session` → 200, `POST /auth/sign-in/email` → 200
> (demo admin session minted), `GET /dental/branches` (no auth) → 401 (auth gate works).
> `GET /` → 405 and `GET /health` → 404 are valid responses (unmapped path / wrong method),
> not crashes. **Note:** `GET /readyz` → 503 — an optional dependency (MinIO/Valkey)
> readiness probe fails; this is a degraded-readiness signal, NOT a boot crash (liveness
> green, API serves authed requests). No console-error, no process crash → boot-smoke PASS.

---

## 1. Test Coverage Summary

| Runtime Test Type | Derived From | Status |
|-------------------|-------------|--------|
| Load / performance (k6) | PERFORMANCE.md SLAs + capacity targets + module API_CONTRACTS | PLANNED (templates) |
| Security / DAST | THREAT_MODEL.md STRIDE matrix + OWASP checklist | PLANNED (templates) |
| Auth matrix (role × endpoint) | ROLE_PERMISSION_MATRIX.md | PLANNED (matrix) |
| Accessibility (axe-core) | No `accessibility-baseline.md` found → **inferred WCAG 2.1 AA** (THREAT_MODEL compliance row) | PLANNED (inferred) |

> **CONFIRM:** a11y baseline inferred (WCAG 2.1 AA) for all UI modules — no
> `accessibility-baseline.md` found under `docs/product/modules/*/ui-prototype/`.
> THREAT_MODEL.md compliance mapping declares "WCAG 2.1 AA — declared but not
> verified," so AA is used as the target. Confirm or override.

> **Missing performance definitions (from PERFORMANCE.md, block full load testing):**
> concurrent-user target, offline CRDT merge time, image upload/processing time,
> PMD generation time, pg-boss background-job throughput. Load templates below use
> `{concurrent_users}` placeholders pending these definitions.

---

## 2. Load Test Scenarios

### 2.1 Scenarios derived from PERFORMANCE.md SLAs

| # | SLA Target | Measurement Point | Scenario Type |
|---|-----------|-------------------|---------------|
| L1 | Workspace load < 2s | Patient workspace open (full data) | Sustained load on workspace aggregate endpoints |
| L2 | Patient search < 1s | Search query → results | Sustained load on `GET /dental/patients` (search) |
| L3 | Per-tooth history < 1s (≤500 visits) | Tooth tap → history panel | Volume test: seed ≤500 visits, query per-tooth history |
| L4 | Timeline carousel 60fps | Swipe gesture on carousel | Client-side frame test (Playwright trace / DevTools), NOT k6 |
| L5 | Capacity: 10k patients / branch | Index sizing | Volume test: seed 10k patients, measure search/list degradation |
| L6 | Capacity: 100k visits / branch | Query pagination | Volume test: seed 100k visits, measure list/paginate degradation |

Carousel 60fps (L4) is a client-rendering target — measure with a browser frame
profiler (Playwright tracing / Chrome DevTools), not with k6.

### 2.2 Scenarios derived from module API_CONTRACTS.md

12 module contracts define 85 distinct endpoints. Each inherits the global
PERFORMANCE.md target for its surface (`< 1s` search/read; `< 2s` workspace
aggregate) unless a module overrides it.

Endpoint counts per module (from `API_CONTRACTS.md`):

| Module | Endpoints | Load Priority |
|--------|:---------:|:-------------:|
| dental-visit | 13 | HIGH (workspace SLA L1) |
| dental-patient | 11 | HIGH (search SLA L2) |
| dental-clinical | 10 | HIGH (workspace SLA L1) |
| dental-billing | 9 | MEDIUM |
| dental-imaging | 9 | MEDIUM (upload time UNSPECIFIED) |
| dental-org | 9 | MEDIUM |
| dental-pmd | 8 | MEDIUM (export/generate — PMD gen time UNSPECIFIED) |
| dental-perio | 6 | MEDIUM |
| dental-scheduling | 5 | HIGH (workspace) |
| dental-audit | 3 | LOW (internal) |
| external-records-import | 3 (async; poll `GET /dental/import-jobs/:id`) | LOW (background) |
| emr-consultation | 0 (router-defined; no contract endpoints listed) | MEDIUM |

Representative endpoints to load-test (sampled from contracts):
`GET /dental/patients` (search), `GET /dental/patients/:id/merge-preview`,
`GET /dental/perio-charts/`, `GET /dental/visits/pmd`,
`GET /dental/visits/{visitId}/pmd/export`, `GET /dental/pmd`,
`POST /dental/invoices/`, `PATCH /dental/invoices/:id/issue`,
`POST /dental/pmd/import`, `POST /dental/pmd/import-batch`.

### 2.3 k6 template — read SLA (search / workspace) [TEMPLATE]

```javascript
// Scenario: L2 — patient search under load
// Derived from: PERFORMANCE.md "Patient search response < 1 second"
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: {concurrent_users} },  // ramp up  (UNSPECIFIED — define)
    { duration: '5m', target: {concurrent_users} },  // sustained
    { duration: '1m', target: 0 },                    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],   // < 1s search SLA
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = '{base_url}';            // e.g. http://localhost:7213
const TOKEN = '{auth_token}';         // Better-Auth session/bearer

export default function () {
  const res = http.get(`${BASE}/dental/patients?q={search_term}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Cookie: '{session_cookie}' },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'search < 1s': (r) => r.timings.duration < 1000,
  });
  sleep(1);
}
```

### 2.4 k6 template — workspace aggregate (L1, < 2s) [TEMPLATE]

```javascript
// Scenario: L1 — patient workspace open under load
// Derived from: PERFORMANCE.md "Workspace load time < 2 seconds"
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: {concurrent_users} },
    { duration: '5m', target: {concurrent_users} },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // < 2s workspace SLA
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = '{base_url}';
const TOKEN = '{auth_token}';

export default function () {
  // Workspace = visits + treatments + chart + clinical. Tune to actual aggregate.
  const res = http.get(`${BASE}/dental/visits?patientId={patient_id}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Cookie: '{session_cookie}' },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'workspace < 2s': (r) => r.timings.duration < 2000,
  });
  sleep(1);
}
```

### 2.5 k6 template — volume / capacity (L5/L6) [TEMPLATE]

```javascript
// Scenario: L6 — list/paginate at 100k visits/branch
// Derived from: PERFORMANCE.md capacity target "Visits per branch: 100,000"
// PRE: seed 100k visits in the target branch before running.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  iterations: 50,        // sweep pages
  thresholds: { http_req_duration: ['p(95)<2000'] },
};

const BASE = '{base_url}';
const TOKEN = '{auth_token}';

export default function () {
  const page = Math.floor(Math.random() * 1000);
  const res = http.get(`${BASE}/dental/visits?page=${page}&pageSize=50`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { 'paginates without degradation': (r) => r.timings.duration < 2000 });
}
```

---

## 3. Per-Module Performance Budgets

No MODULE_SPEC S16 "Performance Requirements" sections were found; budgets below
inherit the global PERFORMANCE.md SLAs. Fill module-specific P95s when defined.

| Module | P95 Target | Concurrent Users | Data Volume | Caching | Priority |
|--------|:----------:|:----------------:|:-----------:|:-------:|:--------:|
| dental-patient | < 1s (search) | {UNSPECIFIED} | 10k patients/branch | {none?} | HIGH |
| dental-visit | < 2s (workspace) | {UNSPECIFIED} | 100k visits/branch | {none?} | HIGH |
| dental-clinical | < 2s (workspace) | {UNSPECIFIED} | — | {none?} | HIGH |
| dental-scheduling | < 2s | {UNSPECIFIED} | — | {none?} | HIGH |
| dental-imaging | {image upload UNSPECIFIED} | {UNSPECIFIED} | S3/MinIO | — | MEDIUM |
| dental-pmd | {PMD gen UNSPECIFIED} | {UNSPECIFIED} | — | — | MEDIUM |
| dental-billing | < 1s | {UNSPECIFIED} | — | — | MEDIUM |
| dental-perio | < 1s | {UNSPECIFIED} | — | — | MEDIUM |
| dental-org | < 1s | {UNSPECIFIED} | — | — | MEDIUM |
| emr-consultation | < 2s | {UNSPECIFIED} | — | — | MEDIUM |
| dental-audit | < 1s | {UNSPECIFIED} | — | — | LOW |
| external-records-import | async throughput {UNSPECIFIED} | n/a | pg-boss | — | LOW |

---

## 4. Security Test Plan (DAST)

### 4.1 Derived from THREAT_MODEL.md (STRIDE → DAST)

| Threat (ID) | Declared Mitigation | DAST Test | Priority |
|-------------|--------------------|-----------|:--------:|
| SQL injection (T-tamper) | Drizzle parameterized queries | Fuzz all input fields/query params with SQLi payloads; expect no 500 / no data leak | HIGH |
| Session token theft via XSS (S) | Better-Auth httpOnly cookies; React escaping | Inject `<script>` in all text inputs; verify stored output is encoded | HIGH |
| Auth bypass (S) | Better-Auth session validation | Send expired / tampered / missing tokens → expect 401 | HIGH |
| PHI in logs (T-001, **RESOLVED**) | Pino `redact` paths (logger.ts) + audit-logger emits safe identifiers only (no metadata/before/after snapshots to Pino) | Trigger requests with PII; grep logs for email/name/dob/clinical text — expect none. Covered by `logger.test.ts` + `audit-logger.test.ts`. | HIGH |
| Email verification bypass (T-002, **RESOLVED**) | `requireEmailVerification` env-gated — true in production by default (config.ts), false in dev/test; override via `AUTH_REQUIRE_EMAIL_VERIFICATION` | In a prod-like env, register then act before verifying → expect gating. Covered by `config.test.ts`. | HIGH |
| Associate accessing other dentist's patients (I, Partial) | "own patients" check in repo | As `dentist_associate`, request another associate's patient → expect 403 | HIGH |
| Unbounded list query flood (T-007, **OPEN P2**) | Pagination (verify all list handlers) | Request lists without/with huge `pageSize`; expect capped page size | MEDIUM |
| CORS misconfig (I) | Dynamic origin allowlist, credentials only for allowlisted | Send cross-origin with non-allowlisted Origin → expect no credentialed CORS | MEDIUM |
| PHI cached in browser (I) | `Cache-Control: no-store` on non-exempt routes | Inspect response headers on PHI routes → expect `no-store` | MEDIUM |
| Role string injection / comma exploit (E) | role never written from input | Attempt to set role via input → expect rejection | MEDIUM |
| PMD tamper after signing (T) | Digital signature + immutable record | Modify a signed PMD; verify signature/integrity check fails | MEDIUM |
| Brute-force login / PIN (S) | Better-Auth progressive lockout; 6-digit PIN lockout | Burst auth attempts → expect lockout / 429 | MEDIUM |
| Admin impersonation no break-glass (T-004, **OPEN P1**) | break-glass audit (unspecified) | Perform impersonation; verify audited reason once implemented | MEDIUM |

### 4.2 OWASP DAST checklist

| # | Category | Test Description | Tool Suggestion |
|---|----------|-----------------|-----------------|
| 1 | Injection | Fuzz all params with SQL/NoSQL/OS-command payloads | OWASP ZAP, sqlmap |
| 2 | Broken Auth | Token expiry, session fixation, credential stuffing | OWASP ZAP, Burp |
| 3 | Sensitive Data | TLS everywhere; response headers for PHI leakage | sslyze, OWASP ZAP |
| 4 | XXE | XML external-entity payloads (if XML accepted) | OWASP ZAP |
| 5 | Broken Access | Access other users'/roles' resources (see auth matrix §5) | Manual + ZAP |
| 6 | Security Misconfig | Default creds, dir listing, error-page info leak | Nikto, OWASP ZAP |
| 7 | XSS | Reflected/stored/DOM XSS in all inputs | OWASP ZAP, Burp |
| 8 | Insecure Deserialization | Crafted serialized objects (if applicable) | ysoserial |
| 9 | Known Vulns | Cross-ref dependency scan | `bun audit` / npm audit, Snyk |
| 10 | Insufficient Logging | Security events produce audit entries (audit module) | Manual |

---

## 5. Auth Matrix Tests (role × endpoint)

Derived from ROLE_PERMISSION_MATRIX.md. Context roles tested:
`dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`,
patient (no membership), platform `admin`, referring provider (API key).

Pattern [TEMPLATE]:

```
Scenario: {role} → {METHOD} {endpoint}
  Given: authenticated as {role} in branch {branch_id}
  When:  {METHOD} {endpoint}
  Then:  {ALLOWED → 2xx | DENIED → 403}
```

High-value cases (explicitly tightened per matrix 2026-05-30 note — must regress-guard):

| Role | Action / Endpoint | Expected |
|------|-------------------|:--------:|
| staff_full | Create invoice (`POST /dental/invoices/`) | **403 DENIED** (was allowed — drift closed) |
| hygienist | Create visit | **403 DENIED** (was allowed — drift closed) |
| hygienist | Create consent form | **403 DENIED** |
| dentist_associate | Patient list/search (`GET /dental/patients`) | 200 (clinic-wide read floor) |
| dental_assistant / front_desk / billing_staff / read_only | `GET /dental/patients` | 200 (read floor, branch-scoped) |
| dentist_associate | Another associate's patient record | 403 (own-patients scope) |
| staff_scheduling | Clinical Workspace | 403 (no access) |
| staff_scheduling | Scheduling endpoints | 200 (full) |
| dentist_associate | Reports / Staff & Roles / Settings | 403 |
| patient (no membership) | Any `/dental/*` clinical write | 403 |
| referring provider (API key) | Limited read only | 403 on non-allowlisted surfaces |

Generate the full role × endpoint cartesian (7 roles × 85 endpoints) as the
executable matrix; the table above is the priority subset.

---

## 6. Accessibility Test Config

No `accessibility-baseline.md` exists → target **inferred WCAG 2.1 AA** (per
CONFIRM flag in §1, backed by THREAT_MODEL.md compliance row).

### 6.1 axe-core config [TEMPLATE]

```javascript
// axe-core config — inferred WCAG 2.1 AA (no accessibility-baseline.md found)
module.exports = {
  rules: {
    // Level A (always)
    'image-alt': { enabled: true },
    'label': { enabled: true },
    'button-name': { enabled: true },
    'link-name': { enabled: true },
    'document-title': { enabled: true },
    'html-has-lang': { enabled: true },
    // Level AA (target)
    'color-contrast': { enabled: true },
    'meta-viewport': { enabled: true },
    // Level AAA (off — target is AA)
    'color-contrast-enhanced': { enabled: false },
  },
  pages: [
    // Derived from NAVIGATION_MAP.md / apps/dentalemon routes — fill URL patterns:
    // patient-workspace: {base_url}/patients/{id}
    // patient-search:    {base_url}/patients
    // scheduling:        {base_url}/schedule
    // imaging-workspace: {base_url}/patients/{id}/imaging
    // billing:           {base_url}/patients/{id}/billing
  ],
};
```

### 6.2 Accessibility manual checklist

| # | Check | Automated? | Tool |
|---|-------|:----------:|------|
| 1 | All images (radiographs/icons) have alt text | YES | axe-core |
| 2 | All form inputs have labels | YES | axe-core |
| 3 | Color contrast meets WCAG AA (incl. #FFE97D lemon accent on white) | YES | axe-core |
| 4 | Keyboard navigation for all interactive elements (chart grid, carousel) | PARTIAL | axe-core + manual |
| 5 | ARIA landmarks present on all pages | YES | axe-core |
| 6 | Focus management on route changes | MANUAL | manual |
| 7 | Screen reader announces dynamic content (workspace tabs, toasts) | MANUAL | VoiceOver/NVDA |
| 8 | No keyboard traps (modals, carousel) | PARTIAL | axe-core + manual |
| 9 | Touch targets ≥ 44×44px (PERFORMANCE.md UI SLA) | MANUAL | manual / DevTools |

---

## 7. Cross-Layer Contract Walker (FE↔BE) [TEMPLATE]

> **Mode: FULL.** `docs/audits/codebase-map/CODE_ROUTE_MAP.json` (v5) and
> `CODE_COMPONENT_REGISTRY.json` (v5) both present at version ≥ 4 → the full
> FE↔BE `api_call` contract walker applies (route-list-only Tier-3-lite is NOT
> needed here). 20 page-component routes enumerated in CODE_ROUTE_MAP.
>
> **This is a PLAN reference, not the executor.** The live, interaction-clicking
> implementation is `~/.claude/skills/oli-check/dimensions/runtime/templates/oli-runtime-loop.spec.ts.tmpl`,
> run by `/oli-check --runtime --live`. Do not diverge from that runner contract —
> generate the spec once into `apps/dentalemon`, commit it, regenerate only on a
> contract-version bump.

What the walker asserts for every GET route carrying a `page_component`:
- **(a) no console-error / pageerror / unhandledrejection / crash** (asset & analytics URLs ignored)
- **(b) skeleton ceiling** — page resolves past any loading/skeleton state within `skeletonCeilingMs` (5000ms default); infinite-skeleton = FAIL
- **(c) nav-link resolution** — every rendered `<a href>` / `[role=link]` resolves to a known route pattern; data-driven dead links = P1
- **(d) own 4xx-inclusive `page.on('response')`** — a `401`/`403` must FAIL the route (do NOT inherit an app fixture that only catches ≥500)
- **(e) no `/undefined` rendered** in URL/src attributes or link text (URL-undefined class)
- **(f) no raw UUID rendered** as a whole table-cell display value (UUID-render class)
- **(full mode) api_call contract** — every `api_call` the component declares in CODE_COMPONENT_REGISTRY must actually fire (network-intercepted) on mount/interaction

```ts
// apps/dentalemon/e2e/oli-runtime-loop.spec.ts  [TEMPLATE — generate via /oli-check --runtime --live]
// Reads CODE_ROUTE_MAP.json + CODE_COMPONENT_REGISTRY.json + oli-runtime.config.ts at run time.
// Auth: wrap the app's existing Playwright fixture (do NOT build a second login flow).
//   baseURL:        http://localhost:3001         (apps/dentalemon dev server)
//   apiBaseURL:     http://localhost:7213         (api-ts)
//   mapsDir:        docs/audits/codebase-map
//   skeletonCeilingMs: 5000
//   paramFixtures:  { ':patientId': '<seeded patient id>', ':branchId': '09f48304-...' }
//   denyList:       []   // routes intentionally excluded
// Param tokens ($id/:id) resolve from paramFixtures + dynamic ones the auth adapter returns.
// Route normalization: strip pathless layout segments (_workspace) and groups ((auth)).
```

**Config to tune per repo** (`apps/dentalemon/oli-runtime.config.ts`): `baseURL`,
`apiBaseURL`, `mapsDir`, `skeletonCeilingMs`, `testid` map, **data-surface bindings**
(opener → surface → expected network), `paramFixtures`, `denyList`. This is the only
file humans edit per repo.

---

## 8. What's Next

Pipeline: `/oli-plan-slices` → `/oli-check --traceability` → **YOU ARE HERE
(runtime plan)** → execution begins.

1. Execution phase uses this plan as the reference for which runtime tests to set up.
2. `/oli-check --confidence` (Layer 4 release-readiness) checks whether runtime
   test artifacts exist against this plan.
3. Team customizes every TEMPLATE: `{base_url}` (http://localhost:7213 for api-ts),
   `{auth_token}` / `{session_cookie}` (Better-Auth), payloads, and seed volumes.
4. **Resolve before full load testing** (currently `{UNSPECIFIED}`): concurrent-user
   target, image upload/processing time, PMD generation time, CRDT merge time,
   pg-boss throughput.
5. **Confirm or override** the inferred WCAG 2.1 AA a11y baseline (§1 CONFIRM flag).
6. Prioritize DAST on the remaining OPEN P1 threat T-004 (admin break-glass audit).
   T-001 (PHI in logs) and T-002 (email-verification bypass) are RESOLVED in code.
