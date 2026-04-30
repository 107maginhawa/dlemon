# Contract Suite Coverage

This doc tracks what the Hurl contract suite (`*.hurl` here) covers and
what it deliberately leaves out, so future contributors don't waste
time wondering whether something is missing by accident.

## What the suite checks

Per-module happy paths, auth boundaries (401/403/404), the spec'd
pagination envelope, multi-user role gating, the auto-expand contract,
the standard error envelope, and a handful of high-value edge cases
per module (validation matrices, recurrence patterns, double-booking,
upsert semantics, oversize uploads). Plus, since the deferred-items
plan landed:

- **Auth email round-trips**: `auth-verification.hurl` follows the
  verification-link flow (sign-up → poll Mailpit → extract URL →
  follow). `auth-password-reset.hurl` does the equivalent for password
  resets, ending with sign-in using the new password.
- **Email module CRUD**: `email.hurl` exercises the admin-only
  template list/get/create/patch and queue list/filter using a session
  captured from the runner's admin preflight.
- **Audit side effects**: `audit-side-effects.hurl` asserts that
  creating + updating a person produces audit log entries that an
  admin can read back, including action filtering.
- **Billing lifecycle**: `billing-lifecycle.hurl` runs the full
  merchant-account / invoice flow against `stripe-mock` —
  create-merchant → create-invoice → finalize → mark-uncollectible —
  plus the provider-not-onboarded boundary on pay (422).
- **CORS smoke**: `cors.hurl` proves the impl honours an allow-list
  (allowed origin echoed, rejected origin not echoed). Deeper CORS
  matrices stay an impl-internal unit-test concern.

27 scenarios, ~220 requests, ~7s end-to-end against the api-ts impl.

## Test infra used by the suite

Both supplied by `services/api-ts/docker-compose.deps.yml`:

- **Mailpit** (`localhost:8025`) — SMTP catcher with HTTP read API.
  Auth-email scenarios poll `/api/v1/search?query=to:<email>` then
  fetch `/api/v1/message/<id>` to extract verification / reset links.
- **stripe-mock** (`localhost:12111`) — billing scenarios point the
  api-ts impl at this via `STRIPE_URL` (stripe-mock requires a key
  matching `sk_test_<alphanum>`).

The runner (`scripts/run-contract-tests.ts`) does an idempotent admin
preflight (sign-up-or-sign-in for `admin@contract-tests.local`) before
discovering Hurl files, so `{{admin_token}}`, `{{admin_email}}`, and
`{{admin_password}}` are always available.

The api-ts email worker normally polls every 60s; the contract suite
needs sub-minute granularity. `services/api-ts/src/core/jobs.ts` falls
back to a `setInterval` loop for sub-minute intervals so
`EMAIL_PROCESSOR_INTERVAL_MS=2000` actually delivers in 2s.

## What is intentionally deferred

These are real gaps. The contract suite leaves them open on purpose;
each one needs a structurally different test runner or a dependency
that's out of scope for blackbox HTTP testing.

### WebSocket signalling

- The deleted `comms/websocket-signaling.test.ts` covered the WebRTC
  signalling channel: SDP offer/answer relay, ICE candidates,
  per-room peer routing, message authentication.

**Why deferred**: Hurl is HTTP-only. WS is stateful and connection-
scoped — it doesn't fit the wire-contract layer the same way HTTP
does. Each impl ships its own integration tests for WS. The wire
protocol is documented inline in
`services/api-ts/src/handlers/comms/` (TypeSpec doesn't model WS).

If a future Rust/Go impl needs cross-impl WS conformance, the
recommended path is a small dedicated `specs/api/tests/ws/` runner
using the `ws` npm package targeting the same `$API_URL`.

### Schemathesis spec/impl drift

`bun run test:contract:fuzz` runs Schemathesis against the OpenAPI
bundle. The current run reports ~30 failures, mostly:

- **Undocumented status codes** (e.g. 422s the spec doesn't list).
- **Schema-compliant requests rejected by the impl** (a handful).

**Why deferred**: every fix is a case-by-case judgement call (spec
change vs impl change). Tracked as a separate workstream — fixing it
shouldn't block test-suite extensions.

### 2FA / OTP scenarios

Better-Auth supports OTP via the `emailOTP` plugin, but the baseline
impl doesn't enable it. If 2FA gets turned on, add `auth-otp.hurl` to
exercise the OTP send/verify round-trip (same Mailpit pattern as
`auth-verification.hurl`).

### Stripe webhook signature verification

`POST /billing/webhooks/stripe` validates Stripe-Signature against the
configured webhook secret. The contract suite doesn't exercise this
because crafting a valid signature requires the secret on the test
side, which couples the runner tightly to stripe-mock internals.

If you need this, the cleanest path is a unit test inside each impl
that signs a known fixture and asserts the impl accepts/rejects it
correctly.

### Full Stripe payment flow (pay → capture → refund)

`billing-lifecycle.hurl` stops at the "pay" boundary (422) because
stripe-mock doesn't simulate the Connect onboarding webhook flow,
so the merchant account stays in `pending` status. To exercise the
rest of the flow you'd either:

1. Inject a mock webhook into the impl to mark the merchant onboarded.
2. Add a test-only admin endpoint that toggles
   `metadata.onboardingComplete = true`.
3. Use stripe-mock's fixture endpoints to simulate state.

None are clean. Tracked but not implemented.

## Adding new scenarios

Rule of thumb:

- **Happy path + one or two edge cases per module** belongs here.
- **Validation library behavior** (does Zod reject this UUID format?
  does the date parser accept this format?) does **not** — push that
  into the impl's unit tests.
- **Implementation details** (does the repository emit this log line?
  does the queue retry on this error?) do **not** belong here either.

The smell test: if a Rust or Go reimpl could reasonably ship without
matching the assertion, the assertion is impl-specific and shouldn't
be in the contract suite.
