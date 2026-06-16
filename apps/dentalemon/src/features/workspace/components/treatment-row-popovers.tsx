import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover';

interface DismissTreatmentPopoverProps {
  treatmentId: string;
  open: boolean;
  reason: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
}

export function DismissTreatmentPopover({
  open,
  reason,
  isPending,
  onOpenChange,
  onReasonChange,
  onConfirm,
}: DismissTreatmentPopoverProps) {
  const reasonOk = reason.trim().length >= 3;
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenChange(true); }}
          className="text-[10px] text-destructive hover:underline"
          aria-label="Dismiss treatment"
        >
          Dismiss
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        className="w-64 p-4 bg-background border border-border rounded-xl shadow-lg z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Reason (required)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          minLength={3}
          placeholder="e.g. Patient declined"
          className="w-full border border-border rounded-xl px-2 py-1.5 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
        <button
          type="button"
          disabled={!reasonOk || isPending}
          onClick={() => { if (reasonOk) onConfirm(); }}
          aria-label="Confirm dismiss treatment"
          className="mt-2 w-full rounded-xl bg-destructive/10 text-destructive text-sm py-3 min-h-[44px] font-medium disabled:opacity-50 hover:bg-destructive/20 transition-colors"
        >
          Confirm Dismiss
        </button>
      </PopoverContent>
    </Popover>
  );
}

interface DeclineTreatmentPopoverProps {
  treatmentId: string;
  open: boolean;
  reason: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
}

export function DeclineTreatmentPopover({
  open,
  reason,
  isPending,
  onOpenChange,
  onReasonChange,
  onConfirm,
}: DeclineTreatmentPopoverProps) {
  const reasonOk = reason.trim().length >= 3;
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="decline-btn"
          onClick={(e) => { e.stopPropagation(); onOpenChange(true); }}
          className="text-[10px] text-orange-600 hover:underline"
          aria-label="Record informed refusal"
        >
          Decline
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        className="w-64 p-4 bg-background border border-border rounded-xl shadow-lg z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
          Informed Refusal
        </p>
        <p className="text-[10px] text-muted-foreground mb-2">
          Patient has declined this treatment. Document reason below.
        </p>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Refusal Reason (required)
        </label>
        <input
          type="text"
          data-testid="refusal-reason-input"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          minLength={3}
          placeholder="e.g. Cannot afford, prefers alternative"
          className="w-full border border-border rounded-xl px-2 py-1.5 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
        <button
          type="button"
          data-testid="confirm-decline-btn"
          disabled={!reasonOk || isPending}
          onClick={() => { if (reasonOk) onConfirm(); }}
          aria-label="Confirm informed refusal"
          className="mt-2 w-full rounded-xl bg-orange-50 text-orange-700 text-sm py-1.5 font-medium disabled:opacity-50 hover:bg-orange-100 transition-colors"
        >
          Confirm Refusal
        </button>
      </PopoverContent>
    </Popover>
  );
}
