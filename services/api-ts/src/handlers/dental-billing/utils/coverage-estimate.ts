/**
 * P1-26 — Coverage estimate engine (pure, isomorphic, no DB).
 *
 * Computes the covered vs patient-portion split for a set of planned line items
 * given an active insurance profile and (optionally) an approved authorization.
 *
 * PH-shaped, deterministic, NO payer API:
 *   - Coverage is approval-driven. A line is covered up to the LESSER of its
 *     billed amount, its per-line approved amount (from the authorization's
 *     coveredProcedures / approvedAmountCents), and the remaining annual limit.
 *   - Procedures not present in an itemized authorization's coveredProcedures
 *     list are treated as uncovered → patient portion.
 *   - NO LEAT, NO UCR downgrade, NO PPO fee schedule.
 *
 * All money is integer centavos (₱). No float math; banker's rounding lives in
 * utils/rounding.ts and is unnecessary here (all inputs are already integers and
 * we only ever take mins/sums).
 */

export interface EstimateLineInput {
  /** CDT procedure code (coverage vocabulary). */
  cdtCode: string;
  /** Billed/listed fee for the line in centavos. */
  billedAmountCents: number;
  /** Optional human description (passed through to the per-line result). */
  description?: string;
}

export interface CoverageInput {
  /** Whether an active insurance profile exists. When false → fully patient-pay. */
  hasActiveProfile: boolean;
  /**
   * Itemized covered procedures from the authorization. When provided, ONLY the
   * listed CDT codes are covered (each up to its optional approvedAmountCents).
   * When undefined, fall back to the blanket `approvedAmountCents` cap.
   */
  coveredProcedures?: Array<{ cdtCode: string; approvedAmountCents?: number }> | null;
  /**
   * Blanket approved cap across the whole authorization (centavos). Applied when
   * there is no per-procedure cap. When undefined and no itemized list, lines are
   * covered up to billed (subject to annual limit).
   */
  approvedAmountCents?: number | null;
  /** Remaining annual benefit limit in centavos. When null/undefined → uncapped. */
  annualLimitRemainingCents?: number | null;
}

export interface EstimateLineResult {
  cdtCode: string;
  description?: string;
  billedAmountCents: number;
  coveredCents: number;
  patientPortionCents: number;
  /** True when the line received no coverage (excluded procedure or cash patient). */
  uncovered: boolean;
}

export interface CoverageEstimateResult {
  estimatedCoveredCents: number;
  estimatedPatientPortionCents: number;
  estimatedBilledCents: number;
  perLine: EstimateLineResult[];
  /** True when the annual limit clipped the total covered amount. */
  cappedByAnnualLimit: boolean;
  /** CDT codes that received zero coverage. */
  uncoveredProcedures: string[];
}

function clampNonNegative(n: number): number {
  return n > 0 ? Math.trunc(n) : 0;
}

/**
 * Compute the covered / patient-portion split for a set of planned lines.
 *
 * Lines are processed in order; the annual limit is consumed front-to-back so
 * the result is deterministic. Cash patients (no active profile) always get a
 * fully patient-pay estimate — the insurance flow never gets in their way.
 */
export function estimateCoverage(
  lines: EstimateLineInput[],
  coverage: CoverageInput,
): CoverageEstimateResult {
  const perLine: EstimateLineResult[] = [];
  let totalCovered = 0;
  let totalPatient = 0;
  let totalBilled = 0;
  let cappedByAnnualLimit = false;
  const uncoveredProcedures: string[] = [];

  const uncapped = coverage.annualLimitRemainingCents == null;
  let annualRemaining = uncapped
    ? Number.POSITIVE_INFINITY
    : clampNonNegative(coverage.annualLimitRemainingCents as number);

  // Index itemized covered procedures by CDT code (last wins on duplicates).
  const itemized = coverage.coveredProcedures && coverage.coveredProcedures.length > 0
    ? new Map(coverage.coveredProcedures.map((p) => [p.cdtCode, p]))
    : null;

  // A blanket approved cap is shared across all lines when there is no itemized
  // list. Consume it front-to-back, same as the annual limit.
  const hasBlanketCap = !itemized && coverage.approvedAmountCents != null;
  let blanketRemaining = hasBlanketCap
    ? clampNonNegative(coverage.approvedAmountCents as number)
    : Number.POSITIVE_INFINITY;

  for (const line of lines) {
    const billed = clampNonNegative(line.billedAmountCents);
    totalBilled += billed;

    // `capByPolicy` is what coverage WOULD allow ignoring the annual limit —
    // i.e. the per-procedure / blanket / billed cap. The annual limit then
    // clips this; if it binds (capByPolicy > annualRemaining) the result is
    // capped by the annual limit.
    let capByPolicy: number;
    if (!coverage.hasActiveProfile) {
      capByPolicy = 0; // cash patient — fully patient-pay
    } else if (itemized) {
      const match = itemized.get(line.cdtCode);
      if (!match) {
        capByPolicy = 0; // excluded procedure
      } else {
        capByPolicy = match.approvedAmountCents != null
          ? Math.min(billed, clampNonNegative(match.approvedAmountCents))
          : billed;
      }
    } else {
      capByPolicy = Math.min(billed, blanketRemaining);
    }

    const covered = clampNonNegative(Math.min(capByPolicy, annualRemaining));
    if (!uncapped && capByPolicy > annualRemaining) {
      cappedByAnnualLimit = true;
    }

    const patient = billed - covered;

    if (covered === 0 && billed > 0) {
      uncoveredProcedures.push(line.cdtCode);
    }

    perLine.push({
      cdtCode: line.cdtCode,
      description: line.description,
      billedAmountCents: billed,
      coveredCents: covered,
      patientPortionCents: patient,
      uncovered: covered === 0,
    });

    totalCovered += covered;
    totalPatient += patient;
    annualRemaining -= covered;
    if (hasBlanketCap) blanketRemaining -= covered;
  }

  return {
    estimatedCoveredCents: totalCovered,
    estimatedPatientPortionCents: totalPatient,
    estimatedBilledCents: totalBilled,
    perLine,
    cappedByAnnualLimit,
    uncoveredProcedures,
  };
}
