import { useCallback, useState } from 'react';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { PatientImageList } from '@/features/imaging/components/patient-image-list';
import { ImagingWorkspace } from '@/features/imaging/components/imaging-workspace';
import { ComparisonView } from '@/features/imaging/components/comparison-view';
import { ImageUpload } from '@/features/imaging/components/image-upload';
import { useImagingStudies, type PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies';

interface WorkspaceImagingOverlayProps {
  patientId: string;
  branchId: string;
  currentVisitId: string | null;
  open: boolean;
  onClose: () => void;
}

export function WorkspaceImagingOverlay({
  patientId,
  branchId,
  currentVisitId,
  open,
  onClose,
}: WorkspaceImagingOverlayProps) {
  const [selectedImageItem, setSelectedImageItem] = useState<PatientImageItem | null>(null);
  const [comparisonItems, setComparisonItems] = useState<[PatientImageItem, PatientImageItem] | null>(null);

  // L1/L2: the canvas needs to know whether the patient has any images so it can
  // host an upload state instead of a dead "select an image" prompt. Shares the
  // list's react-query key (same patientId/branchId) — no extra fetch.
  const { data, refetch } = useImagingStudies(patientId, branchId);
  const hasImages = (data?.items.length ?? 0) > 0;
  // L3: a comparison or single-image viewer is "drilled in" — offer Back-to-images.
  const isDrilledIn = comparisonItems !== null || selectedImageItem !== null;
  const backToImages = useCallback(() => {
    setSelectedImageItem(null);
    setComparisonItems(null);
  }, []);

  // ISSUE-010: hand-rolled overlay (not Radix) → wire Escape-to-dismiss + focus
  // restore. Reset local selection too, so Escape matches the × button's behavior.
  const handleClose = useCallback(() => {
    onClose();
    setSelectedImageItem(null);
    setComparisonItems(null);
  }, [onClose]);
  useSheetA11y({ open, onClose: handleClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="imaging-overlay">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          {/* A back control is ALWAYS present: drilled-in viewers step back to the
              image list; the list/empty level steps back out to the workspace
              toolbar (the only prior exit was the small X). */}
          {isDrilledIn ? (
            <button
              type="button"
              onClick={backToImages}
              data-testid="imaging-back-btn"
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft size={16} />
              Back to images
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              data-testid="imaging-back-workspace-btn"
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft size={16} />
              Back to workspace
            </button>
          )}
          <h2 className="text-sm font-semibold">Imaging</h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close imaging"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        {/* The library sidebar only earns its space once images exist. With zero
            images it was a dead column (disabled FMX/Compare, a second "Upload
            Image" button, a duplicate "No images yet") competing with the canvas
            upload form — so the empty state now lives in ONE place: the canvas. */}
        {hasImages && (
          <PatientImageList
            patientId={patientId}
            branchId={branchId}
            onSelectImage={(item) => setSelectedImageItem(item)}
            onCompare={(items) => { setComparisonItems(items); setSelectedImageItem(null); }}
          />
        )}
        <div className="flex-1 min-w-0">
          {comparisonItems ? (
            <ComparisonView
              imageA={comparisonItems[0]}
              imageB={comparisonItems[1]}
              onClose={() => setComparisonItems(null)}
            />
          ) : selectedImageItem && selectedImageItem.downloadUrl ? (
            <ImagingWorkspace
              imageId={selectedImageItem.id}
              imageUrl={selectedImageItem.downloadUrl}
              className="h-full w-full"
              visitId={currentVisitId ?? ''}
              patientId={patientId}
              branchId={branchId}
              modality={selectedImageItem.modality}
            />
          ) : selectedImageItem ? (
            // The record exists but has no stored file. Never fall back to the bare
            // fileName as a URL — that loaded nothing and left a silent blank canvas.
            // Show an explicit unavailable state so the clinician knows the record is
            // real but the image is missing.
            <div
              data-testid="image-unavailable"
              className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center text-sm text-muted-foreground"
            >
              <p className="font-medium text-foreground">Image file unavailable</p>
              <p>“{selectedImageItem.fileName}” has no stored file to display.</p>
            </div>
          ) : !hasImages ? (
            // L1/L2: zero images — don't waste the canvas on a no-op "select"
            // prompt; host the primary upload affordance right here.
            <div
              data-testid="imaging-empty-canvas"
              className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
            >
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <Upload className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">No images yet</p>
                <p className="text-sm">Upload the first X-ray or photo for this patient.</p>
              </div>
              <div className="w-full max-w-sm text-left">
                <ImageUpload
                  patientId={patientId}
                  branchId={branchId}
                  visitId={currentVisitId ?? undefined}
                  onSuccess={() => { void refetch(); }}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select an image to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
