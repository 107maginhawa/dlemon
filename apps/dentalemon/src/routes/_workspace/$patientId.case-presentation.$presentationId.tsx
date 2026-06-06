/**
 * Case Presentation Route — /_workspace/:patientId/case-presentation/:presentationId
 *
 * P1-20 Phase 1: staff mints a case presentation from the treatment-plans sheet
 * ("Present to patient"), then navigates here and hands the operatory iPad to the
 * patient to review the phased ₱ plan and accept (e-sign) or decline.
 *
 * Inherits the _workspace PIN/auth guard (chairside session). A thin staff header
 * lets the clinician reclaim the device and return to the patient workspace.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { CasePresentationPanel } from '@/features/case-presentation/case-presentation-panel';

export const Route = createFileRoute('/_workspace/$patientId/case-presentation/$presentationId')({
  component: CasePresentationPage,
});

function CasePresentationPage() {
  const { patientId, presentationId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* Staff header — not part of the patient-facing surface below */}
      <header className="flex shrink-0 items-center gap-2 border-b bg-background px-4 py-2">
        <button
          type="button"
          data-testid="case-presentation-back-btn"
          onClick={() => navigate({ to: '/$patientId', params: { patientId } })}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </button>
        <span className="ml-auto text-xs text-muted-foreground">Hand the device to the patient</span>
      </header>

      <main className="flex-1 overflow-y-auto">
        <CasePresentationPanel patientId={patientId} presentationId={presentationId} />
      </main>
    </div>
  );
}
