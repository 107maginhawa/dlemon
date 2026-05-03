/**
 * Workspace Route — /_workspace/$patientId
 *
 * Full-screen clinical workspace for a patient visit.
 * Left zone: Timeline Carousel + Dental Chart
 * Right zone: Tooth Slideout (when tooth selected)
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import { createFileRoute } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { TimelineCarousel } from '@/features/workspace/components/timeline-carousel';
import type { VisitCard } from '@/features/workspace/components/timeline-carousel';
import { DentalChart } from '@/features/workspace/components/dental-chart.tsx';
import type { ToothData } from '@/features/workspace/components/dental-chart.helpers';
import { ToothSlideout } from '@/features/workspace/components/tooth-slideout';
import type { ToothSlideoutData } from '@/features/workspace/components/tooth-slideout';
import { apiBaseUrl } from '@/utils/config';

export const Route = createFileRoute('/_workspace/$patientId')({
  component: WorkspacePage,
});

const API = apiBaseUrl;

function WorkspacePage() {
  const { patientId } = Route.useParams();
  const [visits, setVisits] = useState<VisitCard[]>([]);
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [pmdShared, setPmdShared] = useState(false);
  const [teeth, setTeeth] = useState<ToothData[]>([]);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load visits for this patient
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/dental/visits?patientId=${patientId}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        setVisits(data.items ?? []);

        // Auto-select active or most recent visit
        const active = data.items?.find((v: VisitCard) => v.status === 'active');
        const recent = data.items?.[0];
        const auto = active ?? recent;
        if (auto) {
          setCurrentVisitId(auto.id);
          await loadChart(auto.id);
          await loadTreatments(auto.id);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId]);

  async function loadChart(visitId: string) {
    const res = await fetch(`${API}/dental/visits/${visitId}/chart`, { credentials: 'include' });
    if (res.ok) {
      const chart = await res.json();
      setTeeth(chart.teeth ?? []);
    } else {
      setTeeth([]);
    }
  }

  async function loadTreatments(visitId: string) {
    const res = await fetch(`${API}/dental/visits/${visitId}/treatments`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setTreatments(data.items ?? []);
    }
  }

  async function handleSelectVisit(visitId: string) {
    setCurrentVisitId(visitId);
    setSelectedTooth(null);
    await loadChart(visitId);
    await loadTreatments(visitId);
  }

  const currentVisit = visits.find(v => v.id === currentVisitId);
  const isCompletedVisit = currentVisit?.status === 'completed' || currentVisit?.status === 'locked';

  async function handleSharePMD() {
    if (!currentVisitId) return;
    setPmdShared(false);
    const res = await fetch(`${API}/dental/visits/${currentVisitId}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitId: currentVisitId, patientId }),
    });
    if (res.ok) {
      const pmd = await res.json();
      // Trigger device share or show checksum as confirmation
      if (navigator.share) {
        navigator.share({
          title: 'Portable Medical Document',
          text: `PMD for visit — Checksum: ${pmd.checksum}`,
        }).catch(() => {});
      }
      setPmdShared(true);
    }
  }

  async function handleNewVisit() {
    const res = await fetch(`${API}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId,
        branchId: localStorage.getItem('currentBranchId') ?? '',
        dentistMemberId: localStorage.getItem('currentMemberId') ?? '',
      }),
    });
    if (!res.ok) return;
    const visit = await res.json();
    setVisits(prev => [visit, ...prev]);
    setCurrentVisitId(visit.id);
    setTeeth([]);
    setTreatments([]);
  }

  function handleSelectTooth(toothNumber: number) {
    setSelectedTooth(prev => prev === toothNumber ? null : toothNumber);
  }

  async function handleSaveToothData(data: ToothSlideoutData) {
    if (!currentVisitId || !selectedTooth) return;

    const updatedTeeth = [...teeth];
    const idx = updatedTeeth.findIndex(t => t.toothNumber === selectedTooth);
    const toothEntry: ToothData = {
      toothNumber: selectedTooth,
      state: data.state,
      surfaces: data.surfaces,
      conditionCode: data.conditionCode,
    };
    if (idx >= 0) updatedTeeth[idx] = toothEntry;
    else updatedTeeth.push(toothEntry);

    await fetch(`${API}/dental/visits/${currentVisitId}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitId: currentVisitId, patientId, teeth: updatedTeeth }),
    });

    if (data.cdtCode && data.description && data.priceCents) {
      await fetch(`${API}/dental/visits/${currentVisitId}/treatments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: currentVisitId,
          patientId,
          cdtCode: data.cdtCode,
          description: data.description,
          toothNumber: selectedTooth,
          surfaces: data.surfaces,
          conditionCode: data.conditionCode,
          priceCents: data.priceCents,
        }),
      });
      await loadTreatments(currentVisitId);
    }

    setTeeth(updatedTeeth);
    setSelectedTooth(null);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading workspace…</span>
      </div>
    );
  }

  const totalCents = treatments.reduce((sum, t) => sum + (t.priceCents ?? 0), 0);
  const pendingCount = treatments.filter(t => t.status !== 'performed').length;

  return (
    <div className="flex h-full flex-col">
      {/* Timeline Carousel */}
      <div className="shrink-0 border-b bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between">
          <TimelineCarousel
            visits={visits}
            currentVisitId={currentVisitId ?? undefined}
            onSelectVisit={handleSelectVisit}
            onNewVisit={handleNewVisit}
          />
          {isCompletedVisit && (
            <button
              type="button"
              data-testid="share-pmd-btn"
              onClick={handleSharePMD}
              className="mr-4 shrink-0 text-xs font-medium text-primary hover:underline flex items-center gap-1"
              aria-label="Share PMD"
            >
              {pmdShared ? '✓ PMD shared' : 'Share PMD'}
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Dental Chart + Treatment List zone */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {currentVisitId ? (
              <DentalChart
                teeth={teeth}
                selectedTooth={selectedTooth}
                onSelectTooth={handleSelectTooth}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Select or create a visit to begin.</p>
              </div>
            )}
          </div>

          {/* Treatment list */}
          {treatments.length > 0 && (
            <div className="shrink-0 border-t max-h-48 overflow-y-auto bg-background">
              <table className="w-full text-sm" aria-label="Treatments">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Tooth</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">CDT</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((t) => (
                    <tr key={t.id} className="border-t border-border/40 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{t.toothNumber ?? '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{t.cdtCode ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">{t.description ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">₱{((t.priceCents ?? 0) / 100).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          t.status === 'performed' ? 'bg-green-100 text-green-700' :
                          t.status === 'proposed' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tooth Slideout */}
        <ToothSlideout
          toothNumber={selectedTooth}
          open={selectedTooth !== null && currentVisitId !== null}
          onClose={() => setSelectedTooth(null)}
          onSave={handleSaveToothData}
          readOnly={isCompletedVisit}
        />
      </div>

      {/* Payment footer */}
      <footer className="flex h-14 shrink-0 items-center justify-between border-t px-4 backdrop-blur-xl bg-white/70 supports-[backdrop-filter]:bg-white/70">
        <span className="text-sm text-muted-foreground" data-testid="treatment-summary">
          {treatments.length === 0
            ? 'No treatments recorded'
            : `${treatments.length} treatment${treatments.length !== 1 ? 's' : ''} · ₱${(totalCents / 100).toLocaleString()}`}
        </span>
        <button
          type="button"
          disabled={pendingCount === 0 && !isCompletedVisit}
          className="rounded-lg bg-[#FFE97D] px-5 py-2 text-sm font-semibold text-[#4A4018] hover:bg-[#F5DC60] min-h-[44px] disabled:opacity-50"
          data-testid="continue-to-payment-btn"
        >
          {isCompletedVisit ? 'View Invoice' : `Continue to Payment (${pendingCount})`}
        </button>
      </footer>
    </div>
  );
}
