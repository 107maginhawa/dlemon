/**
 * Receipt-series helper — the OR (BIR Official Receipt) number suggestion.
 *
 * RECORDER model (not issuer): the clinic uses its own BIR-registered booklet, so
 * we never invent a scheme — we suggest the NEXT number by incrementing whatever
 * they last used, preserving their exact prefix and zero-pad width. The suggestion
 * is always editable per-payment, and the seed lives in branch settings
 * (`receiptNumberNext`) where the dentist re-syncs it to the physical booklet.
 *
 * ponytail: drift ceiling — auto-advance can diverge from the paper booklet if a
 * receipt is voided/skipped; the Settings field is the re-sync knob. A continuous
 * BIR-accredited CAS series (Permit to Use, per-tenant unique index) is a separate,
 * larger effort and intentionally not built here.
 */

/**
 * Increment the trailing digit run of a receipt number in place.
 *   "OR-000042" → "OR-000043", "0009" → "0010", "2026-00001" → "2026-00002".
 * Returns null when there is no trailing number to advance (a fully custom code).
 */
export function incrementReceiptNumber(value: string): string | null {
  const m = value.match(/^(.*?)(\d+)(\D*)$/s);
  if (!m) return null;
  const prefix = m[1] ?? '';
  const digits = m[2] as string; // guaranteed by (\d+)
  const suffix = m[3] ?? '';
  // padStart keeps the width (0009→0010); String() lets it grow on overflow (099→100).
  const next = String(parseInt(digits, 10) + 1).padStart(digits.length, '0');
  return `${prefix}${next}${suffix}`;
}
