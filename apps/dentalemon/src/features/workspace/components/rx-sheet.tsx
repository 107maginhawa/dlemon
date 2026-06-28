/**
 * RxSheet — slide-up sheet for prescribing medication
 *
 * Two modes:
 *  - "new"  : prescribe a new medication (drug name, RxNorm code, dosage,
 *             frequency, duration, quantity, instructions, dispense-as-written,
 *             optional US legal fields). QW-1/P1-1: server allergy/interaction
 *             warnings require an explicit clinician acknowledgment.
 *  - "list" : FIX-006 / WF-016 — the visit's prescriptions with their lifecycle
 *             status (pending → dispensed | cancelled) and, for permitted roles,
 *             dispense/cancel actions. The FSM is enforced both server-side
 *             (EM-CLI-012) and in the UI (actions only on `pending`).
 *
 * Wireframe: docs/prd/context/wireframes/ws-rx-sheet.html
 */

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import {
  createPrescription,
  listPrescriptions,
  updatePrescription,
  type Prescription,
} from '@monobase/sdk-ts/generated';

const FREQUENCY_OPTIONS = [
  'OD (once daily)',
  'BID (twice daily)',
  'TID (three times daily)',
  'QID (four times daily)',
  'PRN (as needed)',
  'Stat (immediately)',
] as const;

/** P2-13: DEA controlled-substance schedule (21 CFR 1308). `none` is the
 *  default for non-controlled drugs (incl. the ₱/PH flow). Record-only. */
const SCHEDULE_OPTIONS = [
  { value: 'none', label: 'None (not controlled)' },
  { value: 'II', label: 'Schedule II' },
  { value: 'III', label: 'Schedule III' },
  { value: 'IV', label: 'Schedule IV' },
  { value: 'V', label: 'Schedule V' },
] as const;

type ControlledSubstanceSchedule = (typeof SCHEDULE_OPTIONS)[number]['value'];

/**
 * GAP-5 / FR1.12 / FR2.15 — drug↔allergy cross-check, evaluated CLIENT-SIDE so the
 * prescriber is gated with an explicit confirm BEFORE the prescription is created
 * ("blocking-with-override"), not warned after a 201. Tracks the backend match in
 * `createPrescription.ts`: case-insensitive substring in EITHER direction. The FE
 * additionally trims both sides (a defensive superset — trimming only broadens a
 * match in the safe direction) and skips empty allergen names (a bare "" would
 * substring-match every drug).
 */
export function matchAllergyConflicts(drugName: string, allergies: readonly string[]): string[] {
  const drug = drugName.trim().toLowerCase();
  if (!drug) return [];
  return allergies.filter((a) => {
    const allergen = a.trim().toLowerCase();
    return allergen.length > 0 && (allergen.includes(drug) || drug.includes(allergen));
  });
}

/** Local alias for a single drug-drug interaction warning (matches the generated
 *  Prescription.warnings.drugInteractions element shape); used by component state. */
type DrugInteraction = {
  interactingDrug: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
};

export interface RxSheetProps {
  visitId: string;
  patientId: string;
  prescriberMemberId: string;
  /**
   * WF-016 — whether the current user may dispense/cancel a prescription. The
   * backend gates the status transition to dentist_owner/dentist_associate; the
   * parent passes this so the lifecycle actions only surface for those roles
   * (otherwise they would surface a 403). The list itself is readable by all roles.
   */
  canManage?: boolean;
  /**
   * GAP-5 — the patient's ACTIVE allergy names (medical-history safety floor),
   * supplied by the workspace route so the sheet stays prop-pure (its test harness
   * has no QueryClient). Used to gate a conflicting prescription with a pre-submit
   * confirm dialog. Defaults to none → behaves exactly as before (server advisory).
   */
  patientAllergies?: readonly string[];
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function RxSheet({ visitId, patientId, prescriberMemberId, canManage = false, patientAllergies = [], open, onClose, onSaved }: RxSheetProps) {
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close.
  const { containerRef } = useSheetA11y({ open, onClose });

  const [mode, setMode] = useState<'new' | 'list'>('new');

  const [drugName, setDrugName] = useState('');
  const [rxNormCode, setRxNormCode] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [quantity, setQuantity] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dispenseAsWritten, setDispenseAsWritten] = useState(false);
  // P2-13: US-context legal Rx fields (record-only). Optional + additive.
  const [controlledSubstanceSchedule, setControlledSubstanceSchedule] = useState<ControlledSubstanceSchedule>('none');
  const [prescriberDea, setPrescriberDea] = useState('');
  const [prescriberNpi, setPrescriberNpi] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  /** Non-empty when the server flagged allergy conflicts; clinician must acknowledge. */
  const [allergyConflicts, setAllergyConflicts] = useState<string[]>([]);
  /** Non-empty when the server flagged drug-drug interactions; clinician must acknowledge. */
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([]);
  /** GAP-5: non-empty while the pre-submit allergy confirm dialog is open (the conflicting allergens). */
  const [pendingAllergyConfirm, setPendingAllergyConfirm] = useState<string[]>([]);

