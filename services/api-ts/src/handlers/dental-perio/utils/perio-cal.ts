/**
 * perio-cal.ts — Clinical Attachment Level (CAL) computation (P1-5).
 *
 * CAL is the truest measure of attachment loss because it is referenced to the
 * fixed CEJ rather than the (mobile) gingival margin. It is computed per-site
 * from the probing depth (PD) and the gingival-margin position relative to the
 * CEJ, and is exposed read-only — never stored, always derived from the two
 * captured inputs so it can never drift from them.
 *
 * Sign convention for `gingivalMargin` (mm, relative to CEJ):
 *   - 0       → gingival margin is AT the CEJ      → CAL = PD
 *   - positive → margin is APICAL to CEJ (recession) → CAL = PD + GM
 *   - negative → margin is CORONAL to CEJ (overgrowth/edema) → CAL = PD − |GM| = PD + GM
 *
 * All three 2017-AAP/EFP cases collapse to the single linear formula
 *   CAL = PD + GM
 * which is exactly the recession-aware definition in the research doc
 * (docs/reviews/research/perio.md §"Clinical Attachment Level"):
 *   at-CEJ:            CAL = PD
 *   recession:         CAL = PD + (CEJ→GM distance)
 *   coronal-to-CEJ:    CAL = PD − (CEJ→GM distance)
 *
 * CAL is clamped at 0 (attachment level cannot be negative); a coronal margin
 * deeper than the pocket simply means no attachment loss at that site.
 */

/** The six probing sites per tooth, in buccal-then-lingual order. */
export const PERIO_SITES = ['BM', 'BC', 'BD', 'LM', 'LC', 'LD'] as const;
export type PerioSite = (typeof PERIO_SITES)[number];

/**
 * Compute CAL for a single site. Returns null when the inputs are insufficient
 * (either probing depth or gingival margin is missing) — a partially-charted
 * site has no defined attachment level.
 */
export function computeSiteCal(
  probingDepth: number | null | undefined,
  gingivalMargin: number | null | undefined,
): number | null {
  if (probingDepth === null || probingDepth === undefined) return null;
  if (gingivalMargin === null || gingivalMargin === undefined) return null;
  const cal = probingDepth + gingivalMargin;
  return cal < 0 ? 0 : cal;
}

/** Per-site CAL output keyed by site code (e.g. `calBM`). */
export type SiteCalMap = {
  calBM: number | null;
  calBC: number | null;
  calBD: number | null;
  calLM: number | null;
  calLC: number | null;
  calLD: number | null;
};

interface ReadingDepthsAndMargins {
  depthBM?: number | null;
  depthBC?: number | null;
  depthBD?: number | null;
  depthLM?: number | null;
  depthLC?: number | null;
  depthLD?: number | null;
  gmBM?: number | null;
  gmBC?: number | null;
  gmBD?: number | null;
  gmLM?: number | null;
  gmLC?: number | null;
  gmLD?: number | null;
}

/** Compute the six per-site CAL values for a tooth reading (read-only). */
export function computeReadingCal(reading: ReadingDepthsAndMargins): SiteCalMap {
  return {
    calBM: computeSiteCal(reading.depthBM, reading.gmBM),
    calBC: computeSiteCal(reading.depthBC, reading.gmBC),
    calBD: computeSiteCal(reading.depthBD, reading.gmBD),
    calLM: computeSiteCal(reading.depthLM, reading.gmLM),
    calLC: computeSiteCal(reading.depthLC, reading.gmLC),
    calLD: computeSiteCal(reading.depthLD, reading.gmLD),
  };
}

/** The maximum (worst) computed CAL across all six sites, or null if none. */
export function maxReadingCal(reading: ReadingDepthsAndMargins): number | null {
  const cal = computeReadingCal(reading);
  const values = Object.values(cal).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.max(...values);
}
