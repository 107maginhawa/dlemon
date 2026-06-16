/**
 * MedicalHistoryForm — patient medical history panel
 *
 * Sections (matching wireframe docs/prd/context/wireframes/medical-history-form.html):
 *  1. Medical Conditions (checkboxes, ICD-10)
 *  2. Current Medications (checkboxes, RxNorm)
 *  3. Allergies — Critical (checkboxes, SNOMED, severity note)
 *  4. Surgical History (textarea → stored as procedure entry)
 *  5. Pregnancy Status (radio → stored as condition entry)
 *  6. Lifestyle: Smoking + Alcohol (segmented → stored as condition entries)
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@monobase/ui';
import { toastError } from '@/lib/error-toast';
import {
  useMedicalHistory,
  useMedicalHistoryMutations,
  type MedicalHistoryEntry,
} from '../hooks/use-medical-history';
import {
  useMedicalHistoryReview,
  useMedicalHistoryReviewMutation,
  type AsaClassification,
} from '../hooks/use-medical-history-review';

const ASA_OPTIONS: { value: AsaClassification; label: string }[] = [
  { value: 'I', label: 'ASA I — Healthy' },
  { value: 'II', label: 'ASA II — Mild systemic disease' },
  { value: 'III', label: 'ASA III — Severe systemic disease' },
  { value: 'IV', label: 'ASA IV — Life-threatening disease' },
  { value: 'V', label: 'ASA V — Moribund' },
  { value: 'VI', label: 'ASA VI — Brain-dead (donor)' },
];

// ─── Preset items ─────────────────────────────────────────────────────────────

interface PresetItem {
  key: string; // stable identifier used to match against DB entries
  label: string;
  codeSystem?: string;
  code?: string;
  note?: string; // e.g. warning note shown in wireframe
}

const CONDITIONS: PresetItem[] = [
  { key: 'diabetes', label: 'Diabetes Mellitus Type 2', codeSystem: 'ICD-10', code: 'E11' },
  { key: 'hypertension', label: 'Hypertension', codeSystem: 'ICD-10', code: 'I10' },
  { key: 'heart-disease', label: 'Heart Disease', codeSystem: 'ICD-10', code: 'I25.10' },
  { key: 'blood-disorders', label: 'Blood Disorders', codeSystem: 'ICD-10', code: 'D64.9' },
  { key: 'hiv-hepatitis', label: 'HIV / Hepatitis B / C' },
  { key: 'asthma', label: 'Asthma', codeSystem: 'ICD-10', code: 'J45.909' },
];

const MEDICATIONS: PresetItem[] = [
  { key: 'warfarin', label: 'Warfarin 5mg', codeSystem: 'RxNorm', code: '855332', note: '⚠ Monitor bleeding risk' },
  { key: 'bp-med', label: 'Blood Pressure Medication', note: 'e.g. Amlodipine' },
  { key: 'bisphosphonates', label: 'Bisphosphonates', note: 'e.g. Alendronate' },
];

const ALLERGIES: PresetItem[] = [
  { key: 'penicillin', label: 'Penicillin', codeSystem: 'SNOMED', code: '372687004', note: 'Severe' },
  { key: 'latex', label: 'Latex', note: 'Moderate' },
  { key: 'aspirin', label: 'Aspirin', codeSystem: 'SNOMED', code: '387458008' },
  { key: 'local-anesthetics', label: 'Local Anesthetics', note: 'e.g. Lidocaine' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findEntry(
  entries: MedicalHistoryEntry[],
  entryType: string,
  displayName: string,
): MedicalHistoryEntry | undefined {
  return entries.find(
    (e) => e.entryType === entryType && e.displayName === displayName,
  );
}

function findEntryByCode(
  entries: MedicalHistoryEntry[],
  entryType: string,
  preset: PresetItem,
): MedicalHistoryEntry | undefined {
  if (preset.code) {
    const byCode = entries.find(
      (e) => e.entryType === entryType && e.code === preset.code,
    );
    if (byCode) return byCode;
  }
  return findEntry(entries, entryType, preset.label);
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface MedicalHistoryFormProps {
  patientId: string;
}

export function MedicalHistoryForm({ patientId }: MedicalHistoryFormProps) {
  const { entries, isLoading, error } = useMedicalHistory(patientId);
  const { addEntry, toggleEntry, updateEntry, saveError } = useMedicalHistoryMutations(patientId);

  // P1-4: ASA classification + periodic re-confirmation
  const { review, reviewDue } = useMedicalHistoryReview(patientId);
  const { recordReview, isRecording } = useMedicalHistoryReviewMutation(patientId);
  const [asaClass, setAsaClass] = useState<AsaClassification | ''>('');
  const [asaEmergency, setAsaEmergency] = useState(false);
  useEffect(() => {
    if (review) {
      setAsaClass((review.asaClassification as AsaClassification | undefined) ?? '');
      setAsaEmergency(review.asaEmergency ?? false);
    }
  }, [review]);

  async function handleRecordReview() {
    await recordReview({
      patientId,
      asaClassification: asaClass || undefined,
      asaEmergency,
    });
  }

  // Local state for surgical history textarea and lifestyle/pregnancy
  // (these are "special" single-value entries stored as procedure/condition)
  const [surgicalHistory, setSurgicalHistory] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState<
    'not_applicable' | 'pregnant' | 'breastfeeding'
  >('not_applicable');
  const [smoking, setSmoking] = useState<'non_smoker' | 'former' | 'current'>('non_smoker');
  const [alcohol, setAlcohol] = useState<'none' | 'occasional' | 'regular' | 'heavy'>('none');
  const [localSaved, setLocalSaved] = useState(false);

  // Sync local form state from loaded entries
  useEffect(() => {
    if (!entries.length) return;

    const surgEntry = entries.find(
      (e) => e.entryType === 'procedure' && e.displayName === 'Surgical History',
    );
    if (surgEntry) setSurgicalHistory(surgEntry.notes ?? '');

    const pregEntry = entries.find(
      (e) => e.entryType === 'condition' && e.displayName.startsWith('Pregnancy:'),
    );
    if (pregEntry) {
      if (pregEntry.displayName === 'Pregnancy: Pregnant') setPregnancyStatus('pregnant');
      else if (pregEntry.displayName === 'Pregnancy: Breastfeeding') setPregnancyStatus('breastfeeding');
      else setPregnancyStatus('not_applicable');
    }

    const smokingEntry = entries.find(
      (e) => e.entryType === 'condition' && e.displayName.startsWith('Smoking:'),
    );
    if (smokingEntry) {
      if (smokingEntry.displayName === 'Smoking: Former') setSmoking('former');
      else if (smokingEntry.displayName === 'Smoking: Current') setSmoking('current');
      else setSmoking('non_smoker');
    }

    const alcoholEntry = entries.find(
      (e) => e.entryType === 'condition' && e.displayName.startsWith('Alcohol:'),
    );
    if (alcoholEntry) {
      if (alcoholEntry.displayName === 'Alcohol: Occasional') setAlcohol('occasional');
      else if (alcoholEntry.displayName === 'Alcohol: Regular') setAlcohol('regular');
      else if (alcoholEntry.displayName === 'Alcohol: Heavy') setAlcohol('heavy');
      else setAlcohol('none');
    }
  }, [entries]);

  async function handleTogglePreset(
    preset: PresetItem,
    entryType: 'condition' | 'medication' | 'allergy',
  ) {
    const existing = findEntryByCode(entries, entryType, preset);
    // Resulting active state after this toggle (drives the allergy confirmation toast).
    const willBeActive = existing ? !existing.active : true;
    try {
      if (existing) {
        await toggleEntry({ entryId: existing.id, active: !existing.active });
      } else {
        await addEntry({
          patientId,
          entryType,
          displayName: preset.label,
          codeSystem: preset.codeSystem,
          code: preset.code,
        });
      }
      // Allergies are safety-critical — confirm the change so it is never silent.
      if (entryType === 'allergy') {
        toast.success(`${willBeActive ? 'Added' : 'Removed'}: ${preset.label}`);
      }
    } catch (err) {
      if (entryType === 'allergy') {
        toastError(err, `Could not update allergy: ${preset.label}`);
      }
    }
  }

  async function handleSaveSpecialFields() {
    // Surgical history
    const surgEntry = entries.find(
      (e) => e.entryType === 'procedure' && e.displayName === 'Surgical History',
    );
    if (surgEntry) {
      await updateEntry({ entryId: surgEntry.id, patch: { notes: surgicalHistory } });
    } else if (surgicalHistory.trim()) {
      await addEntry({ patientId, entryType: 'procedure', displayName: 'Surgical History', notes: surgicalHistory });
    }

    // Pregnancy
    const pregnancyLabel =
      pregnancyStatus === 'pregnant' ? 'Pregnancy: Pregnant'
      : pregnancyStatus === 'breastfeeding' ? 'Pregnancy: Breastfeeding'
      : 'Pregnancy: Not Applicable';
    const existingPreg = entries.find(
      (e) => e.entryType === 'condition' && e.displayName.startsWith('Pregnancy:'),
    );
    if (existingPreg) {
      if (existingPreg.displayName !== pregnancyLabel) {
        await updateEntry({ entryId: existingPreg.id, patch: { displayName: pregnancyLabel } });
      }
    } else {
      await addEntry({ patientId, entryType: 'condition', displayName: pregnancyLabel });
    }

    // Smoking
    const smokingLabel =
      smoking === 'former' ? 'Smoking: Former'
      : smoking === 'current' ? 'Smoking: Current'
      : 'Smoking: Non-smoker';
    const existingSmoke = entries.find(
      (e) => e.entryType === 'condition' && e.displayName.startsWith('Smoking:'),
    );
    if (existingSmoke) {
      if (existingSmoke.displayName !== smokingLabel) {
        await updateEntry({ entryId: existingSmoke.id, patch: { displayName: smokingLabel } });
      }
    } else {
      await addEntry({ patientId, entryType: 'condition', displayName: smokingLabel });
    }

    // Alcohol
    const alcoholLabel =
      alcohol === 'occasional' ? 'Alcohol: Occasional'
      : alcohol === 'regular' ? 'Alcohol: Regular'
      : alcohol === 'heavy' ? 'Alcohol: Heavy'
      : 'Alcohol: None';
    const existingAlcohol = entries.find(
      (e) => e.entryType === 'condition' && e.displayName.startsWith('Alcohol:'),
    );
    if (existingAlcohol) {
      if (existingAlcohol.displayName !== alcoholLabel) {
        await updateEntry({ entryId: existingAlcohol.id, patch: { displayName: alcoholLabel } });
      }
    } else {
      await addEntry({ patientId, entryType: 'condition', displayName: alcoholLabel });
    }

    setLocalSaved(true);
    setTimeout(() => setLocalSaved(false), 2000);
  }

  if (isLoading) {
    // Mirror the loaded layout's footprint (stacked section cards: a header strip
    // over a few rows) so swapping skeleton → content does not shift layout.
    return (
      <div data-testid="medical-history-loading" className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto pb-24">
            {[0, 1, 2].map((section) => (
              <div key={section} className="mt-4 rounded-xl border border-border overflow-hidden">
                <Skeleton className="h-9 w-full rounded-none" />
                <div className="flex flex-col gap-3 px-4 py-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-5 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive m-4">
        Failed to load medical history: {error.message}
      </div>
    );
  }

  const sectionHeaderClass = 'px-4 py-2.5 bg-secondary/50 border-b text-xs font-bold text-muted-foreground uppercase tracking-wide';
  const dangerHeaderClass = 'px-4 py-2.5 bg-red-50 border-b border-red-200/50 text-xs font-bold text-red-700 uppercase tracking-wide';
  const rowClass = 'flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors';

  function CheckboxRow({
    preset,
    entryType,
    isDanger = false,
  }: {
    preset: PresetItem;
    entryType: 'condition' | 'medication' | 'allergy';
    isDanger?: boolean;
  }) {
    const entry = findEntryByCode(entries, entryType, preset);
    const checked = entry?.active ?? false;

    return (
      <div
        className={`${rowClass} ${isDanger ? 'bg-red-50/30' : ''}`}
        onClick={() => handleTogglePreset(preset, entryType)}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => e.key === ' ' && handleTogglePreset(preset, entryType)}
        data-testid={`checkbox-${preset.key}`}
      >
        <div
          className={`w-5.5 h-5.5 w-[22px] h-[22px] rounded-md border flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
            checked
              ? isDanger
                ? 'bg-red-100 border-red-300 text-red-700'
                : 'bg-lemon border-lemon-hover text-lemon-foreground'
              : 'border-border bg-background'
          }`}
        >
          {checked && '✓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">{preset.label}</span>
            {preset.code && (
              <span className="text-xs text-muted-foreground">{preset.codeSystem}: {preset.code}</span>
            )}
          </div>
          {preset.note && (
            <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${
              preset.note.startsWith('⚠') ? 'bg-orange-100 text-orange-700 font-medium' : 'bg-secondary text-muted-foreground'
            }`}>
              {preset.note}
            </span>
          )}
        </div>
      </div>
    );
  }

  function SegmentedControl<T extends string>({
    value,
    options,
    onChange,
  }: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
  }) {
    return (
      <div className="flex bg-secondary/60 rounded-lg p-0.5 gap-0.5 w-fit">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`h-10 px-3.5 rounded-md text-sm font-medium transition-colors ${
              value === opt.value
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {saveError && (
        <div className="mx-4 mt-4 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Save failed: {saveError.message}
        </div>
      )}
      {localSaved && (
        <div className="mx-4 mt-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Medical history saved
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto pb-24">

          {/* ── ASA Status + Re-confirmation (P1-4) ──────────── */}
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className={`${sectionHeaderClass} flex items-center justify-between`}>
              <span>ASA Status &amp; Review</span>
              {reviewDue && (
                <span
                  data-testid="review-due-badge"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/20 text-warning normal-case tracking-normal"
                >
                  ⚠ Review due
                </span>
              )}
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="asa-class">
                  ASA Physical Status
                </label>
                <select
                  id="asa-class"
                  value={asaClass}
                  onChange={(e) => setAsaClass(e.target.value as AsaClassification | '')}
                  aria-label="ASA Physical Status classification"
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                >
                  <option value="">Not classified</option>
                  {ASA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={asaEmergency}
                  onChange={(e) => setAsaEmergency(e.target.checked)}
                  className="w-4 h-4 rounded"
                  aria-label="ASA emergency modifier"
                />
                <span className="text-sm">Emergency modifier (E)</span>
              </label>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {review?.reviewedAt
                    ? `Last reviewed ${new Date(review.reviewedAt).toLocaleDateString()}`
                    : 'Never reviewed'}
                </span>
                <button
                  type="button"
                  onClick={handleRecordReview}
                  disabled={isRecording}
                  data-testid="confirm-review-btn"
                  className="h-9 px-4 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
                >
                  {isRecording ? 'Saving…' : 'Confirm review'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Medical Conditions ─────────────────────────── */}
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className={sectionHeaderClass}>Medical Conditions</div>
            {CONDITIONS.map((preset) => (
              <CheckboxRow key={preset.key} preset={preset} entryType="condition" />
            ))}
          </div>

          {/* ── Current Medications ─────────────────────────── */}
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className={sectionHeaderClass}>Current Medications</div>
            {MEDICATIONS.map((preset) => (
              <CheckboxRow key={preset.key} preset={preset} entryType="medication" />
            ))}
          </div>

          {/* ── Allergies — Critical ─────────────────────────── */}
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className={dangerHeaderClass}>⚠ Allergies — Critical</div>
            {ALLERGIES.map((preset) => (
              <CheckboxRow key={preset.key} preset={preset} entryType="allergy" isDanger />
            ))}
          </div>

          {/* ── Surgical History ─────────────────────────────── */}
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className={sectionHeaderClass}>Surgical History</div>
            <textarea
              value={surgicalHistory}
              onChange={(e) => setSurgicalHistory(e.target.value)}
              placeholder="Describe any past surgeries, procedures, or hospitalizations…"
              className="w-full min-h-[80px] px-4 py-3 text-sm bg-background resize-y outline-none placeholder:text-muted-foreground"
              data-testid="surgical-history-textarea"
            />
          </div>

          {/* ── Pregnancy Status ────────────────────────────── */}
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className={sectionHeaderClass}>Pregnancy Status</div>
            {(
              [
                { value: 'not_applicable', label: 'Not Applicable' },
                { value: 'pregnant', label: 'Currently Pregnant' },
                { value: 'breastfeeding', label: 'Breastfeeding' },
              ] as const
            ).map((opt) => (
              <div
                key={opt.value}
                className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-secondary/30 transition-colors`}
                onClick={() => setPregnancyStatus(opt.value)}
                data-testid={`pregnancy-${opt.value}`}
              >
                <div
                  className={`w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 ${
                    pregnancyStatus === opt.value
                      ? 'border-lemon-hover bg-lemon'
                      : 'border-border bg-background'
                  }`}
                >
                  {pregnancyStatus === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-lemon-foreground" />
                  )}
                </div>
                <span className="text-sm">{opt.label}</span>
              </div>
            ))}
          </div>

          {/* ── Lifestyle ────────────────────────────────────── */}
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className={sectionHeaderClass}>Lifestyle</div>
            <div className="px-4 py-3 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Smoking</p>
              <SegmentedControl
                value={smoking}
                onChange={setSmoking}
                options={[
                  { value: 'non_smoker', label: 'Non-smoker' },
                  { value: 'former', label: 'Former' },
                  { value: 'current', label: 'Current' },
                ]}
              />
            </div>
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Alcohol Use</p>
              <SegmentedControl
                value={alcohol}
                onChange={setAlcohol}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'occasional', label: 'Occasional' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'heavy', label: 'Heavy' },
                ]}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="border-t px-4 py-3 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSaveSpecialFields}
          className="h-10 px-5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors"
          data-testid="save-medical-history-btn"
        >
          💾 Save Medical History
        </button>
      </div>
    </div>
  );
}
