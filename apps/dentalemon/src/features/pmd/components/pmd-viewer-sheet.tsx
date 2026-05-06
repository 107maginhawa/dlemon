/**
 * PMDViewerSheet — Shadcn Sheet wrapper around PMDViewer
 *
 * Opens as a right-side sheet overlay with the PMD document contents.
 * Exposes an "Import PMD" button to satisfy WBAR-06.
 */

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/sheet';
import { PMDViewer } from './pmd-viewer';
import type { PMDDocument } from '../types';

interface Props {
  pmd: PMDDocument | null;
  open: boolean;
  onClose: () => void;
  onImportClick: () => void;
}

export function PMDViewerSheet({ pmd, open, onClose, onImportClick }: Props) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Patient Medical Data</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4">
          {pmd ? (
            <PMDViewer pmd={pmd} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No PMD document for this visit.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              // Delay to avoid overlapping Sheet close + PMDImport open animations
              setTimeout(onImportClick, 300);
            }}
            className="mt-2 w-full rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Import External PMD
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
