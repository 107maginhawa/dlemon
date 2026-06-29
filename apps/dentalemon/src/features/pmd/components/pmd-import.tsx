/**
 * PMDImport — form for importing an external PMD record
 *
 * Steps: enter source facility + content → preview Safety Floor items → confirm import
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import { importPmdMutation, mergeImportedPmdSafetyFloorMutation } from '@monobase/sdk-ts/generated/react-query';
import { medicalHistoryKey } from '@/features/workspace/hooks/use-medical-history';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';

interface SafetyFloorPreview {
  conditions: string[];
  medications: string[];
  allergies: string[];
}

function extractPreview(content: string): SafetyFloorPreview {
  try {
    const data = JSON.parse(content);
    return {
      conditions: Array.isArray(data.conditions) ? data.conditions : [],
      medications: Array.isArray(data.medications) ? data.medications : [],
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
    };
  } catch {
    return { conditions: [], medications: [], allergies: [] };
  }
}

export interface PMDImportProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type Step = 'form' | 'preview' | 'done';

export function PMDImport({ patientId, open, onClose, onImported }: PMDImportProps) {
  const { containerRef } = useSheetA11y({ open, onClose });
  const [step, setStep] = useState<Step>('form');
  const [sourceFacility, setSourceFacility] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [sourceDescription, setSourceDescription] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<SafetyFloorPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();
  const importMut = useMutation(importPmdMutation());
  const mergeMut = useMutation(mergeImportedPmdSafetyFloorMutation());

  if (!open) return null;

  function validate(): string[] {
    const errs: string[] = [];
    if (!sourceFacility.trim()) errs.push('Source facility is required');
    if (!sourceDescription.trim()) errs.push('Source software/system is required');
    if (sourceDescription.trim().length > 200) errs.push('Source software/system must be 200 characters or fewer');
    if (!content.trim()) errs.push('PMD content is required');
    if (content.trim()) {
      try { JSON.parse(content); } catch { errs.push('PMD content must be valid JSON'); }
    }
    return errs;
  }

  function handleNext() {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setPreview(extractPreview(content));
    setStep('preview');
  }

  async function handleConfirm() {
    setSaving(true);
    let imported: { id: string };
    try {
      imported = await importMut.mutateAsync({
        body: {
          patientId,
          sourceFacility: sourceFacility.trim(),
          sourceReference: sourceReference.trim() || undefined,
          sourceDescription: sourceDescription.trim(),
          // content is a JSON string field — send as-is (not multipart)
          content: content.trim(),
        },
      });
      toast.success('PMD imported');
    } catch (err) {
      setErrors(['Failed to import PMD']);
      toastError(err, 'Could not import PMD');
      setStep('form');
      setSaving(false);
      return;
    }

    // FIX-003 (decision #20): the import only stores the record verbatim — it is
    // clinically inert until its safety-floor items are merged into the patient's
    // living medical history. Merge now so the previewed allergies/medications/
    // conditions actually surface in the Safety Floor (honest "updated" claim).
    try {
      await mergeMut.mutateAsync({ path: { id: imported.id } });
      // The merge wrote new med-history entries — refresh the Safety Floor cache
      // (the same key the workspace top bar reads) so the update is visible live,
      // not just on the next reload.
      await queryClient.invalidateQueries({ queryKey: medicalHistoryKey(patientId) });
      setStep('done');
      onImported?.();
      toast.success('Safety Floor updated');
    } catch (err) {
      // The record imported but the safety-floor merge failed; be honest about it.
      // The imported PMD persists and can be merged later from the imported record.
      setErrors(['PMD imported, but updating the Safety Floor failed. Please try again from the imported record.']);
      toastError(err, 'PMD imported, but updating the Safety Floor failed');
      setStep('form');
      onImported?.();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setStep('form');
    setSourceFacility('');
    setSourceReference('');
    setSourceDescription('');
    setContent('');
    setPreview(null);
    setErrors([]);
    onClose();
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        data-testid="pmd-import"
        className="relative w-full max-h-[80vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold">Import External PMD</h2>
            {step === 'preview' && (
              <p className="text-xs text-muted-foreground">Review Safety Floor items before confirming</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {step === 'form' && (
            <>
              {errors.length > 0 && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {errors.map(e => <p key={e}>{e}</p>)}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="pmd-facility">
                  Source Facility *
                </label>
                <input
                  id="pmd-facility"
                  type="text"
                  value={sourceFacility}
                  onChange={e => setSourceFacility(e.target.value)}
                  placeholder="e.g. City Dental Clinic"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="pmd-ref">
                  Source Reference (optional)
                </label>
                <input
                  id="pmd-ref"
                  type="text"
                  value={sourceReference}
                  onChange={e => setSourceReference(e.target.value)}
                  placeholder="e.g. REF-2025-001"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="pmd-source-description">
                  Source Software / System *
                </label>
                <input
                  id="pmd-source-description"
                  type="text"
                  value={sourceDescription}
                  onChange={e => setSourceDescription(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Open Dental v21.1, Dentrix G7"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Originating system — required for data-provenance audit trail.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="pmd-content">
                  PMD Content (JSON) *
                </label>
                <textarea
                  id="pmd-content"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder='{"conditions":["I10"],"medications":["Amoxicillin"],"allergies":[]}'
                  rows={5}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm font-mono bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none"
                />
              </div>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                The following items from this PMD will be added to the patient's Safety Floor (existing entries are preserved).
              </div>

              {preview.conditions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Conditions
                  </h4>
                  <ul className="flex flex-col gap-1">
                    {preview.conditions.map(c => (
                      <li key={c} className="text-sm bg-secondary rounded-lg px-3 py-2">{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.medications.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Medications
                  </h4>
                  <ul className="flex flex-col gap-1">
                    {preview.medications.map(m => (
                      <li key={m} className="text-sm bg-secondary rounded-lg px-3 py-2">{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.allergies.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Allergies
                  </h4>
                  <ul className="flex flex-col gap-1">
                    {preview.allergies.map(a => (
                      <li key={a} className="text-sm bg-red-50 text-red-700 rounded-lg px-3 py-2">{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.conditions.length === 0 && preview.medications.length === 0 && preview.allergies.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No Safety Floor items found in this PMD.</p>
              )}
            </>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
              <p className="text-sm font-medium">PMD imported successfully</p>
              <p className="text-xs text-muted-foreground text-center">The patient's Safety Floor has been updated with the imported data.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0">
          {step === 'form' && (
            <>
              <button type="button" onClick={handleClose} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleNext} className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors">
                Preview
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button type="button" onClick={() => setStep('form')} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">
                Back
              </button>
              <button type="button" onClick={handleConfirm} disabled={saving} className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50">
                {saving ? 'Importing…' : 'Confirm Import'}
              </button>
            </>
          )}
          {step === 'done' && (
            <button type="button" onClick={handleClose} className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
