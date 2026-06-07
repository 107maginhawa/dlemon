# Webwright-crafted smoke tools

These are **environment-agnostic** smoke tests that drive a **fresh headless
Firefox** against any already-running dentalemon deployment and report a
pass/fail per critical point with screenshots. Unlike the in-suite Playwright TS
specs (which boot their own servers), they target a deployment you already have
running — useful for smoking local, staging, or prod. Each was authored with
Microsoft Webwright (`/webwright:craft`).

| script | flow | critical points |
|--------|------|-----------------|
| `golden_path_smoke.py` | login → dashboard → patients → profile → tooth chart → calendar → billing → revenue report | 9 |
| `patient_registration_smoke.py` | new-patient modal → submit → list → **full-name search** | 4 |
| `revenue_chain_smoke.py` | /billing → payable invoice → record **cash payment** → balance drop | 5 |
| `staff_lifecycle_smoke.py` | /staff (owner) → add member → list → **deactivate** | 3 |

Each exits 0 iff all its critical points pass; screenshots + a step log land in
`--out`. All flags default to the local demo stack — run `python <script>.py
--help` for the full parameter list.

`golden_path_smoke.py` was crafted during the 2026-06-07 fix-verification pass
and verifies, among its 9 points: **CP6** calendar concurrent appointments
render side-by-side (column fix) and **CP9** zero browser-console 404 on the
patient profile (household 204 fix).

The other three were crafted during the 2026-06-07 Webwright comprehensive sweep
and each doubles as a **regression guard** for a real bug found+fixed in that
sweep:
- `patient_registration_smoke.py` — **CP4** full-name patient search (the search
  now matches `firstName || ' ' || lastName`, so "Maria Santos" returns Maria
  Santos instead of nothing).
- `revenue_chain_smoke.py` — **CP3/CP4** recording a payment now succeeds
  (the InvoiceDetail UI sends the active `recordedByMemberId` instead of an
  empty string that the backend rejected with 400 "Invalid UUID").

## Run

Requires Python ≥3.10 with Playwright + Firefox:

```bash
python -m venv .venv && source .venv/bin/activate
pip install playwright && playwright install firefox

# against the local demo stack (defaults):
python golden_path_smoke.py            --out ./gp_run
python patient_registration_smoke.py   --out ./pr_run
python revenue_chain_smoke.py          --out ./rc_run
python staff_lifecycle_smoke.py        --out ./staff_run

# against any environment (golden path shown; same flags apply to the others):
python golden_path_smoke.py \
  --base-url https://staging.example.com \
  --email qa@example.com --password '***' --pin 123456 \
  --profile 'Dr. Maria Reyes' --out ./gp_run

# re-run with different inputs to prove parameterization, e.g.:
python patient_registration_smoke.py --first-name Juan --last-name Cruz
python revenue_chain_smoke.py        --amount 2.50 --method Card
python staff_lifecycle_smoke.py      --role "Associate Dentist" --staff-pin 135790
```

The patient-registration, revenue-chain, and staff-lifecycle smokes are
**self-cleaning / re-runnable**: each creates run-unique data (timestamped
names / receipts) and the staff smoke deactivates the member it creates, so
repeated runs do not accumulate noise.

## Not a CI gate (by design)

These scripts are intentionally **not** wired into CI. The behaviours they
exercise are already gated by in-suite tests that boot their own stack and run on
every PR: the golden path by the Playwright TS specs
(`tests/e2e/cold-start-full-loop.spec.ts`, `tests/e2e/calendar-overlap.spec.ts`),
the two bugs the new smokes guard by backend/FE unit tests
(`dental-patient.test.ts` full-name search; `invoice-detail.mutations.test.ts`
`recordedByMemberId`). Adding a parallel Python+Firefox CI job would require
standing up the full stack again for zero additional coverage. Their real value
is **ad-hoc smoke against an already-deployed environment** (local/staging/prod),
where the TS specs' self-boot model does not apply — so they live here as ops
tools, run on demand.

## Verified flows not committed as scripts

The 2026-06-07 sweep also drove two more flows with Webwright `run` mode
(verified once against the demo stack, not committed as no-args tools because
they depend on per-patient seed state rather than being cleanly re-runnable):
**perio exam entry** (start → enter probing depths across 32 teeth → complete →
read-only, 3/3) and **ceph landmarks** (open the seeded cephalogram → landmark
overlay + Steiner measurements render → zero unhandled errors, 4/4 —
re-confirming the `normalizeThrown` fix from PR #3 in-browser).
