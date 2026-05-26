/**
 * Workspace Route — /_workspace/$patientId
 *
 * Full-screen clinical workspace for a patient visit.
 * Layout: TopBar → YearFilter → 3D Carousel → Divider → TreatmentTable → Footer
 * Sheets: Notes, TreatmentPlan, Rx, Consent, Lab, PMD, Attachments, Payment
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { TimelineCarousel } from '@/features/workspace/components/timeline-carousel';
import { ToothSlideout } from '@/features/workspace/components/tooth-slideout';
import { SoapNotesSheet } from '@/features/workspace/components/soap-notes-sheet';
import { PreCompletionChecklist } from '@/features/workspace/components/pre-completion-checklist';
import { RxSheet } from '@/features/workspace/components/rx-sheet';
import { ConsentSheet } from '@/features/workspace/components/consent-sheet';
import { LabOrdersSheet } from '@/features/workspace/components/lab-orders-sheet';
import { AttachmentsSheet } from '@/features/workspace/components/attachments-sheet';
import { WorkspacePaymentModal } from '@/features/workspace/components/workspace-payment-modal';
import { PMDViewerSheet } from '@/features/pmd/components/pmd-viewer-sheet';
import { PMDImport } from '@/features/pmd/components/pmd-import';
import { TreatmentPlanTab } from '@/features/workspace/components/treatment-plan-tab';
import { TreatmentTable } from '@/features/workspace/components/treatment-table';
import { PatientImageList } from '@/features/imaging/components/patient-image-list';
import { ImagingWorkspace } from '@/features/imaging/components/imaging-workspace';
import { ComparisonView } from '@/features/imaging/components/comparison-view';
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies';
import { WorkspaceTopBar } from '@/features/workspace/components/workspace-top-bar';
import { YearSegmentControl } from '@/features/workspace/components/year-segment-control';
import { useVisits } from '@/features/workspace/hooks/use-visits';
import { useDentalChart } from '@/features/workspace/hooks/use-dental-chart-query';
import { usePatientProfile } from '@/features/patients/hooks/use-patient-profile';
import { useTreatments } from '@/features/workspace/hooks/use-treatments';
import { useTreatmentPlan } from '@/features/workspace/hooks/use-treatment-plan';
import { useCreateVisit } from '@/features/workspace/hooks/use-create-visit';
import { useSharePMD } from '@/features/workspace/hooks/use-share-pmd';
import { useSaveToothFlow } from '@/features/workspace/hooks/use-save-tooth-flow';
import { useMarkTreatmentDone } from '@/features/workspace/hooks/use-mark-treatment-done';
import { usePMD } from '@/features/workspace/hooks/use-pmd';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { useOrgContextStore } from '@/stores/org-context.store';
import { RecallsSheet } from '@/features/workspace/components/recalls-sheet';
import { TreatmentPlansSheet } from '@/features/workspace/components/treatment-plans-sheet';
import { SyncStatusBadge } from '@/features/workspace/components/sync-status-badge';

export const Route = createFileRoute('/_workspace/$patientId')({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { patientId } = Route.useParams();

  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [pmdShared, setPmdShared] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

  // ── Sheet open/close state ──────────────────────────────────────────────────
  const [rxSheetOpen, setRxSheetOpen] = useState(false);
  const [consentSheetOpen, setConsentSheetOpen] = useState(false);
  const [labOrdersSheetOpen, setLabOrdersSheetOpen] = useState(false);
  const [pmdViewerOpen, setPmdViewerOpen] = useState(false);
  const [pmdImportOpen, setPmdImportOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [notesSheetOpen, setNotesSheetOpen] = useState(false);
  const [treatmentPlanSheetOpen, setTreatmentPlanSheetOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [imagingOpen, setImagingOpen] = useState(false);
  const [recallsOpen, setRecallsOpen] = useState(false);
  const [treatmentPlansOpen, setTreatmentPlansOpen] = useState(false);
  const [selectedImageItem, setSelectedImageItem] = useState<PatientImageItem | null>(null);
  const [comparisonItems, setComparisonItems] = useState<[PatientImageItem, PatientImageItem] | null>(null);
  // When Save & Next is used: keep slideout panel open while user taps the next tooth
  const [slideoutKeepOpen, setSlideoutKeepOpen] = useState(false);

  // prescriberMemberId for RxSheet (WBAR-02) — reactive selector
  const prescriberMemberId = useOrgContextStore(s => s.memberId) ?? '';

  // branchId for treatment plan (TXPL-01) + visits — reactive selector
  const branchId = useOrgContextStore(s => s.branchId);

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { data: patientProfile } = usePatientProfile({ patientId });
  const { visits, isLoading: visitsLoading } = useVisits({ patientId, branchId });
  const { teeth, selectedTooth, selectTooth, clearSelection } =
    useDentalChart({ visitId: currentVisitId });
  const { treatments } = useTreatments({ visitId: currentVisitId });
  const { data: treatmentPlan } = useTreatmentPlan({ patientId, branchId });
  const { data: currentPMD } = usePMD(currentVisitId);

  // Auto-select active or most recent visit once visits load
  useEffect(() => {
    if (!visits.length) return;
    if (currentVisitId) return; // already selected
    const active = visits.find((v) => v.status === 'active');
    setCurrentVisitId((active ?? visits[0])?.id ?? null);
  }, [visits, currentVisitId]);

  const currentVisit = visits.find((v) => v.id === currentVisitId);
  const isReadOnly =
    currentVisit?.status === 'completed' || currentVisit?.status === 'locked';
  const carriedOverItems = treatmentPlan?.treatments.filter((t) => t.carriedOver) ?? [];

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
    const { branchId: localBranchId, memberId: dentistMemberId } = useOrgContextStore.getState();
    if (!localBranchId || !dentistMemberId) {
      console.error('Cannot create visit: branchId or memberId missing from org context store');
      return;
    }
    createVisitMutation.mutate(
      { patientId, branchId: localBranchId, dentistMemberId },
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
          <TimelineCarousel
            visits={filteredVisits}
            patientId={patientId}
            currentVisitId={currentVisitId ?? undefined}
            onSelectVisit={handleSelectVisit}
            onNewVisit={handleNewVisit}
            onSelectTooth={selectTooth}
            panelOpen={false}
            patientDateOfBirth={patientProfile?.dateOfBirth}
          />
        </div>

        {/* Treatment table section */}
        <div
          data-testid="workspace-table-zone"
          className="flex-1 min-w-0 bg-background overflow-auto"
        >
          <TreatmentTable
            treatments={treatments}
            carriedOverItems={carriedOverItems}
            visits={visits}
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
      />

      {/* Footer */}
      <footer className="flex h-14 shrink-0 items-center justify-between border-t px-4 backdrop-blur-xl bg-white/70 supports-[backdrop-filter]:bg-white/70">
        <span className="text-sm text-muted-foreground" data-testid="treatment-summary">
          {pendingCount === 0
            ? 'No pending treatments'
            : `${pendingCount} pending · `}
          {pendingCount > 0 && (
            <span className="font-semibold text-foreground">
              {CURRENCY_SYMBOL}{totalAmount.toLocaleString(APP_LOCALE)}
            </span>
          )}
        </span>

        {/* PAY-01/PAY-02: open payment modal inline */}
        <button
          type="button"
          disabled={treatments.length === 0 && !isReadOnly}
          onClick={() => setPaymentModalOpen(true)}
          className="rounded-lg bg-lemon px-5 py-2 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover min-h-[44px] disabled:opacity-50"
          data-testid="continue-to-payment-btn"
        >
          {isReadOnly ? 'View Invoice' : `Continue to Payment (${pendingCount})`}
        </button>
      </footer>

      {/* ── Sheet overlays ──────────────────────────────────────────────────── */}

      {/* Notes sheet (from top bar) — SoapNotesSheet with Medical History accessible via onOpenMedicalHistory */}
      {currentVisitId && (
        <SoapNotesSheet
          visitId={currentVisitId}
          open={notesSheetOpen}
          onClose={() => setNotesSheetOpen(false)}
          onOpenMedicalHistory={() => {
            setNotesSheetOpen(false);
            setPmdImportOpen(true);
          }}
        />
      )}

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
      {imagingOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="imaging-overlay">
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <h2 className="text-sm font-semibold">Imaging</h2>
            <button
              type="button"
              onClick={() => { setImagingOpen(false); setSelectedImageItem(null); setComparisonItems(null); }}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close imaging"
            >
              ×
            </button>
          </div>
          <div className="flex flex-1 min-h-0">
            <PatientImageList
              patientId={patientId}
              branchId={branchId ?? ''}
              onSelectImage={(item) => setSelectedImageItem(item)}
              onCompare={(items) => { setComparisonItems(items); setSelectedImageItem(null); }}
            />
            <div className="flex-1 min-w-0">
              {comparisonItems ? (
                <ComparisonView
                  imageA={comparisonItems[0]}
                  imageB={comparisonItems[1]}
                  onClose={() => setComparisonItems(null)}
                />
              ) : selectedImageItem ? (
                <ImagingWorkspace
                  imageId={selectedImageItem.id}
                  imageUrl={selectedImageItem.fileName}
                  className="h-full w-full"
                  visitId={currentVisitId ?? ''}
                  patientId={patientId}
                  branchId={branchId ?? ''}
                  modality={selectedImageItem.modality}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select an image to view
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WBAR-02: RxSheet */}
      {currentVisitId && (
        <RxSheet
          visitId={currentVisitId}
          patientId={patientId}
          prescriberMemberId={prescriberMemberId}
          open={rxSheetOpen}
          onClose={() => setRxSheetOpen(false)}
        />
      )}

      {/* WBAR-03: ConsentSheet */}
      {currentVisitId && (
        <ConsentSheet
          visitId={currentVisitId}
          patientId={patientId}
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
          description: t.description ?? t.procedureName ?? '—',
          cdtCode: t.cdtCode ?? t.procedureCode,
          toothNumber: t.toothNumber ?? undefined,
          priceCents: Math.round((t.priceAmount ?? 0) * 100),
          status: t.status ?? 'pending',
        }))}
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
      />
    </div>
  );
}