  // ── Lifecycle list state (FIX-006 / WF-016) ────────────────────────────────
  const [rxList, setRxList] = useState<Prescription[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  /** Id of the prescription currently being transitioned (disables its row actions). */
  const [actingId, setActingId] = useState('');

  // Load the visit's prescriptions whenever the List tab is shown.
  useEffect(() => {
    if (open && mode === 'list') void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, visitId]);

  // Reset to the create form when the sheet closes.
  useEffect(() => {
    if (!open) {
      setMode('new');
      setRxList([]);
      setListError('');
      setActingId('');
      setPendingAllergyConfirm([]);
    }
  }, [open]);

  async function fetchPrescriptions(): Promise<Prescription[]> {
    const res = await listPrescriptions({ path: { visitId } });
    // List-shape: the paginated envelope is { data, pagination } — unwrap `.data`.
    return res.data && 'data' in res.data ? (res.data.data as Prescription[]) : [];
  }

  async function loadList() {
    setListLoading(true);
    setListError('');
    try {
      setRxList(await fetchPrescriptions());
    } catch {
      setListError('Failed to load prescriptions');
    } finally {
      setListLoading(false);
    }
  }

  async function handleTransition(rx: Prescription, status: 'dispensed' | 'cancelled') {
    setActingId(rx.id);
    setListError('');
    try {
      const res = await updatePrescription({
        path: { visitId, prescriptionId: rx.id },
        body: { status },
      });
      if ((res as { error?: unknown }).error) {
        setListError('Failed to update prescription');
        return;
      }
      // Optimistic flip so the badge updates (and the now-terminal actions drop)
      // immediately, even if the reconcile read is slow or unavailable.
      setRxList(prev => prev.map(r => (r.id === rx.id ? { ...r, status } : r)));
      onSaved?.();
      // Best-effort reconcile with the server. A refetch failure must NOT masquerade
      // as a failed transition — the PATCH already committed — so swallow it and keep
      // the optimistic state.
      try {
        setRxList(await fetchPrescriptions());
      } catch {
        /* keep optimistic state */
      }
    } catch {
      setListError('Failed to update prescription');
    } finally {
      setActingId('');
    }
  }

  if (!open) return null;

  function validate(): string[] {
    const errs: string[] = [];
    if (!drugName.trim()) errs.push('Drug name is required');
    if (!dosage.trim()) errs.push('Dosage is required');
    if (!frequency.trim()) errs.push('Frequency is required');
    return errs;
  }

  // GAP-5: `allergyOverridden` is threaded as an explicit argument (not read from
  // state) so the dialog's "Prescribe anyway" can re-enter handleSave race-free —
  // a setState would not be visible within the same synchronous call.
  async function handleSave(allergyOverridden = false) {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);

    // GAP-5 / FR1.12: block BEFORE creating the Rx when the drug conflicts with a
    // recorded active allergy. The override is the explicit dialog confirmation.
    if (!allergyOverridden) {
      const conflicts = matchAllergyConflicts(drugName, patientAllergies);
      if (conflicts.length > 0) { setPendingAllergyConfirm(conflicts); return; }
    }

    setSaving(true);
    try {
      const result = await createPrescription({
        path: { visitId },
        body: {
          visitId,
          patientId,
          prescriberMemberId,
          drugName: drugName.trim(),
          dosage: dosage.trim(),
          frequency: frequency.trim(),
          rxNormCode: rxNormCode.trim() || undefined,
          duration: duration.trim() || undefined,
          quantity: quantity.trim() || undefined,
          instructions: instructions.trim() || undefined,
          dispenseAsWritten,
          // P2-13: only send schedule when controlled; DEA/NPI when provided.
          controlledSubstanceSchedule:
            controlledSubstanceSchedule !== 'none' ? controlledSubstanceSchedule : undefined,
          prescriberDea: prescriberDea.trim() || undefined,
          prescriberNpi: prescriberNpi.trim() || undefined,
        } as Parameters<typeof createPrescription>[0]['body'],
      });

      // QW-1/P1-1: surface drug-allergy conflicts returned by the server.
      // P1-2: also surface drug-drug interaction warnings. `warnings` is now modeled
      // on the generated Prescription type, so no cast is needed.
      const data = result.data;
      const serverConflicts = data?.warnings?.allergyConflicts ?? [];
      // GAP-5: suppress ONLY the allergens the clinician explicitly acknowledged in
      // the pre-submit dialog (= what the matcher surfaced for this drug). Any server
      // conflict NOT in that set — e.g. one added since the safety-floor cache loaded —
      // must still surface post-save rather than being blanket-swallowed by the override.
      const acknowledged = allergyOverridden
        ? new Set(matchAllergyConflicts(drugName, patientAllergies).map(a => a.toLowerCase()))
        : new Set<string>();
      const conflicts = serverConflicts.filter(c => !acknowledged.has(c.toLowerCase()));
      const interactions = data?.warnings?.drugInteractions ?? [];
      if (conflicts.length > 0 || interactions.length > 0) {
        // Prescription was saved — hold the sheet open and require acknowledgment.
        if (conflicts.length > 0) setAllergyConflicts(conflicts);
        if (interactions.length > 0) setDrugInteractions(interactions);
        return;
      }

      toast.success('Prescription saved');
      onSaved?.();
      onClose();
    } catch (err) {
      toastError(err, 'Could not save the prescription');
    } finally {
      setSaving(false);
    }
  }

