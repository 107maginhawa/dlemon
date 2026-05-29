/**
 * TimelineCarousel — Swiper EffectCoverflow visit history browser
 *
 * Visits are sorted chronologically (oldest → newest). The most-recent visit
 * is the initialSlide (last index). Selecting a slide calls onSelectVisit.
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Keyboard } from 'swiper/modules';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@monobase/ui';
import { getDentalChartOptions } from '@monobase/sdk-ts/generated/react-query';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import { useUpdateVisit } from '@/features/workspace/hooks/use-update-visit';
import { getDentitionType } from '@/features/workspace/components/dental-chart.helpers';
import type { ToothData, DentitionType } from '@/features/workspace/components/dental-chart.helpers';
import { DentalChart } from '@/features/workspace/components/dental-chart';

export interface VisitCard {
  id: string;
  status: 'draft' | 'active' | 'completed' | 'locked';
  createdAt: string;
  chiefComplaint?: string;
  activatedAt?: string;
  completedAt?: string;
}

export interface TimelineCarouselProps {
  visits: VisitCard[];
  patientId: string;
  currentVisitId?: string;
  onSelectVisit: (visitId: string) => void;
  onNewVisit: () => void;
  /** Called when a tooth is selected on the active slide */
  onSelectTooth?: (toothNumber: number) => void;
  /** When true, narrows the carousel to make room for the slideout panel */
  panelOpen?: boolean;
  /** Patient date of birth (ISO date string) — used to select dentition type */
  patientDateOfBirth?: string | null;
  /** FDI numbers with a completed (performed) treatment on the current visit — drives the chart's 'completed' layer. */
  completedToothNumbers?: Set<number>;
}

/** Per-card component that fetches its own chart data */
function VisitChartCard({
  visit,
  isActive,
  onSelectTooth,
  onLockVisit,
  lockPending,
  dentitionType,
  completedToothNumbers,
}: {
  visit: VisitCard;
  isActive: boolean;
  onSelectTooth?: (toothNumber: number) => void;
  onLockVisit?: (visitId: string) => void;
  lockPending?: boolean;
  dentitionType: DentitionType;
  completedToothNumbers?: Set<number>;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    ...getDentalChartOptions({ path: { visitId: visit.id } }),
    select: (raw) => {
      const chart = raw as { teeth?: ToothData[] } | null;
      return chart?.teeth ?? [];
    },
  });
  const teeth = data ?? [];

  return (
    <div
      data-testid="visit-slide"
      data-active-card={isActive ? '1' : undefined}
      className={`h-full rounded-2xl border bg-card p-3 pt-4 flex flex-col gap-2 transition-shadow ${isActive ? 'border-[#FFCC5E] border-2 shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.04)]' : 'border-border shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]'}`}
    >
      {isActive && <div data-accent-bar className="h-1 rounded-full bg-[#FFE97D]" />}
      <div className="overflow-x-auto flex-1 min-h-0">
        {isLoading ? (
          <div data-testid="visit-chart-loading" className="flex flex-col gap-2 p-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <div
            data-testid="visit-chart-error"
            className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
          >
            <p className="text-sm text-destructive">Failed to load chart.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <DentalChart
            teeth={teeth}
            onSelectTooth={isActive ? onSelectTooth : undefined}
            toothSize={isActive ? 'md' : 'xs'}
            showLegend={false}
            showLayerToggle={isActive}
            completedToothNumbers={isActive ? completedToothNumbers : undefined}
            dentitionType={dentitionType}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground">{formatDate(visit.activatedAt ?? visit.createdAt)}</span>
        <div className="flex items-center gap-1.5">
          {visit.status === 'completed' && onLockVisit && (
            <button
              type="button"
              disabled={lockPending}
              onClick={() => {
                if (window.confirm('Lock this visit? Locked visits cannot be edited.')) {
                  onLockVisit(visit.id);
                }
              }}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-50"
            >
              <Lock className="inline size-3 mr-1" />Lock Visit
            </button>
          )}
          {visit.status === 'locked' && (
            <Lock className="size-3 text-muted-foreground" aria-label="Visit locked" />
          )}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${
              visit.status === 'active'
                ? 'bg-green-100 text-green-700'
                : visit.status === 'completed'
                ? 'bg-blue-100 text-blue-700'
                : visit.status === 'locked'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {visit.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TimelineCarousel({
  visits,
  patientId,
  currentVisitId,
  onSelectVisit,
  onNewVisit,
  onSelectTooth,
  panelOpen = false,
  patientDateOfBirth = null,
  completedToothNumbers,
}: TimelineCarouselProps) {
  const lockMutation = useUpdateVisit(patientId);
  const dentitionType = getDentitionType(patientDateOfBirth);
  // Sort oldest → newest so initialSlide = last index = most recent
  const sorted = [...visits].sort(
    (a, b) =>
      new Date(a.activatedAt ?? a.createdAt).getTime() -
      new Date(b.activatedAt ?? b.createdAt).getTime(),
  );

  const initialSlide = Math.max(0, sorted.length - 1);
  const [activeIndex, setActiveIndex] = useState(initialSlide);
  const swiperRef = useRef<{ slideTo: (index: number) => void } | null>(null);

  // WR-02: when the selected visit changes (e.g. a freshly-created visit becomes
  // current), focus its card. Swiper only honors initialSlide on mount, so sync
  // imperatively here.
  useEffect(() => {
    if (!currentVisitId) return;
    const idx = sorted.findIndex((v) => v.id === currentVisitId);
    if (idx >= 0 && idx !== activeIndex) {
      setActiveIndex(idx);
      swiperRef.current?.slideTo(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVisitId, sorted.length]);

  function handleSlideChange(swiper: { activeIndex: number }) {
    const idx = swiper.activeIndex;
    setActiveIndex(idx);
    const visit = sorted[idx];
    // Only notify the parent when the visit actually changed, to avoid feedback
    // loops with the currentVisitId-driven sync effect above.
    if (visit && visit.id !== currentVisitId) onSelectVisit(visit.id);
  }

  return (
    <div
      data-testid="timeline-carousel"
      className="flex flex-col gap-4 py-4 transition-all duration-300"
      style={{ width: panelOpen ? 'calc(100% - 340px)' : '100%' }}
    >
      <Swiper
        modules={[EffectCoverflow, Pagination, Keyboard]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        observer
        observeParents
        initialSlide={initialSlide}
        onSwiper={(s: { slideTo: (index: number) => void }) => { swiperRef.current = s; }}
        onSlideChange={handleSlideChange}
        coverflowEffect={{ rotate: 35, stretch: 0, depth: 200, modifier: 1, scale: 0.72, slideShadows: false }}
        pagination={{ clickable: true }}
        keyboard={{ enabled: true }}
        className="dental-swiper"
      >
        {sorted.map((visit, idx) => {
          const isActive = idx === activeIndex;
          return (
            <SwiperSlide key={visit.id}>
              <VisitChartCard
                visit={visit}
                isActive={isActive}
                onSelectTooth={onSelectTooth}
                onLockVisit={(visitId) =>
                  lockMutation.mutate({ path: { visitId }, body: { status: 'locked' } })
                }
                lockPending={lockMutation.isPending}
                dentitionType={dentitionType}
                completedToothNumbers={completedToothNumbers}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>

      <button
        type="button"
        data-testid="new-visit-btn"
        onClick={onNewVisit}
        className="self-center rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 px-6 py-3 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Start new visit"
      >
        <span className="text-2xl text-muted-foreground leading-none">+</span>
        <span className="text-xs text-muted-foreground font-medium">New Visit</span>
      </button>
    </div>
  );
}
