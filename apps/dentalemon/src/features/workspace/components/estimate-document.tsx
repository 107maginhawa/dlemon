/**
 * EstimateDocument — Phase 2A. A formal, print-ready rendering of a treatment
 * plan as a patient-facing estimate: header, line items, total, and a signature
 * block that flips from "awaiting approval" to the captured e-signature once the
 * patient approves in person.
 *
 * Pure/presentational — the overlay (estimate-overlay.tsx) owns data + actions.
 */
import React from 'react';
import { formatCents } from '@/lib/format-currency';
import { APP_LOCALE } from '@/constants/brand';

export interface EstimateLineItem {
  toothNumber?: number | null;
  cdtCode?: string;
  description: string;
  priceCents: number;
}

export interface EstimateDocumentProps {
  /** Stable-ish display number: "DRAFT" before approval, "EST-NNNN" once frozen. */
  estimateNo: string;
  date: string | Date;
  patientName?: string;
  clinicName?: string;
  lineItems: EstimateLineItem[];
  totalCents: number;
  approved?: boolean;
  /** base64 PNG from the signature canvas — only present once approved. */
  signatureDataUrl?: string;
  signedAt?: string | Date;
}

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function EstimateDocument({
  estimateNo,
  date,
  patientName,
  clinicName,
  lineItems,
  totalCents,
  approved,
  signatureDataUrl,
  signedAt,
}: EstimateDocumentProps) {
  return (
    <div
      data-testid="estimate-document"
      className="mx-auto max-w-3xl bg-white p-6 text-sm text-gray-900 print:p-0"
    >
      <header className="flex items-start justify-between border-b pb-3">
        <div>
          <h1 className="text-lg font-bold">{clinicName ?? 'Treatment Estimate'}</h1>
          {clinicName && <p className="text-xs text-gray-500">Treatment Estimate</p>}
        </div>
        <dl className="text-right text-xs">
          <div>
            <dt className="inline font-semibold">Estimate&nbsp;No.&nbsp;</dt>
            <dd className="inline tabular-nums">{estimateNo}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Date&nbsp;</dt>
            <dd className="inline">{formatDate(date)}</dd>
          </div>
          {patientName && (
            <div>
              <dt className="inline font-semibold">Patient&nbsp;</dt>
              <dd className="inline">{patientName}</dd>
            </div>
          )}
        </dl>
      </header>

      <section className="mt-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-2">Tooth</th>
              <th className="py-1 pr-2">CDT</th>
              <th className="py-1 pr-2">Description</th>
              <th className="py-1 pr-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr
                key={`${item.toothNumber ?? 'gen'}-${item.cdtCode ?? ''}-${i}`}
                data-testid="estimate-line-item"
                className="border-b"
              >
                <td className="py-1 pr-2">{item.toothNumber != null ? `#${item.toothNumber}` : '—'}</td>
                <td className="py-1 pr-2 tabular-nums">{item.cdtCode ?? '—'}</td>
                <td className="py-1 pr-2">{item.description || '—'}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatCents(item.priceCents)}</td>
              </tr>
            ))}
            {lineItems.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-gray-400">No planned treatments.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800 font-semibold">
              <td className="py-2" colSpan={3}>Total estimate</td>
              <td data-testid="estimate-total" className="py-2 text-right tabular-nums">
                {formatCents(totalCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section
        data-testid="estimate-signature-block"
        className="mt-8 flex items-end justify-between gap-6"
      >
        <div className="flex-1">
          {approved && signatureDataUrl ? (
            <>
              <img
                src={signatureDataUrl}
                alt="Patient signature"
                className="h-16 max-w-[16rem] border-b border-gray-800 object-contain"
              />
              <p className="mt-1 text-xs font-semibold text-green-700">
                Approved — signed {signedAt ? `on ${formatDate(signedAt)}` : ''}
              </p>
            </>
          ) : (
            <>
              <div className="h-16 border-b border-gray-400" />
              <p className="mt-1 text-xs text-gray-500">Patient signature — awaiting approval</p>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 print:block">
          This estimate is not a final bill. Fees may change with clinical findings.
        </p>
      </section>
    </div>
  );
}
