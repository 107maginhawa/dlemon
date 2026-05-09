import { DentalChartGrid } from './dental-chart-grid'
import type { Visit, SurfaceCondition } from '@/data/mock-visits'

interface ChartCardProps {
  visit: Visit
  isActive: boolean
  selectedTooth?: number
  onToothClick?: (toothNumber: number) => void
  surfaceConditions?: SurfaceCondition[]
}

export function ChartCard({ visit, isActive, selectedTooth, onToothClick, surfaceConditions }: ChartCardProps) {
  return (
    <div
      className="relative flex flex-col h-full rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{
        background: '#ffffff',
        border: '1px solid #e8e6e1',
        boxShadow: isActive
          ? '0 8px 40px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)'
          : '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.38s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
    >
      {/* Top accent bar — only on active */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] transition-opacity duration-300"
        style={{
          background: 'linear-gradient(90deg, #2563eb, #8b5cf6)',
          opacity: isActive ? 1 : 0,
        }}
      />

      {/* Chart body */}
      <div className="flex-1 p-3 pt-4 min-h-0 flex flex-col">
        <DentalChartGrid
          conditions={visit.conditions}
          selectedTooth={selectedTooth}
          onToothClick={onToothClick}
          surfaceConditions={surfaceConditions}
        />
      </div>

      {/* Card footer */}
      <div
        className="text-center py-3 text-[13px] font-semibold font-display tracking-wide transition-colors duration-300"
        style={{
          fontFamily: 'Sora, sans-serif',
          color: isActive ? '#2563eb' : '#6b7280',
        }}
      >
        {visit.date}
      </div>
    </div>
  )
}
