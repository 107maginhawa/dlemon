# Golden-path smoke test (Webwright-crafted)

`golden_path_smoke.py` is an **environment-agnostic** smoke test for the
dentalemon golden path (login → dashboard → patients → profile → tooth chart →
calendar → billing → revenue report). Unlike the in-suite Playwright TS specs
(which boot their own servers), this one drives a **fresh headless Firefox**
against any already-running deployment and reports a pass/fail per critical
point with screenshots — useful for smoke-testing local, staging, or prod.

It was crafted by Microsoft Webwright (`/webwright:craft`) during the
2026-06-07 fix-verification pass and verifies, among 9 critical points:
- **CP6** — calendar concurrent appointments render side-by-side (column fix)
- **CP9** — zero browser-console 404 on the patient profile (household 204 fix)

## Run

Requires Python ≥3.10 with Playwright + Firefox:

```bash
python -m venv .venv && source .venv/bin/activate
pip install playwright && playwright install firefox

# against the local demo stack (defaults):
python golden_path_smoke.py --out ./gp_run

# against any environment:
python golden_path_smoke.py \
  --base-url https://staging.example.com \
  --email qa@example.com --password '***' --pin 123456 \
  --profile 'Dr. Maria Reyes' --out ./gp_run
```

Exit code 0 iff all 9 critical points pass. Screenshots + step log land in `--out`.

## Not a CI gate (by design)

This script is intentionally **not** wired into CI. The golden path it exercises
is already gated by the in-suite Playwright TS specs (`tests/e2e/cold-start-full-loop.spec.ts`
and `tests/e2e/calendar-overlap.spec.ts`), which boot their own stack and run on
every PR. Adding a parallel Python+Firefox CI job would require standing up the
full stack again for zero additional coverage. Its real value is **ad-hoc smoke
against an already-deployed environment** (local/staging/prod), where the TS specs'
self-boot model does not apply — so it lives here as an ops tool, run on demand.
