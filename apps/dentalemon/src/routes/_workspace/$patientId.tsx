/**
 * Workspace Route — /_workspace/$patientId
 *
 * Full-screen clinical workspace for a patient visit.
 * Layout: TopBar → YearFilter → 3D Carousel → Divider → TreatmentTable → Footer
 * Sheets: Notes, TreatmentPlan, Rx, Consent, Lab, PMD, Attachments, Payment
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import { createFileRoute, Link, Outlet, useChildMatches } from '@tanstack/react-router';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image as ImageIcon,
  Activity,
  Stethoscope,
  CalendarClock,
  ListChecks,
  ClipboardList,
  Download,
} from 'lucide-react';
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
import { isBillable } from '@/features/workspace/lib/billable';
import { PMDViewerSheet } from '@/features/pmd/components/pmd-viewer-sheet';
import { PMDImport } from '@/features/pmd/components/pmd-import';
import { TreatmentPlanTab } from '@/features/workspace/components/treatment-plan-tab';
import { TreatmentTable } from '@/features/workspace/components/treatment-table';
import { ApplyTemplateButton } from '@/features/workspace/components/apply-template-button';
import { CarryOverPrompt } from '@/features/workspace/components/carry-over-prompt';
import { WorkspaceImagingOverlay } from '@/features/workspace/components/workspace-imaging-overlay';
import { PerioChartOverlay } from '@/features/workspace/components/perio/perio-chart-overlay';
import { WorkspaceTopBar } from '@/features/workspace/components/workspace-top-bar';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { YearSegmentControl } from '@/features/workspace/components/year-segment-control';
import { useVisits } from '@/features/workspace/hooks/use-visits';
import { useDentalChart } from '@/features/workspace/hooks/use-dental-chart-query';
import { usePatientProfile } from '@/hooks/use-patient-profile';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { useTreatments } from '@/features/workspace/hooks/use-treatments';
import { useTreatmentPlan } from '@/features/workspace/hooks/use-treatment-plan';
import { usePreviousVisitDeferred } from '@/features/workspace/hooks/use-previous-visit-deferred';
import { useConsentTemplates } from '@/features/settings/hooks/use-consent-templates';
import { useCreateVisit } from '@/features/workspace/hooks/use-create-visit';
import { findOpenVisit, isClosedVisit, NEW_VISIT_DISABLED_HINT } from '@/features/workspace/lib/visit-status';
import { deriveChartLayerSets } from '@/features/workspace/lib/chart-layers';
import { visitToComplete } from '@/features/workspace/lib/next-step';
import { explainToothLayer } from '@/features/workspace/components/tooth-layer-explanation';
import { useDiscardVisit } from '@/features/workspace/hooks/use-discard-visit';
import { DiscardVisitDialog } from '@/features/workspace/components/discard-visit-dialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useSharePMD } from '@/features/workspace/hooks/use-share-pmd';
import { useSaveToothFlow } from '@/features/workspace/hooks/use-save-tooth-flow';
import { useMarkTreatmentDone } from '@/features/workspace/hooks/use-mark-treatment-done';
import { usePMD } from '@/features/workspace/hooks/use-pmd';
import { useOrgContextStore } from '@/stores/org-context.store';
import { canCreateGeneralVisit, canCreateHygieneVisit, type DentalRole } from '@/lib/rbac';
import { RecallsSheet } from '@/features/workspace/components/recalls-sheet';
import { DentalAlertsSheet } from '@/features/workspace/components/dental-alerts-sheet';
import { TasksSheet } from '@/features/workspace/components/tasks-sheet';
import { OcclusionScreeningSheet } from '@/features/workspace/components/occlusion-screening-sheet';
import { TreatmentPlansSheet } from '@/features/workspace/components/treatment-plans-sheet';
import { SyncStatusBadge } from '@/features/workspace/components/sync-status-badge';
import { useChartConflicts } from '@/features/workspace/hooks/use-chart-conflicts';
import { WorkspaceContextStrip } from '@/features/workspace/components/workspace-context-strip';
import { ChartExportOverlay } from '@/features/workspace/components/chart-export-overlay';

export const Route = createFileRoute('/_workspace/$patientId')({
  component: WorkspacePage,
});

// 2.1: shared workspace-toolbar button affordance — icon + label, subtle
// border/background, clear hover/active and disabled states. Replaces the muted
// text links that were indistinguishable from body copy on cold start.
const WORKSPACE_TOOL_BTN =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted active:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background';

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
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [occlusionOpen, setOcclusionOpen] = useState(false);
  const [perioOpen, setPerioOpen] = useState(false);
  const [treatmentPlansOpen, setTreatmentPlansOpen] = useState(false);
  const [chartExportOpen, setChartExportOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  // Item 3: Compare is triggered from the consolidated context strip; the
  // carousel owns the overlay (it has the fetched active-card teeth).
  const [compareOpen, setCompareOpen] = useState(false);
  // FIX-002: carry-over prompt shown at the new-visit entry point (returning patient).
  const [carryOverPromptOpen, setCarryOverPromptOpen] = useState(false);
  // When Save & Next is used: keep slideout panel open while user taps the next tooth
  const [slideoutKeepOpen, setSlideoutKeepOpen] = useState(false);

  // Issue 2: the footer "N pending" affordance routes here — scroll the Treatment
  // Breakdown (its own scroll region) to the top and move focus to it.
  const tableZoneRef = useRef<HTMLDivElement>(null);
  const handleReviewPending = useCallback(() => {
    const el = tableZoneRef.current;
    if (!el) return;
    // The table now flows in the shared scroll container, so bring it into view
    // (was scrollTo on its own scroller, now a no-op since it no longer scrolls).
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.focus();
  }, []);

  // ISSUE-010: the inline Treatment Plan modal is hand-rolled (not Radix) → wire
  // Escape-to-dismiss + focus restore via the shared sheet-a11y hook (stable cb).
  const closeTreatmentPlanSheet = useCallback(() => setTreatmentPlanSheetOpen(false), []);
  const { containerRef: treatmentPlanSheetRef } = useSheetA11y({ open: treatmentPlanSheetOpen, onClose: closeTreatmentPlanSheet });

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
  const isReadOnly = isClosedVisit(currentVisit?.status);
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

  // PP-8 (ISSUE-041): open the accessible discard dialog instead of window.prompt().
  function handleDiscardVisit() {
    if (!openVisit) return;
    setDiscardDialogOpen(true);
  }

  async function handleConfirmDiscard(reason: string) {
    if (!openVisit) return;
    try {
      await discardVisitMutation.discard(openVisit.id, reason);
      setDiscardDialogOpen(false);
      setCurrentVisitId(null); // let the auto-select effect pick the next visit
    } catch {
      // error surfaced by the hook (toast); keep the dialog open for retry
    }
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
                logger.error('patient-share', 'share failed', err);
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
        onAlerts={() => setAlertsOpen(true)}
      />

      {/* Year filter */}
      <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 border-b bg-background/80">
        <YearSegmentControl
          years={years}
          selectedYear={yearFilter}
          onSelect={setYearFilter}
        />
        {/* 2.1: toolbar features as real icon+label buttons (not muted text
            links that read as body copy). Shared affordance class below. */}
        {/* Imaging tab trigger */}
        <button
          type="button"
          data-testid="imaging-tab-btn"
          onClick={() => setImagingOpen(true)}
          className={WORKSPACE_TOOL_BTN}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Imaging
        </button>

        {/* P0-1: Perio tab trigger — per-visit, disabled without an active visit */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="perio-tab-btn"
            onClick={() => setPerioOpen(true)}
            disabled={currentVisitId === null}
            title={currentVisitId === null ? 'Select a visit to chart perio' : 'Periodontal chart'}
            aria-describedby={currentVisitId === null ? 'perio-disabled-hint' : undefined}
            className={WORKSPACE_TOOL_BTN}
          >
            <Activity className="h-3.5 w-3.5" />
            Perio
          </button>
          {/* 2.3: touch devices can't hover a title tooltip — surface the reason inline. */}
          {currentVisitId === null && (
            <span id="perio-disabled-hint" className="text-xs text-muted-foreground">
              Select a visit to chart
            </span>
          )}
        </div>

        {/* PP-7 (ISSUE-044): Occlusion screening tab trigger. v2-deferred. */}
        {isFeatureEnabled('workspace.occlusion') && (
          <button
            type="button"
            data-testid="occlusion-tab-btn"
            onClick={() => setOcclusionOpen(true)}
            className={WORKSPACE_TOOL_BTN}
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Occlusion
          </button>
        )}

        {/* B3: Recalls tab trigger */}
        <button
          type="button"
          data-testid="recalls-tab-btn"
          onClick={() => setRecallsOpen(true)}
          className={WORKSPACE_TOOL_BTN}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Recalls
        </button>

        {/* PP-7 (ISSUE-043): Tasks tab trigger. v2-deferred. */}
        {isFeatureEnabled('workspace.tasks') && (
          <button
            type="button"
            data-testid="tasks-tab-btn"
            onClick={() => setTasksOpen(true)}
            className={WORKSPACE_TOOL_BTN}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Tasks
          </button>
        )}

        {/* B4: Treatment Plans tab trigger. N1: "Plan docs" disambiguates from the
            top-bar "Treatment Plan" working list. v2-deferred (FSM plan docs +
            case-presentation; verified independent of the v1 Estimate flow). */}
        {isFeatureEnabled('workspace.plan_docs') && (
          <button
            type="button"
            data-testid="treatment-plans-tab-btn"
            onClick={() => setTreatmentPlansOpen(true)}
            className={WORKSPACE_TOOL_BTN}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Plan docs
          </button>
        )}

        {/* P0-B: structured chart export (print-ready). v2-deferred. When ON:
            disabled + explained when no visit is selected (mirrors Perio). */}
        {isFeatureEnabled('workspace.chart_export') && (
          <button
            type="button"
            data-testid="chart-export-btn"
            onClick={() => setChartExportOpen(true)}
            disabled={currentVisitId === null}
            title={currentVisitId === null ? 'Select a visit to export the chart' : 'Export the chart'}
            className={WORKSPACE_TOOL_BTN}
          >
            <Download className="h-3.5 w-3.5" />
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

      {/* Carousel + table zone — ONE vertical scroll container. The chart is tall
          (~64vh); on short viewports a separate inner table scroller collapsed the
          Treatment Breakdown to an unreachable sliver. Scrolling the whole zone lets
          the chart move up to reveal the table, so every treatment row (and its Mark
          Done) can be brought fully into view. */}
      <div
        className="flex-1 flex flex-col min-h-0 overflow-y-auto"
        // Reserve a gutter so table rows aren't hidden under the fixed 340px tooth
        // slide-out. Snap it (no transition): animating padding-right reflowed the
        // tall chart every frame, and the slide-out itself appears instantly, so the
        // gutter and panel now land together. ponytail: transform-based slide-in is a
        // future polish, not a perf requirement.
        style={{ paddingRight: (selectedTooth !== null || slideoutKeepOpen) ? 340 : 0 }}
      >
        {/* Carousel section */}
        <div
          data-testid="workspace-carousel-zone"
          className="shrink-0 border-b bg-background/80 backdrop-blur overflow-visible"
        >
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
            openVisitId={openVisit?.id}
            completedToothNumbers={chartLayers.completed}
            proposedToothNumbers={chartLayers.proposed}
            declinedToothNumbers={chartLayers.declined}
            carriedOverToothNumbers={chartLayers.carriedOver}
            conflictedToothNumbers={conflictedTeeth}
            compareOpen={compareOpen}
            onCompareOpenChange={setCompareOpen}
          />
        </div>

        {/* Items 3 + 4: consolidated context strip — visit-date anchor,
            status/read-only, gated conflict banner, Compare trigger, and the
            passive state-aware next-step guidance. Rendered ABOVE the scroll
            container (its root is shrink-0) so the date anchor stays visible while
            rows scroll WITHOUT its sticky position overlapping the table's own
            sticky thead (both would otherwise pin at top-0 of one scroller). */}
        <WorkspaceContextStrip
          patientId={patientId}
          visitDate={currentVisitDate}
          currentVisitStatus={currentVisit?.status}
          openVisit={openVisit ?? null}
          currentIsOpen={!!currentVisit && currentVisit.id === openVisit?.id}
          treatmentCount={treatments.length}
          performedCount={treatments.filter(isBillable).length}
          conflictCount={conflictedTeeth.size}
          canCompare={visits.length >= 2 && isFeatureEnabled('workspace.compare')}
          onCompare={() => setCompareOpen(true)}
          onStartVisit={handleNewVisit}
          onComplete={() => {
            // G-02: completion always targets the patient's OPEN visit. In the
            // open-visit-blocker state the user is viewing a historical visit, so
            // select the open visit first — otherwise the checklist (and the
            // completion) would act on the wrong, already-closed visit.
            const target = visitToComplete(currentVisitId, openVisit);
            if (target && target !== currentVisitId) setCurrentVisitId(target);
            setChecklistOpen(true);
          }}
          onDiscard={handleDiscardVisit}
          canDiscard={orgRole === 'dentist_owner'}
        />

        {/* Treatment table section — flows in the shared scroll container above
            (no longer its own scroller), so it can be scrolled fully into view. */}
        <div
          ref={tableZoneRef}
          data-testid="workspace-table-zone"
          tabIndex={-1}
          className="shrink-0 min-w-0 bg-background focus-visible:outline-none"
        >
          {/* #13: apply a treatment template to populate the visit (reachable even
              when the table is empty — the primary apply case). Owner/associate-gated
              inside the component; only shown for an active, editable visit. */}
          {currentVisitId && !isReadOnly && (
            <div className="px-4 pt-3">
              <ApplyTemplateButton visitId={currentVisitId} patientId={patientId} />
            </div>
          )}
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
        onReviewPending={handleReviewPending}
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
        <div ref={treatmentPlanSheetRef} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={closeTreatmentPlanSheet}>
          <div
            className="bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[85vh] overflow-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Treatment Plan</h2>
              <button type="button" aria-label="Close treatment plan" onClick={closeTreatmentPlanSheet} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">×</button>
            </div>
            <TreatmentPlanTab patientId={patientId} branchId={branchId} visitId={currentVisitId} patientName={patientProfile?.displayName} />
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

      {/* PP-7 (ISSUE-042): chairside dental alerts */}
      <DentalAlertsSheet
        patientId={patientId}
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
      />

      {/* PP-7 (ISSUE-043): patient follow-up tasks */}
      <TasksSheet
        patientId={patientId}
        open={tasksOpen}
        onClose={() => setTasksOpen(false)}
      />

      {/* PP-7 (ISSUE-044): occlusion screening */}
      <OcclusionScreeningSheet
        patientId={patientId}
        open={occlusionOpen}
        onClose={() => setOcclusionOpen(false)}
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

      {/* PP-8 (ISSUE-041): reason-gated discard dialog (replaces window.prompt) */}
      <DiscardVisitDialog
        open={discardDialogOpen}
        saving={discardVisitMutation.isPending}
        onClose={() => setDiscardDialogOpen(false)}
        onConfirm={handleConfirmDiscard}
      />
    </div>
  );
}
