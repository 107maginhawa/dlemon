/**
 * SignaturePad — canvas-based e-signature capture for P1-20 case acceptance.
 *
 * Captures a signature stroke + the signer's typed name, then calls onAccept with a
 * base64 PNG payload (reuses the consent e-sig payload shape). Mirrors the consent
 * e-sig immutability contract: once submitted the pad locks (disabled), since the
 * server treats the decision as terminal.
 */
import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  isSubmitting: boolean;
  /** True once the presentation has been decided (locks the pad). */
  submitted: boolean;
  onAccept: (input: { signerName: string; signatureData: string }) => void;
}

export function SignaturePad({ isSubmitting, submitted, onAccept }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [signerName, setSignerName] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (submitted) return;
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || submitted) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  const canSubmit = hasStroke && signerName.trim().length > 0 && !isSubmitting && !submitted;

  function submit() {
    const canvas = canvasRef.current;
    if (!canvas || !canSubmit) return;
    onAccept({ signerName: signerName.trim(), signatureData: canvas.toDataURL('image/png') });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your name
      </label>
      <input
        type="text"
        aria-label="Signer name"
        value={signerName}
        disabled={submitted}
        onChange={(e) => setSignerName(e.target.value)}
        placeholder="Full name (patient or guardian)"
        className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      />
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Signature
      </label>
      <canvas
        ref={canvasRef}
        width={520}
        height={160}
        aria-label="Signature pad"
        data-testid="signature-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-40 w-full touch-none rounded-xl border border-dashed border-border bg-muted/30"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={clear}
          disabled={submitted}
          className="min-h-[44px] rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          data-testid="accept-sign-btn"
          disabled={!canSubmit}
          onClick={submit}
          className="h-11 flex-1 rounded-xl bg-lemon px-3 py-3 text-sm font-semibold text-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitted ? 'Accepted' : isSubmitting ? 'Submitting…' : 'Accept & Sign'}
        </button>
      </div>
    </div>
  );
}
