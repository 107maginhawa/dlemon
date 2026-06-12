/**
 * Workspace Route — /_workspace/$patientId
 *
 * Full-screen clinical workspace for a patient visit.
 * Layout: TopBar → YearFilter → 3D Carousel → Divider → TreatmentTable → Footer
 * Sheets: Notes, TreatmentPlan, Rx, Consent, Lab, PMD, Attachments, Payment
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import { createFileRoute, useNavigate, Link, Outlet, useChildMatches } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { TimelineCarousel } from '@/features/workspace/components/timeline-carousel';
import { ToothSlideout } from '@/features/workspace/components/tooth-slideout';
import { SoapNotesSheet } from '@/features/workspace/components/soap-notes-sheet';
import { MedicalHistorySheet } from '@/features/workspace/components/medical-history-sheet';
import { useMedicalHistory } from '@/features/workspace/hooks/use-medical-history';
import { PreCompletionChecklist } from '@/features/workspace/components/pre-completion-checklist';
import { RxSheet } from '@/features/workspace/components/rx-sheet';
import { ConsentSheet } from '@/features/workspace/components/consent-sheet';
import { LabOrdersSheet } from '@/features/workspace/components/lab-orders-sheet';
import { AttachmentsSheet } from '@/features/workspace/components/attachments-sheet';
import { WorkspacePaymentModal } from '@/features/workspace/components/workspace-payment-modal';
import { PaymentSummaryBar } from '@/features/workspace/components/payment-summary-bar';
import { PMDViewerSheet } from '@/features/pmd/components/pmd-viewer-sheet';
import { PMDImport } from '@/features/pmd/components/pmd-import';
import { TreatmentPlanTab } from '@/features/workspace/components/treatment-plan-tab';
import { TreatmentTable } from '@/features/workspace/components/treatment-table';
import { CarryOverPrompt } from '@/features/workspace/components/carry-over-prompt';
import { WorkspaceImagingOverlay } from '@/features/workspace/components/workspace-imaging-overlay';
import { PerioChartOverlay } from '@/features/workspace/components/perio/perio-chart-overlay';
import { WorkspaceTopBar } from '@/features/workspace/components/workspace-top-bar';
import { YearSegmentControl } from '@/features/workspace/components/year-segment-control';
import { useVisits } from '@/features/workspace/hooks/use-visits';
import { useDentalChart } from '@/features/workspace/hooks/use-dental-chart-query';
import { usePatientProfile } from '@/hooks/use-patient-profile';
import { useTreatments } from '@/features/workspace/hooks/use-treatments';
import { useTreatmentPlan } from '@/features/workspace/hooks/use-treatment-plan';
import { usePreviousVisitDeferred } from '@/features/workspace/hooks/use-previous-visit-deferred';
import { useConsentTemplates } from '@/features/settings/hooks/use-consent-templates';
import { useCreateVisit } from '@/features/workspace/hooks/use-create-visit';
import { findOpenVisit, NEW_VISIT_DISABLED_HINT } from '@/features/workspace/lib/visit-status';
import { deriveChartLayerSets } from '@/features/workspace/lib/chart-layers';
import { explainToothLayer } from '@/features/workspace/components/tooth-layer-explanation';
import { useDiscardVisit } from '@/features/workspace/hooks/use-discard-visit';
import { toast } from 'sonner';
import { useSharePMD } from '@/features/workspace/hooks/use-share-pmd';
import { useSaveToothFlow } from '@/features/workspace/hooks/use-save-tooth-flow';
import { useMarkTreatmentDone } from '@/features/workspace/hooks/use-mark-treatment-done';
import { usePMD } from '@/features/workspace/hooks/use-pmd';
import { useOrgContextStore } from '@/stores/org-context.store';
import { canCreateGeneralVisit, canCreateHygieneVisit, type DentalRole } from '@/lib/rbac';
import { RecallsSheet } from '@/features/workspace/components/recalls-sheet';
import { TreatmentPlansSheet } from '@/features/workspace/components/treatment-plans-sheet';
import { SyncStatusBadge } from '@/features/workspace/components/sync-status-badge';
import { ChartConflictBanner } from '@/features/workspace/components/chart-conflict-banner';
import { useChartConflicts } from '@/features/workspace/hooks/use-chart-conflicts';
import { ChartExportOverlay } from '@/features/workspace/components/chart-export-overlay';

export const Route = createFileRoute('/_workspace/$patientId')({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { patientId } = Route.useParams();

  // case-presentation G1: this workspace route is the layout PARENT of the
  // nested `/case-presentation/$presentationId` route (TanStack flat routing).
  // Without an Outlet, navigating to a child route changed the URL but rendered
  // nothing — the patient-facing case-presentation view was unreachable, so the
  // accept workflow could never complete from the UI. When a child route is
  // active, render it full-screen in place of the workspace chart.
  const childMatches = useChildMatches();
  const hasChildRoute = childMatches.length > 0;

  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [pmdShared, setPmdShared] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

  // ── Sheet open/close state ──────────────────────────────────────────────────
  const [rxSheetOpen, setRxSheetOpen] = useState(false);
  const [consentSheetOpen, setConsentSheetOpen] = useState(false);
  const [labOrdersSheetOpen, setLabOrdersSheetOpen] = useState(false);
  const [pmdViewerOpen, setPmdViewerOpen] = useState(false);
  const [pmdImportOpen, setPmdImportOpen] = useState(false);
  const [medicalHistoryOpen, setMedicalHistoryOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [notesSheetOpen, setNotesSheetOpen] = useState(false);
  const [treatmentPlanSheetOpen, setTreatmentPlanSheetOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [imagingOpen, setImagingOpen] = useState(false);
  const [recallsOpen, setRecallsOpen] = useState(false);
  const [perioOpen, setPerioOpen] = useState(false);
  const [treatmentPlansOpen, setTreatmentPlansOpen] = useState(false);
  const [chartExportOpen, setChartExportOpen] = useState(false);
  // FIX-002: carry-over prompt shown at the new-visit entry point (returning patient).
  const [carryOverPromptOpen, setCarryOverPromptOpen] = useState(false);
  // When Save & Next is used: keep slideout panel open while user taps the next tooth
  const [slideoutKeepOpen, setSlideoutKeepOpen] = useState(false);

  // prescriberMemberId for RxSheet (WBAR-02) — reactive selector
  const prescriberMemberId = useOrgContextStore(s => s.memberId) ?? '';
  const orgRole = useOrgContextStore(s => s.role);

  // branchId for treatment plan (TXPL-01) + visits — reactive selector
  const branchId = useOrgContextStore(s => s.branchId);

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { data: patientProfile } = usePatientProfile({ patientId });
  const { visits, isLoading: visitsLoading } = useVisits({ patientId, branchId });
  const { teeth, selectedTooth, selectTooth, clearSelection } =
    useDentalChart({ visitId: currentVisitId });
  const { treatments } = useTreatments({ visitId: currentVisitId });
  const { data: treatmentPlan } = useTreatmentPlan({ patientId, branchId });
  // FR8.4b: branch-configured consent templates feed the ConsentSheet picker so
  // clinicians present this clinic's own consent text, not a hardcoded list.
  const { templates: consentTemplates } = useConsentTemplates(branchId ?? '');
  // GAP-5 / FR1.12: the patient's active allergies (same safety-floor cache the top
  // bar reads — react-query dedupes the key) feed the RxSheet's pre-submit allergy
  // block. Sourced here so the sheet stays prop-pure.
  const { entries: medicalHistoryEntries } = useMedicalHistory(patientId);
  const patientAllergies = medicalHistoryEntries
    .filter((e) => e.active && e.entryType === 'allergy')
    .map((e) => e.displayName);

  // P0-A: open offline chart conflicts (rejected stale writes) for this patient.
  const { conflictedTeeth } = useChartConflicts(patientId);
  const { data: currentPMD } = usePMD(currentVisitId);

  // Auto-select active or most recent visit once visits load
  useEffect(() => {
    if (!visits.length) return;
    if (currentVisitId) return; // already selected
    const active = visits.find((v) => v.status === 'active');
    setCurrentVisitId((active ?? visits[0])?.id ?? null);
  }, [visits, currentVisitId]);

  const currentVisit = visits.find((v) => v.id === currentVisitId);
  // The patient's open (active/draft) visit, computed from the FULL list — never
  // the year-filtered list, or an active visit hidden by the filter would falsely
  // re-enable "New Visit". Gates the New Visit affordance (one-active-visit rule).
  const openVisit = findOpenVisit(visits);
  const isReadOnly =
    currentVisit?.status === 'completed' || currentVisit?.status === 'locked';
  const carriedOverItems = treatmentPlan?.treatments.filter((t) => t.carriedOver) ?? [];
  // FIX-002: deferred (dismissed) treatments from the previous visit, restorable into a
  // freshly-started visit. The completion gate means a completed prior visit never retains
  // diagnosed/planned work, so the carry-over path is restore-dismissed (FR1.11). Gates the
  // prompt so a patient with nothing deferred is never prompted.
  const { deferredIds: carryOverDeferredIds } = usePreviousVisitDeferred({ visits, currentVisitId });

  // ── Year filter ───────────────────────────────────────────────────────────
  const years = [
    'All',
    ...Array.from(
      new Set(visits.map((v) => new Date(v.createdAt).getFullYear().toString()))
    )
      .sort()
      .reverse(),
  ];

  const filteredVisits =
    yearFilter === 'All'
      ? visits
      : visits.filter(
          (v) => new Date(v.createdAt).getFullYear().toString() === yearFilter
        );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createVisitMutation = useCreateVisit(patientId);
  const discardVisitMutation = useDiscardVisit(patientId);
  const sharePMDMutation = useSharePMD();
  const { saveToothData } = useSaveToothFlow({
    visitId: currentVisitId,
    patientId,
    teeth,
    selectedTooth,
    onSuccess: () => { clearSelection(); setSlideoutKeepOpen(false); },
  });

  const { markDone } = useMarkTreatmentDone();

  function handleSaveAndNext() {
    clearSelection();            // clear tooth selection — wizard resets via useEffect
    setSlideoutKeepOpen(true);   // keep panel visible; shows "tap a tooth" placeholder
  }

  async function handleSelectVisit(visitId: string) {
    setCurrentVisitId(visitId);
    clearSelection();
  }

  function handleNewVisit() {
    // Defense-in-depth: the one-active-visit rule means a new visit can't be created
    // while one is open. The button is disabled in that state, but guard here too —
    // resume the open visit instead of firing a guaranteed-fail POST.
    if (openVisit) {
      setCurrentVisitId(openVisit.id);
      return;
    }
    const { branchId: localBranchId, memberId: dentistMemberId, role } = useOrgContextStore.getState();
    if (!localBranchId || !dentistMemberId) {
      // CR-01: surface the failure instead of silently returning.
      toast.error('Branch context unavailable — re-select your branch to start a visit.');
      return;
    }
    // E3: choose a visitType the caller is actually authorized to create so the
    // affordance is honest. A hygienist (who lacks general-create authority) starts
    // a HYGIENE visit — the only visit type they may own. Dentists create GENERAL
    // visits exactly as before. (Roles that can create neither are a pre-existing
    // concern handled by the hook-level error toast — not expanded here.)
    const dentalRole = role as DentalRole | null;
    const visitType: 'general' | 'hygiene' =
      dentalRole && !canCreateGeneralVisit(dentalRole) && canCreateHygieneVisit(dentalRole)
        ? 'hygiene'
        : 'general';
    createVisitMutation.mutate(
      { patientId, branchId: localBranchId, dentistMemberId, visitType },
      {
        // Navigation-only callback; error feedback is handled hook-level in
        // useCreateVisit (V-FE-ERR-001) — a call-site onError here would
        // double-toast on failure.
        onSuccess: (visit) => {
          setCurrentVisitId(visit.id);
          // FIX-002: at the new-visit entry point, offer to carry the patient's prior
          // pending treatments into this visit. The prompt self-hides when there are none.
          setCarryOverPromptOpen(true);
        },
      },
    );
  }

  function handleDiscardVisit() {
    if (!openVisit) return;
    const reason = window.prompt(
      'Discard this visit? Its pending treatments will be dismissed. This cannot be undone.\n\nReason (required, min 5 chars):',
    );
    if (reason == null) return; // cancelled
    if (reason.trim().length < 5) {
      toast.error('A reason of at least 5 characters is required to discard a visit.');
      return;
    }
    discardVisitMutation.discard(openVisit.id, reason.trim()).then(() => {
      setCurrentVisitId(null); // let the auto-select effect pick the next visit
    }).catch(() => { /* error surfaced by the hook */ });
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
            }).then(() => {
              setPmdShared(true);
            }).catch((err) => {
              if (err?.name !== 'AbortError') {
                console.error('Share failed:', err);
              }
            });
          } else {
            setPmdShared(true);
          }
        },
      },
    );
  }


  // A nested route (e.g. case-presentation) is active → hand the screen to it.
  // Placed after all hooks to respect the rules of hooks.
  if (hasChildRoute) {
    return <Outlet />;
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
  // CHART-XV: the chart is a cumulative living document. Its Completed / Proposed /
  // Declined layers come from the patient's treatments across ALL visits (the
  // treatment-plan aggregate), not the current visit alone — so prior-visit
  // performed work shows done, and prior-visit pending work shows carried over.
  const chartLayers = deriveChartLayerSets(treatmentPlan);

  // P0-D: explain why the selected tooth shows its odontogram layer/color. Derived
  // from the SAME resolveToothLayer the chart renders with (via explainToothLayer),
  // so the words shown in the slideout can't disagree with the rendered color.
  const selectedToothLayerExplanation = selectedTooth != null
    ? explainToothLayer(
        selectedTooth,
        teeth.find((t) => t.toothNumber === selectedTooth)?.entryClassification,
        chartLayers,
      )
    : undefined;

  // FIX-007: the original record an amendment references. For the read-only tooth
  // review this is the selected tooth's treatment record on the current visit. The
  // amendment validator requires a real UUID, so the slideout only offers
  // "Add Amendment" when this resolves (see ToothSlideout `canAmend`).
  const selectedToothRecordId =
    selectedTooth != null
      ? treatments.find((t) => t.toothNumber === selectedTooth)?.id
      : undefined;

  const currentVisitDate = currentVisit
    ? new Date(currentVisit.createdAt).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar with patient avatar + safety floor */}
      <WorkspaceTopBar
        patientId={patientId}
        visitDate={currentVisitDate}
        onRx={() => setRxSheetOpen(true)}
        onConsent={() => setConsentSheetOpen(true)}
        onLab={() => setLabOrdersSheetOpen(true)}
        onPmd={() => setPmdViewerOpen(true)}
        onAttachments={() => setAttachmentsOpen(true)}
        onNotes={() => setNotesSheetOpen(true)}
        onTreatmentPlan={() => setTreatmentPlanSheetOpen(true)}
        onCompleteVisit={() => setChecklistOpen(true)}
        visitStatus={currentVisit?.status}
      />

      {/* Year filter */}
      <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 border-b bg-background/80">
        <YearSegmentControl
          years={years}
          selectedYear={yearFilter}
          onSelect={setYearFilter}
        />
        {/* Imaging tab trigger */}
        <button
          type="button"
          data-testid="imaging-tab-btn"
          onClick={() => setImagingOpen(true)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          Imaging
        </button>

        {/* P0-1: Perio tab trigger — per-visit, disabled without an active visit */}
        <button
          type="button"
          data-testid="perio-tab-btn"
          onClick={() => setPerioOpen(true)}
          disabled={currentVisitId === null}
          title={currentVisitId === null ? 'Select a visit to chart perio' : 'Periodontal chart'}
          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
        >
          Perio
        </button>

        {/* B3: Recalls tab trigger */}
        <button
          type="button"
          data-testid="recalls-tab-btn"
          onClick={() => setRecallsOpen(true)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          Recalls
        </button>

        {/* B4: Treatment Plans tab trigger */}
        <button
          type="button"
          data-testid="treatment-plans-tab-btn"
          onClick={() => setTreatmentPlansOpen(true)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          Plans
        </button>

        {/* P0-B: structured chart export (print-ready) for the current visit */}
        {currentVisitId && (
          <button
            type="button"
            data-testid="chart-export-btn"
            onClick={() => setChartExportOpen(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
          >
            Export
          </button>
        )}

        {/* B5: Sync status badge */}
        <SyncStatusBadge branchId={branchId ?? null} />

        {/* PROF-04: View Profile link */}
        <Link
          to="/patients/$patientId"
          params={{ patientId }}
          data-testid="view-profile-link"
          className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          Profile
        </Link>
        {isReadOnly && (
          <button
            type="button"
            data-testid="share-pmd-btn"
            onClick={handleSharePMD}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            aria-label="Share PMD"
          >
            {pmdShared ? '✓ PMD shared' : 'Share PMD'}
          </button>
        )}
      </div>

      {/* Carousel + table zone */}
      <div
        className="flex-1 flex flex-col overflow-visible"
        style={{ paddingRight: (selectedTooth !== null || slideoutKeepOpen) ? 340 : 0, transition: 'padding-right 300ms ease-out' }}
      >
        {/* Carousel section */}
        <div
          data-testid="workspace-carousel-zone"
          className="shrink-0 border-b bg-background/80 backdrop-blur overflow-visible"
        >
          {/* P0-A: data-integrity banner — rejected offline edits accumulate
              invisibly without this. Surfaces + resolves them. */}
          <ChartConflictBanner patientId={patientId} />
          {openVisit && (
            <div
              data-testid="visit-in-progress-indicator"
              className="flex items-center gap-2 px-4 pt-2 text-xs font-medium text-green-700"
            >
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
              Visit in progress — finish or discard it to start a new one.
              {orgRole === 'dentist_owner' && (
                <button
                  type="button"
                  data-testid="discard-visit-btn"
                  onClick={handleDiscardVisit}
                  disabled={discardVisitMutation.isPending}
                  className="ml-2 rounded-md border border-destructive/40 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  Discard visit
                </button>
              )}
            </div>
          )}
          <TimelineCarousel
            visits={filteredVisits}
            patientId={patientId}
            currentVisitId={currentVisitId ?? undefined}
            onSelectVisit={handleSelectVisit}
            onNewVisit={handleNewVisit}
            newVisitDisabledHint={openVisit ? NEW_VISIT_DISABLED_HINT : undefined}
            onSelectTooth={selectTooth}
            panelOpen={false}
            patientDateOfBirth={patientProfile?.dateOfBirth}
            completedToothNumbers={chartLayers.completed}
            proposedToothNumbers={chartLayers.proposed}
            declinedToothNumbers={chartLayers.declined}
            carriedOverToothNumbers={chartLayers.carriedOver}
            conflictedToothNumbers={conflictedTeeth}
          />
        </div>

        {/* Treatment table section */}
        <div
          data-testid="workspace-table-zone"
          className="flex-1 min-w-0 bg-background overflow-auto"
        >
          <TreatmentTable
            visitId={currentVisitId ?? undefined}
            treatments={treatments}
            carriedOverItems={carriedOverItems}
            visits={visits}
            selectedTooth={selectedTooth}
            onClearToothFilter={clearSelection}
            onMarkDone={(treatmentId, visitId, currentStatus) =>
              markDone(treatmentId, visitId, currentStatus as Parameters<typeof markDone>[2])
            }
          />
        </div>
      </div>

      {/* Tooth Slideout — fixed right sidebar */}
      <ToothSlideout
        toothNumber={selectedTooth}
        patientId={patientId}
        open={(selectedTooth !== null || slideoutKeepOpen) && currentVisitId !== null}
        onClose={() => { clearSelection(); setSlideoutKeepOpen(false); }}
        onSave={saveToothData}
        onSaveAndNext={handleSaveAndNext}
        readOnly={isReadOnly}
        visitId={currentVisitId ?? undefined}
        originalRecordId={selectedToothRecordId}
        layerExplanation={selectedToothLayerExplanation}
      />

      {/* Footer */}
      <PaymentSummaryBar
        treatments={treatments}
        isReadOnly={isReadOnly}
        onContinue={() => setPaymentModalOpen(true)}
      />

      {/* ── Sheet overlays ──────────────────────────────────────────────────── */}

      {/* Notes sheet (from top bar) — SoapNotesSheet with Medical History accessible via onOpenMedicalHistory */}
      {currentVisitId && (
        <SoapNotesSheet
          visitId={currentVisitId}
          visitType={currentVisit?.visitType === 'hygiene' ? 'hygiene' : 'general'}
          open={notesSheetOpen}
          onClose={() => setNotesSheetOpen(false)}
          onOpenMedicalHistory={() => {
            setNotesSheetOpen(false);
            setMedicalHistoryOpen(true);
          }}
        />
      )}

      {/* Medical history intake (conditions/meds/allergies/ASA) — opened from SoapNotesSheet */}
      <MedicalHistorySheet
        patientId={patientId}
        open={medicalHistoryOpen}
        onClose={() => setMedicalHistoryOpen(false)}
      />

      {/* Treatment Plan sheet (from top bar) */}
      {treatmentPlanSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setTreatmentPlanSheetOpen(false)}>
          <div
            className="bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[85vh] overflow-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Treatment Plan</h2>
              <button type="button" onClick={() => setTreatmentPlanSheetOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">×</button>
            </div>
            <TreatmentPlanTab patientId={patientId} branchId={branchId} />
          </div>
        </div>
      )}

      {/* Imaging tab overlay */}
      <WorkspaceImagingOverlay
        patientId={patientId}
        branchId={branchId ?? ''}
        currentVisitId={currentVisitId}
        open={imagingOpen}
        onClose={() => setImagingOpen(false)}
      />

      {/* WBAR-02: RxSheet */}
      {currentVisitId && (
        <RxSheet
          visitId={currentVisitId}
          patientId={patientId}
          prescriberMemberId={prescriberMemberId}
          canManage={orgRole === 'dentist_owner' || orgRole === 'dentist_associate'}
          patientAllergies={patientAllergies}
          open={rxSheetOpen}
          onClose={() => setRxSheetOpen(false)}
        />
      )}

      {/* WBAR-03: ConsentSheet */}
      {currentVisitId && (
        <ConsentSheet
          visitId={currentVisitId}
          patientId={patientId}
          currentMemberId={prescriberMemberId}
          templates={consentTemplates.map((t) => ({ id: t.id, name: t.name, body: t.body }))}
          canRevoke={orgRole === 'dentist_owner' || orgRole === 'dentist_associate'}
          open={consentSheetOpen}
          onClose={() => setConsentSheetOpen(false)}
        />
      )}

      {/* WBAR-04: LabOrdersSheet */}
      {currentVisitId && (
        <LabOrdersSheet
          visitId={currentVisitId}
          patientId={patientId}
          open={labOrdersSheetOpen}
          onClose={() => setLabOrdersSheetOpen(false)}
        />
      )}

      {/* WBAR-05: PMDViewerSheet */}
      {currentVisitId && (
        <PMDViewerSheet
          pmd={currentPMD ?? null}
          open={pmdViewerOpen}
          onClose={() => setPmdViewerOpen(false)}
          onImportClick={() => setPmdImportOpen(true)}
        />
      )}

      {/* WBAR-06: PMDImport */}
      {currentVisitId && (
        <PMDImport
          patientId={patientId}
          open={pmdImportOpen}
          onClose={() => setPmdImportOpen(false)}
        />
      )}

      {/* WBAR-07: AttachmentsSheet */}
      {currentVisitId && (
        <AttachmentsSheet
          visitId={currentVisitId}
          patientId={patientId}
          open={attachmentsOpen}
          onClose={() => setAttachmentsOpen(false)}
        />
      )}

      {/* P0-1: Perio chart overlay */}
      {currentVisitId && (
        <PerioChartOverlay
          patientId={patientId}
          visitId={currentVisitId}
          open={perioOpen}
          onClose={() => setPerioOpen(false)}
        />
      )}

      {/* B3: RecallsSheet */}
      <RecallsSheet
        patientId={patientId}
        open={recallsOpen}
        onClose={() => setRecallsOpen(false)}
      />

      {/* B4: TreatmentPlansSheet */}
      <TreatmentPlansSheet
        patientId={patientId}
        open={treatmentPlansOpen}
        onClose={() => setTreatmentPlansOpen(false)}
      />

      {/* P0-B: structured chart export overlay (print-ready) */}
      {currentVisitId && (
        <ChartExportOverlay
          visitId={currentVisitId}
          open={chartExportOpen}
          onClose={() => setChartExportOpen(false)}
        />
      )}

      {/* VISIT-02: PreCompletionChecklist */}
      {currentVisitId && (
        <PreCompletionChecklist
          visitId={currentVisitId}
          patientId={patientId}
          open={checklistOpen}
          onClose={() => setChecklistOpen(false)}
        />
      )}

      {/* PAY-01/PAY-02: WorkspacePaymentModal */}
      <WorkspacePaymentModal
        patientId={patientId}
        visitId={currentVisitId}
        lineItems={treatments.map((t) => ({
          id: t.id,
          description: t.description || '—',
          cdtCode: t.cdtCode,
          toothNumber: t.toothNumber ?? undefined,
          priceCents: Math.round((t.priceAmount ?? 0) * 100),
          status: t.status ?? 'pending',
        }))}
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
      />

      {/* FIX-002: carry-over affordance at the new-visit entry point (returning patient) */}
      <CarryOverPrompt
        open={carryOverPromptOpen}
        visitId={currentVisitId}
        patientId={patientId}
        branchId={branchId}
        deferredIds={carryOverDeferredIds}
        onClose={() => setCarryOverPromptOpen(false)}
      />
    </div>
  );
}
