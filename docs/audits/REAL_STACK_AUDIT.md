# Real-Stack Audit — Phase 0 (Stop the Drift)

> Recorded 2026-06-14. Drove the **real** assembled app (current `main` code + FE + API +
> from-zero-migrated DB + clean seed + MinIO) through the critical user flows in a real browser.
> Method: gstack `/browse`. This is the ground-truth inventory that gates Plans A–F.

## Verdict: `main` is HEALTHY

Every critical flow works against a **consistent** stack. The "can't add New Visit" reported in
the live app was **environmental drift** (an 8-day-stale API process + a dev DB 4 migrations
behind), **not a code defect on `main`**. When the stack is consistent, New Visit and the rest
work end-to-end.

## Setup (this becomes the smoke's canonical setup)
- `monobase` dropped + migrated from zero → **108/108 migrations** (incl. RLS 0104–0107); `patient` RLS armed; `app_rls` granted.
- Reseeded clean: `seed-demo.ts` + `seed-supplement.ts` → **both exit 0, ZERO RLS/permission errors** (20 patients, visits, invoices, payments, appointments, imaging, perio, treatment plans, Rx, consents — all created through the RLS-activated handlers via HTTP).
- API (current code) :7213 `/livez` ok `/readyz` ok; FE :3003 200; MinIO :9000 healthy.

## Flow inventory

| Flow | Result | Evidence |
|---|---|---|
| Login (email + password) | ✅ OK | demo@dentalemon.com → pin-select |
| PIN auth | ✅ OK | Dr. Maria Reyes, PIN 123456 → /dashboard |
| Patients list + search | ✅ OK | 20 patients; search "Lorenzo" filters live |
| Patient workspace + odontogram | ✅ OK | chart renders seeded conditions; allergy badge; Baseline/Proposed/Completed layers |
| **New Visit (create)** | ✅ **OK** | `POST /dental/visits → 201` (61ms) + cascade of 200s; UI flips to open-visit state. Runs through RLS-activated `createDentalVisit` (withTenantTx → app_rls). |
| New Visit gating | ✅ OK (correct) | Disabled when an open visit exists ("finish or discard the open visit") — working as designed |
| Billing | ✅ OK | /billing renders: Outstanding ₱207,250 / Collected ₱71,450 / Overdue ₱18,700; 16 invoices, all statuses |
| Calendar | ✅ OK | /calendar renders; `GET /dental/appointments` → 200 |
| Write-heavy handlers (invoices, payments, appointments, perio, imaging, treatment plans, Rx, consents) | ✅ OK | exercised end-to-end by the clean seed through the activated handlers, 0 errors |

## Findings (non-blocking, candidates for later plans)

1. **Hard-reload / deep-link loses PIN auth → bounces to `/auth/pin-select`.** PIN/active-member
   state is client-side (not cookie-backed), so a full page load on `/{patientId}` re-prompts.
   SPA navigation is unaffected. May be intentional (re-PIN on reload) but breaks bookmarks,
   refresh, and notification deep-links. **Confirm intent; fix if not.**
2. **Console noise (benign but real):** the `runtime-config` endpoint returns HTML, not JSON →
   `Unexpected token '<'` then fallback config; OneSignal "AppID doesn't match" (demo creds).
   Should serve runtime-config as JSON (or 404-as-JSON) so the console is clean.
3. **Discard-visit** requires a ≥5-char reason via a popover; the validation toast fires
   correctly, but the reason field was not trivially discoverable in the accessibility tree
   (minor UX + testability note — matters when we hard-assert this flow).

## Implication for the plan

The base is healthy → the work is **not** "repair `main`." It is to **install the gate +
dev-doctor** so that (a) a stale dev stack can't masquerade as a code failure again, and (b) a
future real regression in these flows fails CI loudly. The critical-path set proven this run
becomes the blocking smoke's coverage:

> login → PIN → patients/search → workspace/chart → **New Visit (201)** → billing → calendar,
> plus the seed exercising the write-heavy handlers.

**Plan A (fix red) is effectively empty** — there are no broken critical flows on `main`. The
two real items (deep-link re-auth, runtime-config JSON) are minor and can fold into Plan F or a
small cleanup. The effort shifts straight to **Plan B (hard-assert + de-flake the journeys)** and
**Plan C (arm the blocking gate)** — the anti-drift lock — plus **Plan E (dev-doctor)** which
would have caught the stale-box drift the user hit.
