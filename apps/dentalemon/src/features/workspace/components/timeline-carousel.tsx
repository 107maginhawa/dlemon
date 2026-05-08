/**
 * TimelineCarousel — Swiper EffectCoverflow visit history browser
 *
 * Visits are sorted chronologically (oldest → newest). The most-recent visit
 * is the initialSlide (last index). Selecting a slide calls onSelectVisit.
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import type { ToothData } from '@/features/workspace/components/dental-chart.helpers';
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
  currentVisitId?: string;
  onSelectVisit: (visitId: string) => void;
  onNewVisit: () => void;
  /** Tooth data displayed in each slide's dental chart */
  teeth?: ToothData[];
  /** Called when a tooth is selected on the active slide */
  onSelectTooth?: (toothNumber: number) => void;
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
  onSelectVisit,
  onNewVisit,
  teeth = [],
}: TimelineCarouselProps) {
  // Sort oldest → newest so initialSlide = last index = most recent
  const sorted = [...visits].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const initialSlide = Math.max(0, sorted.length - 1);
  const [activeIndex, setActiveIndex] = useState(initialSlide);

  function handleSlideChange(swiper: { activeIndex: number }) {
    const idx = swiper.activeIndex;
    setActiveIndex(idx);
    const visit = sorted[idx];
    if (visit) onSelectVisit(visit.id);
  }

  return (
    <div data-testid="timeline-carousel" className="flex flex-col gap-4 py-4">
      <Swiper
        modules={[EffectCoverflow, Pagination, Keyboard]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        initialSlide={initialSlide}
        onSlideChange={handleSlideChange}
        coverflowEffect={{ rotate: 30, stretch: 0, depth: 100, modifier: 1, slideShadows: false }}
        pagination={{ clickable: true }}
        keyboard={{ enabled: true }}
      >
        {sorted.map((visit, idx) => {
          const isActive = idx === activeIndex;
          return (
            <SwiperSlide key={visit.id}>
              <div
                data-active-card={isActive ? '1' : undefined}
                className="rounded-xl border bg-card p-4 flex flex-col gap-2"
              >
                {isActive && <div data-accent-bar className="h-1 rounded-full bg-[#FFE97D]" />}
                <DentalChart teeth={teeth} />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{formatDate(visit.createdAt)}</span>
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
