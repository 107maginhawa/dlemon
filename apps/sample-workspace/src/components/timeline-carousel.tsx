import { useRef } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCoverflow, Pagination, Keyboard } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'

import { ChartCard } from './chart-card'
import type { Visit, SurfaceCondition } from '@/data/mock-visits'

interface TimelineCarouselProps {
  visits: Visit[]
  activeIndex: number
  onSlideChange: (index: number) => void
  selectedTooth?: number
  onToothClick?: (toothNumber: number) => void
  surfaceConditions?: SurfaceCondition[]
  panelOpen?: boolean
}

export function TimelineCarousel({ visits, activeIndex, onSlideChange, selectedTooth, onToothClick, surfaceConditions, panelOpen }: TimelineCarouselProps) {
  const swiperRef = useRef<SwiperType | null>(null)
  const carouselWidth = panelOpen ? 'calc(100vw - 340px)' : '100vw'

  return (
    <div
      className="relative"
      style={{
        width: carouselWidth,
        position: 'relative',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '20px',
      }}
    >
      <Swiper
        modules={[EffectCoverflow, Pagination, Keyboard]}
        className="dental-swiper"
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        initialSlide={visits.length - 1}
        coverflowEffect={{
          rotate: 35,
          stretch: 0,
          depth: 200,
          modifier: 1,
          scale: 0.72,
          slideShadows: false,
        }}
        pagination={{ clickable: true }}
        keyboard={{ enabled: true }}
        onSwiper={(swiper: SwiperType) => { swiperRef.current = swiper }}
        onSlideChange={(swiper: SwiperType) => onSlideChange(swiper.activeIndex)}
      >
        {visits.map((visit, idx) => (
          <SwiperSlide key={visit.id}>
            <ChartCard
              visit={visit}
              isActive={idx === activeIndex}
              selectedTooth={idx === activeIndex ? selectedTooth : undefined}
              onToothClick={idx === activeIndex ? onToothClick : undefined}
              surfaceConditions={idx === activeIndex ? surfaceConditions : undefined}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
