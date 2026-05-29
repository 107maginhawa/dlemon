/**
 * PMDViewer — displays a Portable Medical Document
 *
 * Shows: visit snapshot, treatments (CDT), prescriptions (RxNorm),
 *        signature status, supersession chain.
 */

import React from 'react';
import type { PMDStatus, PMDTreatment, PMDPrescription, PMDContent, PMDDocument } from '../types';

// Re-export for consumers that imported from this file before the types module existed
export type { PMDDocument };

interface Props {
  pmd: PMDDocument;
}

const STATUS_COLORS: Record<PMDStatus, string> = {
  generated: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  superseded: 'bg-gray-100 text-gray-500',
};

export function PMDViewer({ pmd }: Props) {
  let content: PMDContent = {};
  try {
    content = JSON.parse(pmd.content);
  } catch {
    content = {};
  }

  return (
    <div data-testid="pmd-viewer" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Portable Medical Document</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generated {new Date(pmd.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[pmd.status]}`}>
          {pmd.status === 'generated' ? 'Generated' : pmd.status === 'signed' ? 'Signed' : 'Superseded'}
        </span>
      </div>

      {/* Signature status */}
      {pmd.status === 'signed' && pmd.signedAt && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <span>✓</span>
          <span>Digitally signed on {new Date(pmd.signedAt).toLocaleString()}</span>
        </div>
      )}

      {pmd.status === 'superseded' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          This document has been superseded by a newer version.
        </div>
      )}

      {/* Checksum */}
      <div className="rounded-xl border border-border px-4 py-3 text-xs text-muted-foreground font-mono">
        SHA: {pmd.checksum}
      </div>

      {/* Treatments */}
      {content.treatments && content.treatments.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Treatments ({content.treatments.length})
          </h4>
          <div className="flex flex-col gap-2">
            {content.treatments.map((t, i) => (
              <div key={i} className="rounded-xl border border-border px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded mr-2">{t.cdtCode}</span>
                  <span>{t.description}</span>
                  {t.toothNumber && (
                    <span className="text-xs text-muted-foreground ml-2">Tooth {t.toothNumber}</span>
                  )}
                </div>
                {t.priceCents !== undefined && (
                  <span className="text-sm font-medium">₱{(t.priceCents / 100).toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prescriptions */}
      {content.prescriptions && content.prescriptions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Prescriptions ({content.prescriptions.length})
          </h4>
          <div className="flex flex-col gap-2">
            {content.prescriptions.map((rx, i) => (
              <div key={i} className="rounded-xl border border-border px-4 py-3 text-sm">
                <div className="font-medium">{rx.drugName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {rx.dosage} · {rx.frequency}
                  {rx.rxNormCode && ` · RxNorm: ${rx.rxNormCode}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.treatments?.length === 0 && content.prescriptions?.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No clinical data recorded.</p>
      )}
    </div>
  );
}
