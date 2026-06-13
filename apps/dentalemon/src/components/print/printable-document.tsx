/**
 * PrintableDocument — the shared print-view primitive (AHA FIX-008).
 *
 * A thin, dependency-free wrapper over the print stylesheet conventions already
 * defined in `src/styles/globals.css` (.no-print / .print-receipt / .print-a4).
 * It gives every print consumer ONE contract so we never grow three divergent
 * print implementations:
 *   - billing payment receipt   (layout="receipt", 80mm)  — first consumer
 *   - dental-patient statement  (layout="a4")             — later
 *   - case-presentation estimate(layout="a4")             — later
 *
 * Print-only: it triggers the browser's native print dialog (window.print).
 * No PDF library, no email — those are explicitly out of scope for V1.
 */
import React from 'react';

export type PrintLayout = 'receipt' | 'a4';

export interface PrintableDocumentProps {
  /** Accessible document label (also the print title region). */
  title: string;
  /** Page layout: 80mm thermal receipt or full A4. Defaults to a4. */
  layout?: PrintLayout;
  /** Test seam / custom trigger; defaults to window.print(). */
  onPrint?: () => void;
  /** Label for the print action button. */
  printLabel?: string;
  children: React.ReactNode;
}

export function PrintableDocument({
  title,
  layout = 'a4',
  onPrint,
  printLabel = 'Print',
  children,
}: PrintableDocumentProps) {
  const triggerPrint = onPrint ?? (() => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
  });

  const layoutClass = layout === 'receipt' ? 'print-receipt' : 'print-a4';

  return (
    <div data-testid="printable-document" className="flex flex-col gap-4">
      {/* Chrome: hidden on paper via .no-print */}
      <div className="no-print flex items-center justify-end">
        <button
          type="button"
          onClick={triggerPrint}
          className="h-10 px-4 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors"
        >
          {printLabel}
        </button>
      </div>

      {/* The printable region itself. The `print-document` marker drives the
          region-isolation print rule in globals.css so only this region reaches
          paper, regardless of the host (modal/page) it is mounted inside. */}
      <div className={`print-document ${layoutClass} bg-background text-foreground`} role="document" aria-label={title}>
        {children}
      </div>
    </div>
  );
}
