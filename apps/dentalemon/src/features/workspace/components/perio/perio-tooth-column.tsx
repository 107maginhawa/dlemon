/**
 * PerioToothColumn — one tooth's worth of perio inputs.
 *
 * Layout (top→bottom): BOP dots · buccal depth row · buccal GM row · CAL row ·
 * lingual depth row · lingual GM row · per-tooth controls (recession, mobility,
 * furcation, plaque, suppuration). Furcation is soft-gated (disabled) on
 * single-rooted teeth. Pure-ish: receives the reading + handlers, no fetching.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { PerioSiteCell } from './perio-site-cell';
import { PerioBopDot } from './perio-bop-dot';
import { PerioCalCell } from './perio-cal-cell';
import {
  depthField,
  bopField,
  gmField,
  calField,
  isSingleRooted,
  type PerioSite,
} from './perio-types';
import type { PerioToothReading, UpsertToothReadingRequest } from '@monobase/sdk-ts/generated';

const BUCCAL_SITES = ['BM', 'BC', 'BD'] as const satisfies readonly PerioSite[];
const LINGUAL_SITES = ['LM', 'LC', 'LD'] as const satisfies readonly PerioSite[];

export interface PerioToothColumnProps {
  tooth: number;
  reading?: PerioToothReading;
  threshold: number;
  readOnly?: boolean;
  onPatch: (patch: UpsertToothReadingRequest) => void;
  /** Request focus advance after a single-digit depth on a site. */
  onAdvance?: (tooth: number, site: PerioSite) => void;
  registerCellRef?: (tooth: number, site: PerioSite, el: HTMLInputElement | null) => void;
  /** Voice cursor highlight: the site currently targeted on THIS tooth (or null). */
  activeSite?: PerioSite | null;
}

export function PerioToothColumn({
  tooth,
  reading,
  threshold,
  readOnly = false,
  onPatch,
  onAdvance,
  registerCellRef,
  activeSite = null,
}: PerioToothColumnProps) {
  const singleRooted = isSingleRooted(tooth);

  function depthRow(sites: readonly PerioSite[]) {
    return (
      <div className="flex gap-0.5">
        {sites.map((site) => (
          <PerioSiteCell
            key={`d-${site}`}
            tooth={tooth}
            site={site}
            kind="depth"
            value={reading?.[depthField(site)] ?? null}
            threshold={threshold}
            readOnly={readOnly}
            active={activeSite === site}
            inputRef={(el) => registerCellRef?.(tooth, site, el)}
            onCommit={(v) => onPatch({ [depthField(site)]: v } as UpsertToothReadingRequest)}
            onAdvance={() => onAdvance?.(tooth, site)}
          />
        ))}
      </div>
    );
  }

  function gmRow(sites: readonly PerioSite[]) {
    return (
      <div className="flex gap-0.5">
        {sites.map((site) => (
          <PerioSiteCell
            key={`g-${site}`}
            tooth={tooth}
            site={site}
            kind="gm"
            value={reading?.[gmField(site)] ?? null}
            threshold={threshold}
            readOnly={readOnly}
            onCommit={(v) => onPatch({ [gmField(site)]: v } as UpsertToothReadingRequest)}
          />
        ))}
      </div>
    );
  }

  function bopRow(sites: readonly PerioSite[]) {
    return (
      <div className="flex gap-0.5">
        {sites.map((site) => (
          <div key={`b-${site}`} className="flex w-9 justify-center">
            <PerioBopDot
              tooth={tooth}
              site={site}
              active={Boolean(reading?.[bopField(site)])}
              readOnly={readOnly}
              onToggle={() =>
                onPatch({ [bopField(site)]: !reading?.[bopField(site)] } as UpsertToothReadingRequest)
              }
            />
          </div>
        ))}
      </div>
    );
  }

  function calRow(sites: readonly PerioSite[]) {
    return (
      <div className="flex gap-0.5">
        {sites.map((site) => (
          <PerioCalCell key={`c-${site}`} tooth={tooth} site={site} value={reading?.[calField(site)]} />
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid={`perio-tooth-${tooth}`}
      data-perio-tooth-column={tooth}
      className="flex shrink-0 flex-col items-center gap-0.5 rounded-md px-1 py-1"
    >
      <div className="text-xs font-bold text-zinc-700">{tooth}</div>

      {/* Buccal: BOP / depth / GM / CAL */}
      {bopRow(BUCCAL_SITES)}
      {depthRow(BUCCAL_SITES)}
      {gmRow(BUCCAL_SITES)}
      {calRow(BUCCAL_SITES)}

      <div className="my-0.5 h-px w-full bg-zinc-300" aria-hidden="true" />

      {/* Lingual: depth / GM / BOP */}
      {depthRow(LINGUAL_SITES)}
      {gmRow(LINGUAL_SITES)}
      {bopRow(LINGUAL_SITES)}

      {/* Per-tooth controls */}
      <div className="mt-1 flex flex-col items-stretch gap-0.5">
        <label className="flex items-center justify-between gap-1 text-xs font-medium text-zinc-600">
          <span>Mob</span>
          <select
            aria-label={`Tooth ${tooth} mobility`}
            value={reading?.mobility ?? 0}
            disabled={readOnly}
            onChange={(e) => onPatch({ mobility: Number(e.target.value) })}
            className="h-9 rounded border border-zinc-300 bg-background text-xs text-foreground"
          >
            {[0, 1, 2, 3].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label
          className={cn(
            'flex items-center justify-between gap-1 text-xs font-medium text-zinc-600',
            singleRooted && 'opacity-40',
          )}
        >
          <span>Furc</span>
          <select
            aria-label={`Tooth ${tooth} furcation`}
            value={reading?.furcation ?? 0}
            disabled={readOnly || singleRooted}
            onChange={(e) => onPatch({ furcation: Number(e.target.value) })}
            className="h-9 rounded border border-zinc-300 bg-background text-xs text-foreground disabled:bg-muted/30 disabled:cursor-not-allowed"
          >
            {[0, 1, 2, 3].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-center gap-1">
          <button
            type="button"
            aria-label={`Tooth ${tooth} plaque`}
            aria-pressed={Boolean(reading?.plaque)}
            disabled={readOnly}
            onClick={() => onPatch({ plaque: !reading?.plaque })}
            className={cn(
              'h-7 rounded px-2 text-xs font-bold',
              reading?.plaque ? 'bg-zinc-700 text-white' : 'bg-muted text-zinc-600',
            )}
          >
            P
          </button>
          <button
            type="button"
            aria-label={`Tooth ${tooth} suppuration`}
            aria-pressed={Boolean(reading?.suppuration)}
            disabled={readOnly}
            onClick={() => onPatch({ suppuration: !reading?.suppuration })}
            className={cn(
              'h-7 rounded px-2 text-xs font-bold',
              reading?.suppuration ? 'bg-destructive text-white' : 'bg-muted text-zinc-600',
            )}
          >
            S
          </button>
        </div>
      </div>
    </div>
  );
}
