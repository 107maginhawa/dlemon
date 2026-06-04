/**
 * AttachmentsSheet — bottom sheet for managing visit attachments
 *
 * ATCH-01: upload (drag & drop / tap)
 * ATCH-02: view/download attachments
 * ATCH-03: scoped to current visit; "All" tab shows patient-level
 *
 * Wireframe: docs/prd/context/wireframes/ws-attachments.html
 */
import React, { useRef, useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { Paperclip, Upload, Trash2, Download, X, FileText, Image } from 'lucide-react';
import { apiBaseUrl } from '@/lib/config';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  IMAGE_TYPE_LABELS,
  IMAGE_TYPES,
  type DentalAttachment,
  type AttachmentImageType,
} from '../hooks/use-attachments';
// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AttachmentsSheetProps {
  visitId: string | null;
  patientId: string;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function formatBytes(bytes: number | bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 shrink-0 text-blue-500" />;
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function canDownload(attachment: DentalAttachment): boolean {
  // filePath is the storage key / file ID
  return Boolean(attachment.filePath);
}

// ---------------------------------------------------------------------------
// Tooth selector
// ---------------------------------------------------------------------------

function ToothSelector({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (n: number) => void;
}) {
  function renderRow(teeth: number[]) {
    return teeth.map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onToggle(n)}
        aria-label={`Tooth ${n}`}
        aria-pressed={selected.includes(n)}
        className={`h-5 w-full rounded-sm text-[8px] font-semibold transition-colors ${
          selected.includes(n)
            ? 'bg-lemon text-lemon-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/70'
        }`}
      >
        {n}
      </button>
    ));
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[12px] font-medium text-muted-foreground">Tag teeth (optional)</p>
      <div className="grid grid-cols-16 gap-0.5" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
        {renderRow(TEETH_UPPER)}
      </div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
        {renderRow(TEETH_LOWER)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------------

function UploadZone({
  visitId,
  patientId,
  imageType,
  toothNumbers,
  onDone,
}: {
  visitId: string | null;
  patientId: string;
  imageType: AttachmentImageType;
  toothNumbers: number[];
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAttachment(visitId, patientId);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — matches backend limit

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !visitId) return;
    setUploadErrors([]);
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: exceeds 50 MB limit`);
        continue;
      }
      try {
        await upload.mutateAsync({ file, imageType, toothNumbers });
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
      }
    }
    setUploadErrors(errors);
    onDone();
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={!visitId || upload.isPending}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        data-testid="upload-zone"
        className={`flex h-20 w-full items-center justify-center gap-3 rounded-xl border-[1.5px] border-dashed transition-colors ${
          dragOver
            ? 'border-lemon bg-lemon/10'
            : 'border-border hover:border-muted-foreground/50'
        } disabled:opacity-40`}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[13px] font-medium text-muted-foreground">
            {upload.isPending ? 'Uploading…' : 'Tap to upload'}
          </span>
          <span className="text-[12px] text-muted-foreground/60">JPEG, PNG, PDF</span>
        </div>
      </button>
      {uploadErrors.length > 0 && (
        <ul className="mt-1.5 space-y-0.5" role="alert">
          {uploadErrors.map((e) => (
            <li key={e} className="text-xs text-destructive">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachment row
// ---------------------------------------------------------------------------

function AttachmentRow({
  attachment,
  sheetVisitId,
  apiBase,
}: {
  attachment: DentalAttachment;
  /** The sheet's current visitId — used to scope cache invalidation to the visible query */
  sheetVisitId: string | null;
  apiBase: string;
}) {
  const deleteM = useDeleteAttachment(sheetVisitId);

  async function handleDelete() {
    await deleteM.mutateAsync(attachment.id);
  }

  function handleDownload() {
    // Open download URL — backend serves via /storage/files/{file}/download
    window.open(`${apiBase}/storage/files/${attachment.filePath}/download`, '_blank');
  }

  return (
    <div
      data-testid={`attachment-row-${attachment.id}`}
      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
    >
      {getFileIcon(attachment.mimeType)}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium">{attachment.fileName}</span>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wide">
            {IMAGE_TYPE_LABELS[attachment.imageType]}
          </span>
          <span>{formatBytes(attachment.fileSizeBytes)}</span>
          {attachment.toothNumbers && attachment.toothNumbers.length > 0 && (
            <span>T: {attachment.toothNumbers.join(', ')}</span>
          )}
        </div>
      </div>

      {canDownload(attachment) && (
        <button
          type="button"
          onClick={handleDownload}
          aria-label={`Download ${attachment.fileName}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Download className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleteM.isPending}
        aria-label={`Delete ${attachment.fileName}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Tab = 'visit' | 'all';

export function AttachmentsSheet({ visitId, patientId, open, onClose }: AttachmentsSheetProps) {
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close.
  useSheetA11y({ open, onClose });

  const [tab, setTab] = useState<Tab>('visit');
  const [imageType, setImageType] = useState<AttachmentImageType>('xray');
  const [toothNumbers, setToothNumbers] = useState<number[]>([]);

  const { data: attachments = [], isLoading, isError, refetch } = useAttachments(visitId);

  const apiBase = apiBaseUrl;

  const visitAttachments = attachments.filter((a) => a.visitId === visitId);
  const displayed = tab === 'visit' ? visitAttachments : attachments;

  function toggleTooth(n: number) {
    setToothNumbers((prev) =>
      prev.includes(n) ? prev.filter((t) => t !== n) : [...prev, n],
    );
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attachments"
        data-testid="attachments-sheet"
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-background shadow-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-[17px] font-semibold tracking-tight">Attachments</span>
            {attachments.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {attachments.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attachments"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="mx-4 mb-0 flex shrink-0 rounded-[9px] bg-muted p-0.5">
          <button
            type="button"
            data-testid="tab-visit"
            onClick={() => setTab('visit')}
            className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-medium transition-all ${
              tab === 'visit'
                ? 'bg-background font-semibold text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            This Visit ({visitAttachments.length})
          </button>
          <button
            type="button"
            data-testid="tab-all"
            onClick={() => setTab('all')}
            className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-medium transition-all ${
              tab === 'all'
                ? 'bg-background font-semibold text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            All ({attachments.length})
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-8 pt-3">
          {/* Upload zone (only visible in "This Visit" tab) */}
          {tab === 'visit' && (
            <>
              <UploadZone
                visitId={visitId}
                patientId={patientId}
                imageType={imageType}
                toothNumbers={toothNumbers}
                onDone={() => refetch()}
              />

              {/* Image type chips */}
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Image type</p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {IMAGE_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      data-testid={`chip-${type}`}
                      onClick={() => setImageType(type)}
                      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                        imageType === type
                          ? 'bg-lemon text-lemon-foreground font-semibold'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {IMAGE_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tooth tagger */}
              <ToothSelector selected={toothNumbers} onToggle={toggleTooth} />
            </>
          )}

          {/* Attachment list */}
          {isError ? (
            <div className="flex h-16 flex-col items-center justify-center gap-2">
              <span className="text-sm text-destructive">Failed to load attachments.</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs text-muted-foreground underline"
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex h-16 items-center justify-center">
              <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
          ) : displayed.length === 0 ? (
            <div
              data-testid="empty-state"
              className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border"
            >
              <Paperclip className="h-5 w-5 text-muted-foreground/50" />
              <p className="text-[13px] text-muted-foreground">
                {tab === 'visit' ? 'No files for this visit' : 'No attachments yet'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {displayed.map((att) => (
                <AttachmentRow
                  key={att.id}
                  attachment={att}
                  sheetVisitId={visitId}
                  apiBase={apiBase}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
