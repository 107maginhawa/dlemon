/**
 * CdtCodeBrowser — CDT code selection component for the tooth slideout treatment step
 *
 * Features:
 * - Search (type-ahead filtering on code + description)
 * - Specialty tabs (8 categories)
 * - Favorites/Recents persisted in localStorage keyed by memberId
 * - Selecting a code reveals an editable price input + clinical notes textarea
 *
 * Wireframe: docs/superpowers/specs/2026-05-09-workspace-reconciliation-design.md §4.3
 */

import React, { useState, useMemo, useCallback } from 'react';
import cdtCodes from '@/features/workspace/data/cdt-codes.json';
import { useOrgContextStore } from '@/stores/org-context.store';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CdtCodeEntry {
  code: string;
  description: string;
  category: string;
  specialty: string;
  defaultPriceCents: number;
}

export interface CdtCodeSelection {
  code: string;
  description: string;
  priceCents: number;
  clinicalNotes: string;
}

export interface CdtCodeBrowserProps {
  onSelect: (selection: CdtCodeSelection) => void;
  initialCode?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIALTIES = [
  { id: 'All', label: 'All' },
  { id: 'General', label: 'General' },
  { id: 'Endo', label: 'Endo' },
  { id: 'Perio', label: 'Perio' },
  { id: 'Prostho', label: 'Prostho' },
  { id: 'OralSurgery', label: 'Oral Sx' },
  { id: 'Ortho', label: 'Ortho' },
  { id: 'Pedia', label: 'Pedia' },
  { id: 'Cosmetic', label: 'Cosmetic' },
] as const;

const MAX_FAVORITES = 20;
const MAX_RECENTS = 10;

// ─── localStorage helpers ─────────────────────────────────────────────────────

function favKey(memberId: string) {
  return `dentalemon:cdt-favorites:${memberId}`;
}
function recentKey(memberId: string) {
  return `dentalemon:cdt-recents:${memberId}`;
}

function readJsonArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, arr: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // quota exceeded — silently ignore
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const ALL_CODES = cdtCodes as CdtCodeEntry[];

export function CdtCodeBrowser({ onSelect, initialCode }: CdtCodeBrowserProps) {
  const memberId = useOrgContextStore(s => s.memberId);

  const [search, setSearch] = useState('');
  const [activeSpecialty, setActiveSpecialty] = useState<string>('All');
  const [selected, setSelected] = useState<CdtCodeEntry | null>(() => {
    if (!initialCode) return null;
    return ALL_CODES.find(c => c.code === initialCode) ?? null;
  });
  const [priceInput, setPriceInput] = useState<string>(() => {
    if (!initialCode) return '';
    const entry = ALL_CODES.find(c => c.code === initialCode);
    return entry ? String(entry.defaultPriceCents / 100) : '';
  });
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Favorites/recents — always read from localStorage when memberId is set
  const [favorites, setFavorites] = useState<string[]>(() =>
    memberId && memberId !== 'undefined' ? readJsonArray(favKey(memberId)) : []
  );
  const [recents, setRecents] = useState<string[]>(() =>
    memberId && memberId !== 'undefined' ? readJsonArray(recentKey(memberId)) : []
  );

  // Filtered code list
  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_CODES.filter(c => {
      const matchesSpecialty = activeSpecialty === 'All' || c.specialty === activeSpecialty;
      const matchesSearch = !q || c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      return matchesSpecialty && matchesSearch;
    });
  }, [search, activeSpecialty]);

  // Favorite codes that exist in the catalog
  const favoriteCodes = useMemo(() =>
    favorites.map(code => ALL_CODES.find(c => c.code === code)).filter(Boolean) as CdtCodeEntry[],
    [favorites]
  );

  const recentCodes = useMemo(() =>
    recents
      .filter(code => !favorites.includes(code)) // recents doesn't duplicate favorites
      .map(code => ALL_CODES.find(c => c.code === code))
      .filter(Boolean) as CdtCodeEntry[],
    [recents, favorites]
  );

  const toggleFavorite = useCallback((code: string) => {
    if (!memberId) return;
    setFavorites(prev => {
      const next = prev.includes(code)
        ? prev.filter(c => c !== code)
        : [code, ...prev].slice(0, MAX_FAVORITES);
      writeJsonArray(favKey(memberId), next);
      return next;
    });
  }, [memberId]);

  const handleSelectCode = useCallback((entry: CdtCodeEntry) => {
    setSelected(entry);
    setPriceInput(String(entry.defaultPriceCents / 100));

    // Add to recents
    if (memberId) {
      setRecents(prev => {
        const deduped = [entry.code, ...prev.filter(c => c !== entry.code)].slice(0, MAX_RECENTS);
        writeJsonArray(recentKey(memberId), deduped);
        return deduped;
      });
    }
  }, [memberId]);

  const handleContinue = useCallback(() => {
    if (!selected) return;
    const raw = parseFloat(priceInput);
    const priceCents = isNaN(raw) ? selected.defaultPriceCents : Math.round(raw * 100);
    onSelect({
      code: selected.code,
      description: selected.description,
      priceCents,
      clinicalNotes,
    });
  }, [selected, priceInput, clinicalNotes, onSelect]);

  const quickCodes = [...favoriteCodes, ...recentCodes].slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search CDT code or description…"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm pr-8"
          aria-label="Search CDT codes"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Favorites / Recents pills */}
      {quickCodes.length > 0 && !search && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {favoriteCodes.length > 0 ? 'Favorites & Recent' : 'Recent'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickCodes.map(entry => (
              <button
                key={entry.code}
                type="button"
                onClick={() => handleSelectCode(entry)}
                className={[
                  'text-xs px-2 py-0.5 rounded-full border transition-colors',
                  selected?.code === entry.code
                    ? 'bg-lemon border-lemon-accent text-foreground font-semibold'
                    : 'border-border hover:bg-secondary',
                ].join(' ')}
              >
                {entry.code}
                {favorites.includes(entry.code) && (
                  <span className="ml-0.5 text-lemon-accent">★</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Specialty tabs */}
      <div
        className="flex gap-1 overflow-x-auto pb-1 -mx-0.5 px-0.5"
        role="tablist"
        aria-label="Specialty filter"
      >
        {SPECIALTIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeSpecialty === id}
            onClick={() => setActiveSpecialty(id)}
            className={[
              'whitespace-nowrap text-[10px] font-medium px-2 py-1 rounded-md border transition-colors shrink-0',
              activeSpecialty === id
                ? 'bg-lemon border-lemon-accent text-foreground'
                : 'border-border hover:bg-secondary text-muted-foreground',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Code list */}
      <div
        className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1"
        role="listbox"
        aria-label="CDT codes"
      >
        {filteredCodes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No codes match.</p>
        )}
        {filteredCodes.map(entry => (
          <div
            key={entry.code}
            className={[
              'flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
              selected?.code === entry.code
                ? 'border-lemon-accent bg-lemon-soft'
                : 'border-border hover:bg-secondary',
            ].join(' ')}
            role="option"
            aria-selected={selected?.code === entry.code}
            onClick={() => handleSelectCode(entry)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold">{entry.code}</span>
                <span className="text-[10px] text-muted-foreground">{entry.defaultPriceCents > 0 ? `${CURRENCY_SYMBOL}${(entry.defaultPriceCents / 100).toLocaleString(APP_LOCALE)}` : '—'}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{entry.description}</p>
            </div>
            {memberId && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggleFavorite(entry.code); }}
                className="text-lemon-accent hover:text-[#a08800] shrink-0 mt-0.5"
                aria-label={favorites.includes(entry.code) ? 'Remove from favorites' : 'Add to favorites'}
              >
                {favorites.includes(entry.code) ? '★' : '☆'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Selected code detail */}
      {selected && (
        <div className="flex flex-col gap-2 rounded-xl border border-lemon-accent bg-lemon/10 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold">{selected.code}</span>
            <span className="text-xs text-muted-foreground flex-1 truncate">{selected.description}</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="cdt-price">
              Price ({CURRENCY_SYMBOL})
            </label>
            <input
              id="cdt-price"
              type="number"
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              min="0"
              placeholder="0"
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="cdt-notes">
              Clinical Notes (optional)
            </label>
            <textarea
              id="cdt-notes"
              value={clinicalNotes}
              onChange={e => setClinicalNotes(e.target.value)}
              placeholder="Additional observations…"
              rows={2}
              className="rounded-lg border border-border px-3 py-1.5 text-sm resize-none"
            />
          </div>

          <button
            type="button"
            data-testid="cdt-continue-btn"
            onClick={handleContinue}
            className="w-full rounded-lg bg-lemon border border-lemon-accent text-foreground font-semibold text-sm py-2 hover:bg-lemon-hover transition-colors"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
