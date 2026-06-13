# Research Artifacts

> **Exploratory, not authoritative.** These documents capture analysis,
> standards comparisons, compliance research, and external reference material
> gathered while designing the healthcare API in `specs/api/`. They reflect
> the state of investigation at a point in time and may have been superseded
> by spec changes since then. Treat them as historical context, not as
> binding requirements or contracts.

For the canonical API contract, see `specs/api/dist/openapi/openapi.json` and
the TypeSpec sources under `specs/api/src/`.

## Files

### Healthcare standards & compliance

- [`healthcare-standards-audit.md`](./healthcare-standards-audit.md) — survey of FHIR R4, HL7 v2, IHE profiles, and other healthcare standards relevant to the API.
- [`healthcare-compliance-frameworks.md`](./healthcare-compliance-frameworks.md) — HIPAA, GDPR, EHDS, 21st Century Cures, and other regulatory frameworks under consideration.
- [`standards-audit-index.md`](./standards-audit-index.md) — index/navigation for the standards audit body of work.
- [`standards-checklist.md`](./standards-checklist.md) — implementation checklist tracking which standards the spec covers vs. defers.
- [`standards-code-examples.md`](./standards-code-examples.md) — sample code/spec patterns referenced during the standards audit.
- [`research-findings-summary.md`](./research-findings-summary.md) — executive summary of the standards research stream.

### Specific gap analyses

- [`ospitalis-gap-analysis.md`](./ospitalis-gap-analysis.md) — gap analysis between the spec and the Ospitalis hospital-information-system reference model.

### External reference material

- [`external-references/references/`](./external-references/references/) — third-party PRDs and API specifications (e.g. dental management, association management, Ospitalis hub, Azure PG migration notes) consulted while designing the spec.

## Workflow

When research informs a spec change, summarize the decision in the relevant
TypeSpec module's `.md` companion file under `specs/api/src/modules/` — that
companion is the canonical place for design rationale that travels with the
spec. Use this `docs/research/` folder for the long-form material that
underpins those summaries.
