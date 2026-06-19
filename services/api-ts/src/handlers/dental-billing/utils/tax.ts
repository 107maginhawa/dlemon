/**
 * Invoice tax computation (BR-054).
 *
 * Pure, side-effect-free. Tax is derived from the branch tax mode, NEVER from
 * the caller (EM-BILL-001: a client-supplied rate is privilege escalation).
 *
 * PH model:
 *   - non_vat (default): no tax. total = subtotal.
 *   - vat_registered: VAT is carved OUT of the gross subtotal (PH prices are
 *     VAT-INCLUSIVE), so total stays = subtotal and the VAT portion is reported
 *     separately. VAT = subtotal * rate / (100 + rate).
 */

export type TaxMode = 'non_vat' | 'vat_registered';

export const DEFAULT_VAT_RATE = 12;

export interface InvoiceTaxInput {
  /** Gross subtotal (sum of line prices), in centavos. */
  subtotalCents: number;
  /** Branch tax mode. Undefined/null → non_vat. */
  taxMode?: TaxMode | null;
  /** VAT percentage for vat_registered branches. Defaults to 12. */
  vatRate?: number | null;
}

export interface InvoiceTax {
  /** VAT amount (centavos). Mirrors vatCents; 0 for non_vat. */
  taxCents: number;
  /** Fractional rate stored on the invoice (e.g. 0.12). 0 for non_vat. */
  taxRate: number;
  /** VAT-able portion of the gross (centavos). */
  vatableCents: number;
  /** VAT-exempt portion (centavos). Reserved; 0 in the current model. */
  vatExemptCents: number;
  /** VAT amount (centavos). */
  vatCents: number;
}

export function computeInvoiceTax(input: InvoiceTaxInput): InvoiceTax {
  const subtotal = Math.max(0, Math.round(input.subtotalCents));

  if (input.taxMode !== 'vat_registered') {
    return { taxCents: 0, taxRate: 0, vatableCents: subtotal, vatExemptCents: 0, vatCents: 0 };
  }

  const rate = input.vatRate != null && input.vatRate > 0 ? input.vatRate : DEFAULT_VAT_RATE;
  const vatCents = Math.round((subtotal * rate) / (100 + rate));
  return {
    taxCents: vatCents,
    taxRate: rate / 100,
    vatableCents: subtotal - vatCents,
    vatExemptCents: 0,
    vatCents,
  };
}
