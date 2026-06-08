# Module Audit Tracker — 2026-06-08

Per-module deep audit + safe-gap closure. Product-first clinical vertical sequence
(15 audit rounds; bounded-context modules fold into their parent). One commit per module.

**Sequence:**
dental-org → dental-patient → dental-scheduling → dental-visit → dental-clinical → dental-perio →
dental-imaging → dental-pmd → dental-billing → dental-audit → erasure/legal-hold/retention →
dental-portal → emr-consultation → provider → external-records-import

| # | Module | Verdict | Gaps closed | Deferred | Report |
|---|--------|---------|-------------|----------|--------|
| 1 | dental-org | ✅ READY | 5 (1 test gap, 3 doc drift, 1 registry drift) | BR-016c → imaging round | [MODULE_dental-org_AUDIT_2026-06-08.md](modules/MODULE_dental-org_AUDIT_2026-06-08.md) |
| 2 | dental-patient | ⏳ pending | — | — | — |
| 3 | dental-scheduling | ⏳ pending | — | — | — |
| 4 | dental-visit | ⏳ pending | — | — | — |
| 5 | dental-clinical | ⏳ pending | — | — | — |
| 6 | dental-perio | ⏳ pending | — | — | — |
| 7 | dental-imaging | ⏳ pending | — | — | — |
| 8 | dental-pmd | ⏳ pending | — | — | — |
| 9 | dental-billing | ⏳ pending | — | — | — |
| 10 | dental-audit | ⏳ pending | — | — | — |
| 11 | erasure/legal-hold/retention | ⏳ pending | — | — | — |
| 12 | dental-portal | ⏳ pending | — | — | — |
| 13 | emr-consultation | ⏳ pending | — | — | — |
| 14 | provider | ⏳ pending | — | — | — |
| 15 | external-records-import | ⏳ pending | — | — | — |

## Cross-module carry-forward

- **BR-016c (imagingTier gate)** — declared in dental-org §5 but enforced/tested in dental-imaging.
  Register in the **dental-imaging** round (correct module attribution).
- **AC-ORG-002** fee-schedule → new-invoice default: dental-org proves the per-branch override;
  the invoice-time price snapshot is billing-side — verify in the **dental-billing** round.
