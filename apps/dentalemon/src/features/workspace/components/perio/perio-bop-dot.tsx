/**
 * PerioBopDot — per-site bleeding-on-probing toggle, rendered as a marker above
 * the depth cell (research convention: BOP markers sit above probing numbers).
 *
 * BOP emphasis uses a semantic red dot — NOT the lemon accent (DESIGN.md: the
 * accent is reserved for primary actions, never data state).
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { PERIO_SITE_LABEL, type PerioSite } from './perio-types';

export interface PerioBopDotProps {
  tooth: number;
  site: PerioSite;
  active: boolean;
  readOnly?: boolean;
  onToggle: () => void;
}

export function PerioBopDot({ tooth, site, active, readOnly = false, onToggle }: PerioBopDotProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`Tooth ${tooth} ${PERIO_SITE_LABEL[site]} bleeding on probing`}
      data-testid="perio-bop-dot"
      disabled={readOnly}
      onClick={onToggle}
      className={cn(
        'group mx-auto flex min-h-[24px] min-w-[24px] items-center justify-center',
        readOnly ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-3 w-3 items-center justify-center rounded-full border transition-colors',
          active ? 'bg-destructive border-destructive' : 'bg-transparent border-muted-foreground/40',
          readOnly ? '' : 'group-hover:border-destructive/70',
        )}
      />
    </button>
  );
}
