/**
 * fee-resolution.ts — canonical CDT price resolution (dental-org G2, decision §5).
 *
 * The fee schedule is the single source of truth for procedure pricing:
 *   1. a per-branch override (`dental_branch.settings.feeSchedule[cdt]`) wins;
 *   2. otherwise the global catalog default (`dental_procedure_code.default_fee_php`);
 *   3. otherwise 0.
 *
 * Both the read endpoint (`getFeeSchedule`) and the treatment-pricing default
 * (`createDentalTreatment`) resolve prices through this one function so the
 * configured fee schedule actually drives pricing (closes AC-ORG-002).
 */

export type FeeOverrides = Record<string, number> | null | undefined;

/**
 * Resolve the effective price (in minor units / centavos) for a CDT code.
 *
 * @param overrides         per-branch overrides keyed by CDT code (may be null)
 * @param cdtCode           the procedure code to price
 * @param catalogDefaultCents global catalog default (may be null/undefined)
 */
export function resolveFeeCents(
  overrides: FeeOverrides,
  cdtCode: string,
  catalogDefaultCents: number | null | undefined,
): number {
  const override = overrides?.[cdtCode];
  if (typeof override === 'number') return override;
  return catalogDefaultCents ?? 0;
}
