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
import React, { useState, useEffect, useRef } from 'react';
import { Pill, FileSignature, FlaskConical, FileText, Upload } from 'lucide-react';
import { TimelineCarousel } from '@/features/workspace/components/timeline-carousel';
import { ToothSlideout } from '@/features/workspace/components/tooth-slideout';
import { MedicalHistoryForm } from '@/features/workspace/components/medical-history-form';
import { RxSheet } from '@/features/workspace/components/rx-sheet';
import { ConsentSheet } from '@/features/workspace/components/consent-sheet';
import { LabOrdersSheet } from '@/features/workspace/components/lab-orders-sheet';
import { AttachmentsSheet } from '@/features/workspace/components/attachments-sheet';
import { WorkspacePaymentModal } from '@/features/workspace/components/workspace-payment-modal';
import { PMDViewerSheet } from '@/features/pmd/components/pmd-viewer-sheet';
import { PMDImport } from '@/features/pmd/components/pmd-import';
import { TreatmentPlanTab } from '@/features/workspace/components/treatment-plan-tab';
import { TreatmentTable } from '@/features/workspace/components/treatment-table';
import { WorkspaceTopBar } from '@/features/workspace/components/workspace-top-bar';
import { YearSegmentControl } from '@/features/workspace/components/year-segment-control';
import { ResizableDivider } from '@/features/workspace/components/resizable-divider';
import { useVisits } from '@/features/workspace/hooks/use-visits';
import { useDentalChart } from '@/features/workspace/hooks/use-dental-chart-query';
import { useTreatments } from '@/features/workspace/hooks/use-treatments';
import { useTreatmentPlan } from '@/features/workspace/hooks/use-treatment-plan';
import { useCreateVisit } from '@/features/workspace/hooks/use-create-visit';
import { useSharePMD } from '@/features/workspace/hooks/use-share-pmd';
import { useSaveToothFlow } from '@/features/workspace/hooks/use-save-tooth-flow';
import { usePMD } from '@/features/workspace/hooks/use-pmd';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { useOrgContextStore } from '@/stores/org-context.store';

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

  // prescriberMemberId for RxSheet (WBAR-02) — read once via ref to avoid stale value on re-renders
  const prescriberMemberId = React.useRef(useOrgContextStore.getState().memberId ?? '').current;

  // branchId for treatment plan (TXPL-01) + visits — read once via ref
  const branchId = React.useRef(useOrgContextStore.getState().branchId).current;

  // ── Data hooks ────────────────────────────────────────────────────────────
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

  // ── Resizable divider ─────────────────────────────────────────────────────
  function handleResize(_delta: number) {
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createVisitMutation = useCreateVisit(patientId);
  const sharePMDMutation = useSharePMD();
  const { saveToothData } = useSaveToothFlow({
    visitId: currentVisitId,
    patientId,
    teeth,
    selectedTooth,
    onSuccess: clearSelection,
  });

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
      />

      {/* Year filter */}
      <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 border-b bg-background/80">
        <YearSegmentControl
          years={years}
          selectedYear={yearFilter}
          onSelect={setYearFilter}
        />
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

      {/* Resizable carousel + table zone */}
      <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
        {/* Carousel section */}
        <div
          data-testid="workspace-carousel-zone"
          className="shrink-0 border-b bg-background/80 backdrop-blur overflow-hidden"
          style={{ minHeight: '200px' }}
        >
          <TimelineCarousel
            visits={filteredVisits}
            currentVisitId={currentVisitId ?? undefined}
            onSelectVisit={handleSelectVisit}
            onNewVisit={handleNewVisit}
            teeth={teeth}
            onSelectTooth={selectTooth}
          />
        </div>

        {/* Resizable divider */}
        <ResizableDivider onResize={handleResize} />

        {/* Treatment table section */}
        <div
          data-testid="workspace-table-zone"
          className="bg-background overflow-auto"
          style={{ minHeight: '150px' }}
        >
          <TreatmentTable
            treatments={treatments}
            carriedOverItems={carriedOverItems}
            visits={visits}
          />
          {/* PROF-04: View Profile link */}
          <Link
            to="/patients/$patientId"
            params={{ patientId }}
            data-testid="view-profile-link"
            className="mr-3 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
          >
            Profile
          </Link>
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

      {/* Tooth Slideout */}
      <ToothSlideout
        toothNumber={selectedTooth}
        open={selectedTooth !== null && currentVisitId !== null}
        onClose={clearSelection}
        onSave={saveToothData}
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

      {/* Notes sheet (from top bar) */}
      {notesSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setNotesSheetOpen(false)}>
          <div
            className="bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] overflow-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Medical History / Notes</h2>
              <button type="button" onClick={() => setNotesSheetOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <MedicalHistoryForm patientId={patientId} />
            <div className="px-4 py-3 border-t">
              <button
                type="button"
                data-testid="import-pmd-from-notes-btn"
                onClick={() => { setNotesSheetOpen(false); setPmdImportOpen(true); }}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Upload className="h-4 w-4" />
                Import External PMD
              </button>
            </div>
          </div>
        </div>
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
              <button type="button" onClick={() => setTreatmentPlanSheetOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <TreatmentPlanTab patientId={patientId} branchId={branchId} />
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
