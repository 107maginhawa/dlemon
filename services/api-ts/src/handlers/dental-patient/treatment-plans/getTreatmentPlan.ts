/**
 * Codegen-required re-export shim — DO NOT replace with a facade or delete.
 *
 * The generated route registry (src/generated/openapi/registry.ts) resolves each
 * operationId to a handler file by BASENAME within the operation tag's module
 * directory. This operation is tagged to this module but its logic is owned by the
 * sibling handler re-exported below; the route namespace differs from the owner's.
 * A `*.facade.ts` would not match the operationId basename, so removing this shim
 * makes regen fall back to a missing import and breaks server boot. `bun run
 * check:boundaries` is green — this is intentional, not a layering violation.
 */
export { getTreatmentPlan } from '../../dental-visit/treatment-plans/getTreatmentPlan';
