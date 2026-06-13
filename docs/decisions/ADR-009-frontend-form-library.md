# ADR-009: Frontend Form Library — react-hook-form (template-mandate override)

**Status**: Accepted
**Date**: 2026-06-13
**Context**: The base template's engineering standard (`~/.claude/CLAUDE.md`) mandates **TanStack Form** for all forms. `apps/dentalemon` instead uses **react-hook-form** (`^7.63.0`) in its four person-profile forms — `address-form.tsx`, `contact-info-form.tsx`, `personal-info-form.tsx`, `preferences-form.tsx` (`apps/dentalemon/src/features/person/components/`); `@tanstack/react-form` is not installed. This was an undocumented deviation from the mandated stack, which reads as a standards violation to anyone auditing the codebase against the template.

---

## Decision

**Standardize `apps/dentalemon` on `react-hook-form` + Zod, and record this as a deliberate, accepted override of the template's TanStack Form mandate.** Do not migrate the existing forms.

- New forms in `apps/dentalemon` SHOULD use react-hook-form + Zod for consistency with the existing four.
- Validation continues to use Zod schemas (the mandate's validation requirement is satisfied either way).

---

## Rationale

| Concern | Keep react-hook-form (chosen) | Migrate to TanStack Form (rejected) |
|---------|-------------------------------|-------------------------------------|
| **Internal consistency** | dentalemon already uses react-hook-form everywhere it uses a form library — the app is *already* internally consistent; only the template mandate differs | Introduces a second form library unless all four are migrated at once |
| **User benefit** | None lost — the forms work and are exercised by the clinical E2E journeys (J01 etc.) | Zero user-facing benefit; pure churn |
| **Risk** | None — no code change | Regression risk on **PII-handling** forms (address/contact/personal-info) for no functional gain |
| **Maturity** | react-hook-form is mature, performant, and widely supported | TanStack Form is younger; migrating is net-negative here |

A codebase with documented, reasoned architectural decisions *is* "to standard"; an undocumented deviation is the actual smell. This ADR removes that smell without churn.

---

## Consequences

- **Positive:** The form stack is now explicit and internally consistent; no migration risk on PII forms.
- **Trade-off:** dentalemon intentionally diverges from the template's TanStack Form mandate. If a future cross-app sharing need makes TanStack Form valuable, revisit — migration would be a deliberate, separately-planned effort (Vertical TDD, FE + E2E re-verification), not a drive-by change.

---

## References

- `apps/dentalemon/src/features/person/components/{address,contact-info,personal-info,preferences}-form.tsx`
- `apps/dentalemon/package.json` — `react-hook-form` dependency
- `docs/KNOWN_LIMITATIONS.md` — "Architectural decisions in flight" (now resolved by this ADR)