  function handleAcknowledge() {
    setAllergyConflicts([]);
    setDrugInteractions([]);
    toast.success('Prescription saved');
    onSaved?.();
    onClose();
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Prescription sheet"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        data-testid="rx-sheet"
        className="relative w-full max-h-[75vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold">Prescription</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close prescription sheet"
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 px-5 pt-3 flex-shrink-0" role="tablist" aria-label="New prescription or prescription list">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'new'}
            onClick={() => { setMode('new'); setListError(''); }}
            className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'new'
                ? 'bg-lemon text-lemon-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
            }`}
          >
            New
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'list'}
            onClick={() => { setMode('list'); setErrors([]); }}
            className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'list'
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
            }`}
          >
            Prescriptions
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {mode === 'new' && (
            <>
              {errors.length > 0 && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {errors.map(e => <p key={e}>{e}</p>)}
                </div>
              )}

              {/* QW-1/P1-1 — Allergy conflict warning banner */}
              {allergyConflicts.length > 0 && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-lg bg-amber-50 border-2 border-amber-400 px-4 py-3 flex flex-col gap-2"
                >
                  <p className="text-sm font-semibold text-amber-900">
                    Allergy conflict: {allergyConflicts.join(', ')}
                  </p>
                  <p className="text-xs text-amber-800">
                    This patient has a recorded allergy to the prescribed drug or a related substance.
                    Review the patient&apos;s allergy history before proceeding.
                  </p>
                  {drugInteractions.length === 0 && (
                    <button
                      type="button"
                      onClick={handleAcknowledge}
                      className="self-start mt-1 px-4 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                      aria-label="Acknowledge conflict and prescribe anyway"
                    >
                      Prescribe anyway
                    </button>
                  )}
                </div>
              )}

              {/* P1-2 — Drug-drug interaction warning banner */}
              {drugInteractions.length > 0 && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-lg bg-orange-50 border-2 border-orange-400 px-4 py-3 flex flex-col gap-2"
                >
                  <p className="text-sm font-semibold text-orange-900">
                    Drug interaction warning
                  </p>
                  <ul className="text-xs text-orange-800 flex flex-col gap-1.5 list-none">
                    {drugInteractions.map((interaction, i) => (
                      <li key={i} className="flex flex-col gap-0.5">
                        <span className="font-semibold">
                          {interaction.interactingDrug}
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            interaction.severity === 'major'
                              ? 'bg-red-100 text-red-700'
                              : interaction.severity === 'moderate'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {interaction.severity}
                          </span>
                        </span>
                        <span>{interaction.description}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-orange-700 italic">
                    Note: interaction data is curated for dental use — not a comprehensive drug database.
                  </p>
                  <button
                    type="button"
                    onClick={handleAcknowledge}
                    className="self-start mt-1 px-4 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
                    aria-label="Acknowledge drug interaction and prescribe anyway"
                  >
                    Prescribe anyway
                  </button>
                </div>
              )}

              {/* Drug name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-drug-name">
                  Drug Name *
                </label>
                <input
                  id="rx-drug-name"
                  type="text"
                  value={drugName}
                  onChange={e => setDrugName(e.target.value)}
                  placeholder="e.g. Amoxicillin"
                  aria-label="Drug name"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
              </div>

              {/* RxNorm code */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-norm-code">
                  RxNorm Code (optional)
                </label>
                <input
                  id="rx-norm-code"
                  type="text"
                  value={rxNormCode}
                  onChange={e => setRxNormCode(e.target.value)}
                  placeholder="e.g. 723"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
              </div>

              {/* Dosage + Frequency side by side */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-dosage">
                    Dosage *
                  </label>
                  <input
                    id="rx-dosage"
                    type="text"
                    value={dosage}
                    onChange={e => setDosage(e.target.value)}
                    placeholder="e.g. 500mg"
                    aria-label="Dosage"
                    className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-frequency">
                    Frequency *
                  </label>
                  <select
                    id="rx-frequency"
                    value={frequency}
                    onChange={e => setFrequency(e.target.value)}
                    aria-label="Frequency selection"
                    className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  >
                    <option value="">Select…</option>
                    {FREQUENCY_OPTIONS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-duration">
                  Duration (optional)
                </label>
                <input
                  id="rx-duration"
                  type="text"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="e.g. 7 days"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-quantity">
                  Quantity (optional)
                </label>
                <input
                  id="rx-quantity"
                  type="text"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="e.g. 21 tablets"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-instructions">
                  Instructions (optional)
                </label>
                <textarea
                  id="rx-instructions"
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Prescription instructions…"
                  rows={2}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none"
                />
              </div>

              {/* Dispense as written */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dispenseAsWritten}
                  onChange={e => setDispenseAsWritten(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Dispense as written (no substitution)</span>
              </label>

              {/* P2-13 — Legal fields (US-context, optional). Hidden from the
                  non-controlled PH flow until needed; kept compact + optional. */}
              <fieldset className="mt-1 rounded-xl border border-border p-3 flex flex-col gap-3">
                <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Legal (US, optional)
                </legend>

                {/* Controlled-substance schedule */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-cs-schedule">
                    Controlled-Substance Schedule
                  </label>
                  <select
                    id="rx-cs-schedule"
                    value={controlledSubstanceSchedule}
                    onChange={e => setControlledSubstanceSchedule(e.target.value as ControlledSubstanceSchedule)}
                    aria-label="Controlled-substance schedule"
                    className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  >
                    {SCHEDULE_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* DEA + NPI side by side */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-dea">
                      Prescriber DEA
                    </label>
                    <input
                      id="rx-dea"
                      type="text"
                      value={prescriberDea}
                      onChange={e => setPrescriberDea(e.target.value)}
                      placeholder="e.g. AB1234567"
                      aria-label="Prescriber DEA number"
                      className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-npi">
                      Prescriber NPI
                    </label>
                    <input
                      id="rx-npi"
                      type="text"
                      value={prescriberNpi}
                      onChange={e => setPrescriberNpi(e.target.value)}
                      placeholder="10-digit NPI"
                      aria-label="Prescriber NPI"
                      className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                    />
                  </div>
                </div>
              </fieldset>
            </>
          )}

          {/* FIX-006 / WF-016 — prescription list + dispense/cancel lifecycle */}
          {mode === 'list' && (
            <>
              {listError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {listError}
                </div>
              )}
              {listLoading && (
                <p className="text-sm text-muted-foreground">Loading prescriptions…</p>
              )}
              {!listLoading && rxList.length === 0 && (
                <p className="text-sm text-muted-foreground">No prescriptions for this visit yet.</p>
              )}

              {rxList.map((rx) => {
                const status = rx.status;
                const statusStyle =
                  status === 'dispensed'
                    ? 'bg-success/15 text-success-foreground'
                    : status === 'cancelled'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-warning/15 text-warning-foreground';
                const subtitle = [rx.dosage, rx.frequency].filter(Boolean).join(' · ');
                return (
                  <div
                    key={rx.id}
                    data-testid={`rx-row-${rx.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{rx.drugName}</p>
                      {subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                      )}
                      <span
                        data-testid={`rx-status-${rx.id}`}
                        className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusStyle}`}
                      >
                        {status}
                      </span>
                    </div>
                    {/* FSM-gated (pending only) + role-gated (canManage) lifecycle actions */}
                    {canManage && status === 'pending' && (
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTransition(rx, 'dispensed')}
                          disabled={actingId === rx.id}
                          aria-label={`Mark ${rx.drugName} dispensed`}
                          className="h-8 px-3 rounded-lg border border-green-500/50 text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                        >
                          {actingId === rx.id ? '…' : 'Dispense'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTransition(rx, 'cancelled')}
                          disabled={actingId === rx.id}
                          aria-label={`Cancel ${rx.drugName} prescription`}
                          className="h-8 px-3 rounded-lg border border-destructive/40 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
          >
            {mode === 'new' ? 'Cancel' : 'Close'}
          </button>
          {mode === 'new' && (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || allergyConflicts.length > 0 || drugInteractions.length > 0}
              className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save prescription'}
            </button>
          )}
        </div>
      </div>

      {/* GAP-5 / FR1.12 — pre-submit allergy blocking-with-override confirm dialog.
          Radix Dialog (no shadcn AlertDialog in this repo); mirrors the
          pre-completion-checklist pattern. The prescription is created ONLY on the
          explicit "Prescribe anyway" override. */}
      <Dialog.Root
        open={pendingAllergyConfirm.length > 0}
        onOpenChange={(v) => { if (!v) setPendingAllergyConfirm([]); }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-sm w-[calc(100%-2rem)] bg-background rounded-2xl p-6 z-50 shadow-2xl focus:outline-none"
            aria-describedby="allergy-confirm-description"
          >
            {/* testid on an inner wrapper: the test-env Dialog.Content stub drops
                arbitrary props, so anchor queries on a real child div. */}
            <div data-testid="allergy-confirm-dialog">
              <Dialog.Title className="text-base font-semibold text-amber-900">
                Allergy conflict
              </Dialog.Title>
              <p id="allergy-confirm-description" className="text-sm text-muted-foreground mt-2">
                <span className="font-medium text-foreground">{drugName.trim() || 'This drug'}</span>
                {' '}conflicts with this patient&apos;s recorded allergy to{' '}
                <span className="font-semibold text-amber-900">{pendingAllergyConfirm.join(', ')}</span>.
                Prescribing it anyway requires your explicit confirmation.
              </p>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setPendingAllergyConfirm([])}
                  className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingAllergyConfirm([]); void handleSave(true); }}
                  aria-label="Prescribe anyway despite allergy"
                  className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                >
                  Prescribe anyway
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
