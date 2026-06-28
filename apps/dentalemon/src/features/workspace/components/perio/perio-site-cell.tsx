/**
 * PerioSiteCell — one editable depth or gingival-margin site input.
 *
 * Numeric, 1–2 chars. Commits on each valid keystroke and requests auto-advance
 * when a single digit is entered (the common 1–9 case). Over-threshold depths
 * render red (text-destructive) — the red-line. Never renders CAL (read-only,
 * shown elsewhere). 44px min tap target for iPad chairside use.
 */

import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import {
  PERIO_SITE_LABEL,
  clampDepth,
  isOverThreshold,
  DEPTH_MAX,
  type PerioSite,
} from './perio-types';

export interface PerioSiteCellProps {
  tooth: number;
  site: PerioSite;
  /** depth = probing depth (red-line aware); gm = gingival margin (signed). */
  kind: 'depth' | 'gm';
  value: number | null | undefined;
  threshold: number;
  readOnly?: boolean;
  /** Voice cursor highlight — the active target cell (same affordance as focus). */
  active?: boolean;
  /** Commit a validated value. Called with the clamped number. */
  onCommit: (value: number) => void;
  /** Request auto-advance to the next site (single-digit fast path / Tab). */
  onAdvance?: () => void;
  /** Optional ref forwarded to the input for focus management. */
  inputRef?: React.Ref<HTMLInputElement>;
}

export function PerioSiteCell({
  tooth,
  site,
  kind,
  value,
  threshold,
  readOnly = false,
  active = false,
  onCommit,
  onAdvance,
  inputRef,
}: PerioSiteCellProps) {
  const id = useId();
  const siteLabel = PERIO_SITE_LABEL[site];
  const kindLabel = kind === 'depth' ? 'depth' : 'gingival margin';
  const ariaLabel = `Tooth ${tooth} ${siteLabel} ${kindLabel}`;

  // depth is unsigned (red-line aware); gm is signed (−5..20) — no red-line.
  const over = kind === 'depth' && isOverThreshold(value, threshold);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
    const raw = e.target.value;
    if (raw === '') {
      // Clearing is allowed; nothing to commit.
      return;
    }
    // Reject anything that is not 0–2 digits (depth) — non-numeric is ignored.
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits === '') {
      // Non-numeric keystroke — reject by resetting the field.
      e.target.value = '';
      return;
    }
    const parsed = Number(digits);
    const clamped = kind === 'depth' ? clampDepth(parsed) : parsed;
    e.target.value = String(clamped);
    onCommit(clamped);
    // Single-digit fast path: a 1-char value that can't grow into 10+ advances.
    if (digits.length === 1 && parsed <= 1 && kind === 'depth') {
      // 0 or 1 could still become 10–19; do not auto-advance on those.
    } else if (digits.length >= 1 && (parsed >= 2 || digits.length === 2)) {
      onAdvance?.();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (readOnly) return;
    if (e.key === 'Tab' && !e.shiftKey) {
      // Let Tab also trigger explicit advance for the slow-typing path.
      onAdvance?.();
    }
  }

  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={kind === 'depth' ? 2 : 3}
      aria-label={ariaLabel}
      data-testid="tooth-cell"
      data-perio-tooth={tooth}
      data-perio-site={site}
      data-perio-active={active || undefined}
      readOnly={readOnly}
      defaultValue={value ?? ''}
      max={DEPTH_MAX}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={cn(
        'h-11 w-9 min-h-[44px] rounded-md border border-border bg-background text-center text-base font-medium text-foreground tabular-nums',
        'focus:outline-none focus:ring-2 focus:ring-lemon-focus focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:opacity-50 read-only:bg-muted/40 read-only:cursor-default',
        over && 'text-destructive font-bold border-destructive',
        active && 'ring-2 ring-info ring-offset-1 border-info',
      )}
    />
  );
}
