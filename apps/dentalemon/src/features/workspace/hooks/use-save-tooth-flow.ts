/**
 * useSaveToothFlow — orchestrates the chart + treatment save sequence
 *
 * Extracted from handleSaveToothData in $patientId.tsx.
 * 1. Validates FDI tooth number
 * 2. Builds updated teeth array
 * 3. Saves chart via POST /dental/visits/:visitId/chart
 * 4. On chart success: saves treatment (if CDT code present) via POST /dental/visits/:visitId/treatments
 * 5. Calls onSuccess() after chart save (e.g. clearSelection)
 */
import type { ToothData } from '@/features/workspace/components/dental-chart.helpers';
import { isValidFdiNumber } from '@/features/workspace/components/dental-chart.helpers';
import type { ToothSlideoutData } from '@/features/workspace/components/tooth-slideout';
import { useSaveChart } from './use-save-chart';
import { useSaveTreatment } from './use-save-treatment';

interface UseSaveToothFlowOptions {
  visitId: string | null;
  patientId: string;
  teeth: ToothData[];
  selectedTooth: number | null;
  onSuccess?: () => void;
}

export function useSaveToothFlow({
  visitId,
  patientId,
  teeth,
  selectedTooth,
  onSuccess,
}: UseSaveToothFlowOptions) {
  const saveChartMutation = useSaveChart();
  const saveTreatmentMutation = useSaveTreatment();

  const isSaving = saveChartMutation.isPending || saveTreatmentMutation.isPending;

  function saveToothData(data: ToothSlideoutData) {
    const toothNumber = selectedTooth;
    if (!visitId || !toothNumber) return;
    if (!isValidFdiNumber(toothNumber)) {
      console.error(`Invalid FDI tooth number: ${toothNumber}`);
      return;
    }

    const updatedTeeth: ToothData[] = [...teeth];
    const toothEntry: ToothData = {
      toothNumber,
      state: data.state,
      surfaces: data.surfaces,
      conditionCode: data.conditionCode,
      surfaceConditionMap: data.surfaceConditionMap,
      entryClassification: data.entryClassification,
    };
    const idx = updatedTeeth.findIndex((t) => t.toothNumber === toothNumber);
    if (idx >= 0) updatedTeeth[idx] = toothEntry;
    else updatedTeeth.push(toothEntry);

    let priceAmount: number | undefined;
    if (data.cdtCode && data.description && data.priceInput !== undefined && data.priceInput !== '') {
      const raw = parseFloat(data.priceInput);
      if (isNaN(raw)) {
        console.error('Invalid price input — treatment not saved');
        return;
      }
      priceAmount = raw;
    }

    saveChartMutation.mutate(
      { visitId, patientId, teeth: updatedTeeth },
      {
        onSuccess: () => {
          // Chart-only save (no billable treatment) — finalize immediately.
          if (!(data.cdtCode && data.description && priceAmount !== undefined)) {
            onSuccess?.();
            return;
          }
          // A treatment must be recorded too. Only finalize (close the slideout via
          // onSuccess) AFTER it persists, so the clinician never sees a "saved" tooth
          // with a silently-dropped treatment (CR-04).
          saveTreatmentMutation.mutate(
            {
              visitId,
              patientId,
              cdtCode: data.cdtCode,
              description: data.description,
              toothNumber,
              surfaces: data.surfaces,
              conditionCode: data.conditionCode,
              priceAmount,
              currency: 'PHP',
              clinicalNotes: data.clinicalNotes,
            },
            {
              onSuccess: () => onSuccess?.(),
              onError: (err) => {
                // useSaveTreatment already surfaces a toast. Deliberately do NOT call
                // onSuccess here: keep the slideout open so the clinician can retry
                // without losing context (chart is saved; treatment is not).
                console.error('Treatment save failed — chart saved, treatment not recorded', err);
              },
            },
          );
        },
      },
    );
  }

  return { saveToothData, isSaving };
}
