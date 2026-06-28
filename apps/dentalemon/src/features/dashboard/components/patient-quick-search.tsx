/**
 * PatientQuickSearch -- find-a-patient from Home.
 *
 * The single most-used action in any practice tool, previously absent from the
 * dashboard. A debounced typeahead over the existing patient list; selecting a
 * result opens that patient's workspace. Results dropdown is absolutely
 * positioned in a non-clipping header container (no overflow trap).
 */

import React, { useEffect, useRef, useState } from 'react';
import { usePatients } from '@/features/patients/hooks/use-patients';

export interface PatientQuickSearchProps {
  branchId: string;
  onSelect: (patientId: string) => void;
}

const MIN_CHARS = 2;
const MAX_RESULTS = 6;

export function PatientQuickSearch({ branchId, onSelect }: PatientQuickSearchProps) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(t);
  }, [term]);

  const active = debounced.length >= MIN_CHARS;
  const { patients, isLoading } = usePatients({
    branchId,
    searchQuery: active ? debounced : undefined,
    enabled: active, // hold the fetch until there's a real query — no mount fetch
  });
  const results = active ? patients.slice(0, MAX_RESULTS) : [];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function choose(id: string) {
    onSelect(id);
    setTerm('');
    setDebounced('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full sm:max-w-xs" data-testid="patient-search">
      <input
        type="search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) choose(results[0].id);
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Search patients…"
        aria-label="Search patients"
        className="h-11 w-full rounded-xl bg-background border border-border px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
      />

      {open && active && (
        <div
          className="absolute z-10 mt-1 w-full rounded-xl bg-background border border-border shadow-lg overflow-hidden"
          role="listbox"
          data-testid="patient-search-results"
        >
          {isLoading ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">No patients found.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={false}
                data-testid={`patient-search-result-${p.id}`}
                onClick={() => choose(p.id)}
                className="flex items-center w-full px-3 py-2.5 text-left text-sm hover:bg-secondary/40 focus-visible:outline-none focus-visible:bg-secondary/40 transition-colors"
              >
                <span className="truncate">{p.displayName ?? p.id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
