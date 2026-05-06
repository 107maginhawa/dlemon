/**
 * Workspace Route — /_workspace/$patientId
 *
 * Full-screen clinical workspace for a patient visit.
 * Left zone: WorkspaceTabs + Timeline Carousel + Dental Chart
 * Right zone: Tooth Slideout (when tooth selected)
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { TimelineCarousel } from '@/features/workspace/components/timeline-carousel';
import { DentalChart } from '@/features/workspace/components/dental-chart.tsx';
import type { ToothData } from '@/features/workspace/components/dental-chart.helpers';
import { ToothSlideout } from '@/features/workspace/components/tooth-slideout';
import type { ToothSlideoutData } from '@/features/workspace/components/tooth-slideout';
import { WorkspaceTabs } from '@/features/workspace/components/workspace-tabs';
import type { WorkspaceTab } from '@/features/workspace/components/workspace-tabs';
import { MedicalHistoryForm } from '@/features/workspace/components/medical-history-form';
import { useVisits } from '@/features/workspace/hooks/use-visits';
import { useDentalChart } from '@/features/workspace/hooks/use-dental-chart-query';
import { useTreatments } from '@/features/workspace/hooks/use-treatments';
import { useCreateVisit } from '@/features/workspace/hooks/use-create-visit';
import { useSharePMD } from '@/features/workspace/hooks/use-share-pmd';
import { useSaveChart } from '@/features/workspace/hooks/use-save-chart';
import { useSaveTreatment } from '@/features/workspace/hooks/use-save-treatment';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

export const Route = createFileRoute('/_workspace/$patientId')({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { patientId } = Route.useParams();
  const navigate = useNavigate();

  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('odontogram');
  const [pmdShared, setPmdShared] = useState(false);

  // ── Data hooks (chart + treatments fire in parallel once visitId is set) ──
  const { visits, isLoading: visitsLoading } = useVisits({ patientId });
  const { teeth, selectedTooth, selectTooth, clearSelection } =
    useDentalChart({ visitId: currentVisitId });
  const { treatments } =
    useTreatments({ visitId: currentVisitId });

  // Auto-select active or most recent visit once visits load
  useEffect(() => {
    if (!visits.length) return;
    if (currentVisitId) return; // already selected
    const active = visits.find((v) => v.status === 'active');
    setCurrentVisitId((active ?? visits[0])?.id ?? null);
  }, [visits]);

  const currentVisit = visits.find((v) => v.id === currentVisitId);
  const isReadOnly =
    currentVisit?.status === 'completed' || currentVisit?.status === 'locked';

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createVisitMutation = useCreateVisit(patientId);
  const sharePMDMutation = useSharePMD();
  const saveChartMutation = useSaveChart(currentVisitId);
  const saveTreatmentMutation = useSaveTreatment(currentVisitId);

  async function handleSelectVisit(visitId: string) {
    setCurrentVisitId(visitId);
    clearSelection();
  }

  function handleNewVisit() {
    const branchId = localStorage.getItem('currentBranchId');
    const dentistMemberId = localStorage.getItem('currentMemberId');
    if (!branchId || !dentistMemberId) {
      console.error('Cannot create visit: currentBranchId or currentMemberId missing from localStorage');
      return;
    }
    createVisitMutation.mutate(
      {
        patientId,
        branchId,
        dentistMemberId,
      },
      {
        onSuccess: (visit) => {
          setCurrentVisitId(visit.id);
        },
      },
    );
  }

  function handleSharePMD() {
    if (!currentVisitId) return;
    sharePMDMutation.mutate(
      { visitId: currentVisitId, patientId },
      {
        onSuccess: (pmd) => {
          if (navigator.share) {
            navigator.share({
              title: 'Portable Medical Document',
              text: `PMD for visit — Checksum: ${pmd.checksum}`,
            }).catch(() => {});
          }
          setPmdShared(true);
        },
      },
    );
  }

  function handleSaveToothData(data: ToothSlideoutData) {
    if (!currentVisitId || !selectedTooth) return;

    // Build updated teeth array
    const updatedTeeth: ToothData[] = [...teeth];
    const idx = updatedTeeth.findIndex((t) => t.toothNumber === selectedTooth);
    const toothEntry: ToothData = {
      toothNumber: selectedTooth,
      state: data.state as ToothData['state'],
      surfaces: data.surfaces,
      conditionCode: data.conditionCode,
    };
    if (idx >= 0) updatedTeeth[idx] = toothEntry;
    else updatedTeeth.push(toothEntry);

    // BUG-06: validate price before save — reject NaN, don't silently coerce
    let priceAmount: number | undefined;
    if (data.cdtCode && data.description && data.priceInput !== undefined && data.priceInput !== '') {
      const raw = parseFloat(data.priceInput);
      if (isNaN(raw)) {
        console.error('Invalid price input — treatment not saved');
        return;
      }
      priceAmount = raw;
    }

    // WR-02: chain saves sequentially — treatment fires only after chart succeeds
    saveChartMutation.mutate(
      { visitId: currentVisitId, patientId, teeth: updatedTeeth },
      {
        onSuccess: () => {
          clearSelection();
          // Add treatment only if procedure was fully specified and price is valid
          if (data.cdtCode && data.description && priceAmount !== undefined) {
            saveTreatmentMutation.mutate({
              visitId: currentVisitId!,
              patientId,
              cdtCode: data.cdtCode,
              description: data.description,
              toothNumber: selectedTooth!,
              surfaces: data.surfaces,
              conditionCode: data.conditionCode,
              priceAmount,
              currency: 'PHP',
              // Default to 'diagnosed' for new treatments — clinician confirms treatment during session.
              // 'planned' is used for future treatments scheduled via treatment plan UI (future PR).
              status: 'diagnosed',
            });
          }
        },
      },
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (visitsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading workspace…</span>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const totalAmount = treatments.reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);
  const pendingCount = treatments.filter(
    (t) => t.status === 'diagnosed' || t.status === 'planned',
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Workspace tabs */}
      <div className="shrink-0 border-b px-4 pt-2">
        <WorkspaceTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Timeline Carousel */}
      <div className="shrink-0 border-b bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between">
          <TimelineCarousel
            visits={visits}
            currentVisitId={currentVisitId ?? undefined}
            onSelectVisit={handleSelectVisit}
            onNewVisit={handleNewVisit}
          />
          {isReadOnly && (
            <button
              type="button"
              data-testid="share-pmd-btn"
              onClick={handleSharePMD}
              className="mr-4 shrink-0 text-xs font-medium text-primary hover:underline flex items-center gap-1"
              aria-label="Share PMD"
            >
              {pmdShared ? '✓ PMD shared' : 'Share PMD'}
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Dental Chart + Treatment List zone */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {activeTab === 'odontogram' && currentVisitId ? (
              <DentalChart
                teeth={teeth}
                selectedTooth={selectedTooth}
                onSelectTooth={selectTooth}
              />
            ) : activeTab === 'odontogram' ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Select or create a visit to begin.
                </p>
              </div>
            ) : activeTab === 'notes' ? (
              <MedicalHistoryForm patientId={patientId} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground capitalize">
                  {activeTab.replace('-', ' ')} — coming in PR2
                </p>
              </div>
            )}
          </div>

          {/* Treatment list */}
          {treatments.length > 0 && (
            <div className="shrink-0 border-t max-h-48 overflow-y-auto bg-background">
              <table className="w-full text-sm" aria-label="Treatments">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Tooth
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      CDT
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Description
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((t) => (
                    <tr key={t.id} className="border-t border-border/40 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{t.toothNumber ?? '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {t.cdtCode ?? t.procedureCode ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">
                        {t.description ?? t.procedureName ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {CURRENCY_SYMBOL}
                        {(t.priceAmount ?? 0).toLocaleString(APP_LOCALE)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : t.status === 'diagnosed' || t.status === 'planned'
                              ? 'bg-blue-100 text-blue-700'
                              : t.status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tooth Slideout */}
        <ToothSlideout
          toothNumber={selectedTooth}
          open={selectedTooth !== null && currentVisitId !== null}
          onClose={clearSelection}
          onSave={handleSaveToothData}
          readOnly={isReadOnly}
        />
      </div>

      {/* Payment footer */}
      <footer className="flex h-14 shrink-0 items-center justify-between border-t px-4 backdrop-blur-xl bg-white/70 supports-[backdrop-filter]:bg-white/70">
        <span className="text-sm text-muted-foreground" data-testid="treatment-summary">
          {treatments.length === 0
            ? 'No treatments recorded'
            : `${treatments.length} treatment${treatments.length !== 1 ? 's' : ''} · ${CURRENCY_SYMBOL}${totalAmount.toLocaleString(APP_LOCALE)}`}
        </span>
        <button
          type="button"
          disabled={pendingCount === 0 && !isReadOnly}
          onClick={() => navigate({ to: '/billing' })}
          className="rounded-lg bg-lemon px-5 py-2 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover min-h-[44px] disabled:opacity-50"
          data-testid="continue-to-payment-btn"
        >
          {isReadOnly ? 'View Invoice' : `Continue to Payment (${pendingCount})`}
        </button>
      </footer>
    </div>
  );
}
