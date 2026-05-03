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
      body: JSON.stringify({ patientId }),
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
        branchId: '00000000-0000-4000-8000-000000000001',
        dentistMemberId: '00000000-0000-4000-8000-000000000002',
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
      <div className="flex-1 flex min-h-0">
        {/* Dental Chart zone */}
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

        {/* Tooth Slideout */}
        <ToothSlideout
          toothNumber={selectedTooth}
          open={selectedTooth !== null && currentVisitId !== null}
          onClose={() => setSelectedTooth(null)}
          onSave={handleSaveToothData}
        />
      </div>
    </div>
  );
}
