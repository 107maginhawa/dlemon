# Contract Suite Coverage

This doc tracks what the Hurl contract suite (`*.hurl` here) covers and
what it deliberately leaves out, so future contributors don't waste
time wondering whether something is missing by accident.

## What the suite checks

Per-module happy paths, auth boundaries (401/403/404), the spec'd
pagination envelope, multi-user role gating, the auto-expand contract,
the standard error envelope, and a handful of high-value edge cases
per module (validation matrices, recurrence patterns, double-booking,
upsert semantics, oversize uploads).

22 scenarios, ~170 requests, ~5s end-to-end.

## What is intentionally deferred

These are real gaps. They aren't bugs in the suite — every one needs
something the contract layer can't easily provide today. If you're
adding an implementation, you don't have to satisfy these to be
contract-compliant; you just have to not break them when they land.

### Auth edge flows (verification, reset, OTP)

- `POST /auth/sign-up` queues a verification email. The current suite
  checks the queueing happens implicitly (sign-up returns 200) but
  doesn't follow the link or assert the email content.
- Password reset, email verification, and OTP all hand off to the
  email transport.

**Blocker**: needs an SMTP catcher (Mailpit) reachable from the test
runner with an HTTP API to read sent messages, then a Hurl request to
fetch the latest message and extract the link/code. Doable; not yet
wired up.

### Email module CRUD

- `email.hurl` only checks the auth gate (`403` for non-admin).
- Template create/update/list, queue list/cancel/retry, status filters,
  date-range filtering — none are exercised.

**Blocker**: every email management endpoint requires `admin` role.
The reference impl auto-promotes by `auth.adminEmails` config, so the
suite needs either (a) an admin email pre-seeded in env, or (b) a way
to mint an admin session in-test. Cleanest path: seed an admin email
in the deps Compose file and document `ADMIN_EMAIL` as a required
contract-test env var.

### Billing lifecycle

- `billing.hurl` only checks list-invoice auth gating and an empty
  paginated response.
- Merchant account creation/onboarding, invoice CRUD, finalize/void,
  pay/capture/refund — none are exercised.

**Blocker**: the impl talks to live Stripe (or stripe-mock). The TS
impl raises `'Stripe is not configured'` when `STRIPE_SECRET_KEY` is
empty. Path forward: stand up `stripe-mock` in `docker-compose.deps.yml`
and point `STRIPE_URL` at it; then Hurl scenarios for the full flow.

### Audit side effects

- `audit.hurl` checks the admin/non-admin role gate.
- The original e2e tests asserted that "creating a person generates an
  audit log entry" — i.e. that the side effect propagates through.

**Blocker**: same as email — only admins can read audit logs, so the
suite can't verify the entries exist without an admin session. Same
fix.

### CORS / preflight semantics

- `cors-auth.test.ts` (deleted in the e2e cleanup) was a 540-line
  matrix of accept/reject across origins, headers, and methods.

**Why deferred**: CORS allow-list policy is impl-specific; what the
contract guarantees is the *shape* of the response, not the policy.
The TS impl tests this in `src/utils/cors.test.ts`. Each new impl
should ship its own equivalent. We could add a *minimal* Hurl smoke
(one allowed origin, one rejected) — open to doing it if you want a
floor; we just don't want to be prescriptive about which origins are
allowed.

### WebSocket signalling

- `comms/websocket-signaling.test.ts` (deleted) covered the WebRTC
  signalling channel: SDP offer/answer relay, ICE candidates,
  per-room peer routing, message authentication.

**Blocker**: Hurl is HTTP-only. WS signalling needs a different test
runner. If you need this, the cleanest setup is a small dedicated
suite (probably TypeScript or Rust depending on impl) that targets
the same `$API_URL` from outside the impl process — same posture as
Hurl, just a different protocol.

### Schemathesis fuzz layer (today's failures)

`bun run test:contract:fuzz` runs Schemathesis against the OpenAPI
bundle. The current run reports ~30 failures, most of which are
"undocumented status code" (e.g. 422s the spec doesn't list) and a
handful of schema-compliant requests the impl rejects. These are real
spec/impl drift — fixable, but a separate workstream from the Hurl
suite.

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
