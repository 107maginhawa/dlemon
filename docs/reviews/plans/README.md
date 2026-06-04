# L-Feature Design Plans

> Design plans (no code) for the 9 large backlog features that were too big to auto-build safely. Each is grounded in the actual codebase + the module scorecards in `../modules/` and research in `../research/`. Produced 2026-06-02 alongside the auto-fix execution (which shipped 23 smaller items on `fix/standards-review-batch`).

These are implementation-ready blueprints — pick one, run it through `/plan-eng-review`, then execute via Vertical TDD.

| # | Plan | Backlog | Effort | Biggest risk |
|---|------|---------|--------|--------------|
| 01 | [Perio charting frontend](01-perio-frontend.md) | P0-1 | M (MVP needs no backend — hooks/shapes exist) | keyboard auto-advance ergonomics for ~500 inputs |
| 02 | [AI/auto ceph landmarking](02-ceph-auto-landmarking.md) | P1-10 | L | PHI exfiltration to external detector → self-host + BAA gate |
| 03 | [Ceph superimposition over time](03-ceph-superimposition.md) | P1-11 | L | v1 two-point align must not be mislabeled ABO-grade |
| 04 | [Patient case-presentation + e-sign](04-case-presentation.md) | P1-20 | L | shareable-link patient auth (no patient login exists) |
| 05 | [Reminders + recall engine](05-reminders-recall.md) | P1-24 | L | spam/consent compliance (TCPA/HIPAA) — fail-closed consent gate |
| 06 | [Online/self-service booking](06-online-booking.md) | P1-25 | L | slot race conditions → DB exclusion constraint |
| 07 | [Insurance revenue cycle (PH)](07-insurance-revenue-cycle.md) | P1-26 | L | PH HMO payer fragmentation → generic jsonb-extensible schema |
| 08 | [CBCT / 3-D imaging](08-cbct-3d-imaging.md) | P2-7 | L | payload size/cost (GB-scale volumes) + GPU rendering |
| 09 | [Voice perio charting](09-voice-perio.md) | P2-4 | L | digit-recognition accuracy in a noisy operatory |

## Recommended order
1. **01 Perio frontend** — highest value, lowest cost (MVP is pure FE on an existing tested backend; unstrands a whole module).
2. **04 Case-presentation** — composes the already-shipped alternates + appointment-links + status lifecycle; drives case acceptance.
3. **05 Reminders/recall** + **06 Online booking** — patient-engagement pair; reuse existing notifs + scheduling infra.
4. **03 Superimposition** + **02 Auto-landmarking** — imaging depth (instances of the carousel "compare over time" pattern).
5. **07 Insurance (PH)**, **09 Voice perio** (depends on 01), **08 CBCT** — larger/peripheral.

## Dependencies
- 09 (voice) depends on 01 (perio FE).
- 02/03 (imaging AI/superimposition) benefit from 09 of the auto-fixes (DICOM ingest is its own item, P1-9).
- 04/05/06 lean on already-shipped P1-19/P1-21/P2-8 (alternates, appointment links, status states) and P1-28 (per-channel consent).
