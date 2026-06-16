import { useState } from 'react';
import { X } from 'lucide-react';
import { PatientImageList } from '@/features/imaging/components/patient-image-list';
import { ImagingWorkspace } from '@/features/imaging/components/imaging-workspace';
import { ComparisonView } from '@/features/imaging/components/comparison-view';
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies';

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="imaging-overlay">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold">Imaging</h2>
        <button
          type="button"
          onClick={() => { onClose(); setSelectedImageItem(null); setComparisonItems(null); }}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close imaging"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <PatientImageList
          patientId={patientId}
          branchId={branchId}
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
