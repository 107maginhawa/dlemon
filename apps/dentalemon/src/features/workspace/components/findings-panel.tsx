/**
 * FindingsPanel — P0-C condition-vocabulary findings + finding→treatment (FE).
 *
 * Lets a clinician record structured findings on a tooth from the curated
 * vocabulary (kept separate from the odontogram `state`), with an optional
 * surface and a note (required for `other`). Active findings can be resolved
 * (so they stop rendering as active) or converted into a treatment.
 */
import React, { useState } from 'react';
import type { ConditionCode, ToothSurfaceCode, DentalFinding } from '@monobase/sdk-ts/generated';
import { useFindings } from '../hooks/use-findings';
import { FINDINGS_VOCABULARY, NOTE_REQUIRED_CODES, findingLabel } from './findings-vocabulary';

export interface FindingsPanelProps {
  visitId: string;
  toothNumber: number;
  /** Used to invalidate the patient's treatment plan when a finding is converted. */
  patientId?: string;
}

const SURFACES: ToothSurfaceCode[] = ['mesial', 'distal', 'buccal', 'lingual', 'occlusal', 'incisal', 'cervical'];

// Sensible default CDT suggestions when converting a finding → treatment. The
// clinician can edit before confirming — this only seeds the form.
const SUGGESTED_CDT: Partial<Record<ConditionCode, string>> = {
  caries: 'D2391',
  calculus: 'D1110',
  gingival_recession: 'D4341',
  retained_root: 'D7140',
  impacted_unerupted: 'D7220',
  fracture_crack: 'D2740',
  abscess: 'D3310',
};

export function FindingsPanel({ visitId, toothNumber, patientId }: FindingsPanelProps) {
  const { activeFindings, createFinding, resolveFinding, convertFinding, isMutating } = useFindings(visitId, toothNumber, patientId);

  const [code, setCode] = useState<ConditionCode | null>(null);
  const [surface, setSurface] = useState<ToothSurfaceCode | ''>('');
  const [note, setNote] = useState('');

  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [cdt, setCdt] = useState('');
  const [desc, setDesc] = useState('');

  const noteRequired = code != null && NOTE_REQUIRED_CODES.has(code);
  const canAdd = code != null && (!noteRequired || note.trim().length > 0) && !isMutating;

  async function handleAdd() {
    if (!code) return;
    await createFinding({
      toothNumber,
      conditionCode: code,
      surface: surface || undefined,
      note: note.trim() || undefined,
    });
    setCode(null);
    setSurface('');
    setNote('');
  }

  function startConvert(f: DentalFinding) {
    setConvertingId(f.id);
    setCdt(SUGGESTED_CDT[f.conditionCode] ?? 'D0140');
    setDesc(findingLabel(f.conditionCode));
  }

  async function confirmConvert(findingId: string) {
    if (!cdt.trim() || !desc.trim()) return;
    await convertFinding(findingId, { cdtCode: cdt.trim(), description: desc.trim() });
    setConvertingId(null);
  }

  return (
    <div data-testid="findings-panel" className="rounded-lg border p-3">
      <h3 className="text-sm font-semibold">Findings</h3>

      {/* Vocabulary picker */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FINDINGS_VOCABULARY.map((entry) => (
          <button
            key={entry.code}
            type="button"
            data-testid={`finding-code-${entry.code}`}
            onClick={() => setCode(entry.code)}
            aria-pressed={code === entry.code}
            className={[
              'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
              code === entry.code ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50',
            ].join(' ')}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {code != null && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted-foreground">Surface (optional)</label>
            <select
              data-testid="finding-surface-select"
              value={surface}
              onChange={(e) => setSurface(e.target.value as ToothSurfaceCode | '')}
              className="rounded border px-1.5 py-0.5 text-xs"
            >
              <option value="">Whole tooth</option>
              {SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea
            data-testid="finding-note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={noteRequired ? 'Note required for “Other”' : 'Note (optional)'}
            rows={2}
            className="w-full rounded border px-2 py-1 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="finding-add-btn"
              disabled={!canAdd}
              onClick={handleAdd}
              className="rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
            >
              Add finding
            </button>
            <button
              type="button"
              onClick={() => { setCode(null); setNote(''); setSurface(''); }}
              className="rounded border px-2 py-0.5 text-[11px] font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active findings list */}
      <ul className="mt-3 flex flex-col gap-1.5">
        {activeFindings.length === 0 && (
          <li className="text-[11px] text-muted-foreground">No new findings to record on this tooth. Past flagged findings appear in the Treatment Breakdown.</li>
        )}
        {activeFindings.map((f) => (
          <li key={f.id} data-testid={`finding-row-${f.id}`} className="rounded border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">
                {findingLabel(f.conditionCode)}
                {f.surface ? <span className="ml-1 text-[11px] text-muted-foreground">({f.surface})</span> : null}
                {f.linkedTreatmentId ? <span className="ml-1 text-[10px] text-green-700">• linked to treatment</span> : null}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  data-testid={`finding-resolve-${f.id}`}
                  disabled={isMutating}
                  onClick={() => resolveFinding(f.id)}
                  className="rounded border px-1.5 py-0.5 text-[10px] font-medium disabled:opacity-50"
                >
                  Resolve
                </button>
                {!f.linkedTreatmentId && (
                  <button
                    type="button"
                    data-testid={`finding-convert-${f.id}`}
                    disabled={isMutating}
                    onClick={() => startConvert(f)}
                    className="rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    → Treatment
                  </button>
                )}
              </div>
            </div>

            {f.note && <p className="mt-1 text-[11px] text-muted-foreground">{f.note}</p>}

            {convertingId === f.id && (
              <div className="mt-2 flex flex-col gap-1.5 border-t pt-2">
                <div className="flex gap-2">
                  <input
                    data-testid={`finding-convert-cdt-${f.id}`}
                    value={cdt}
                    onChange={(e) => setCdt(e.target.value)}
                    placeholder="CDT code"
                    className="w-24 rounded border px-1.5 py-0.5 text-xs"
                  />
                  <input
                    data-testid={`finding-convert-desc-${f.id}`}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Description"
                    className="flex-1 rounded border px-1.5 py-0.5 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid={`finding-convert-confirm-${f.id}`}
                    disabled={!cdt.trim() || !desc.trim() || isMutating}
                    onClick={() => confirmConvert(f.id)}
                    className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Create treatment
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvertingId(null)}
                    className="rounded border px-2 py-0.5 text-[10px] font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
