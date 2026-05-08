import { useState } from 'react'
import { HeaderBar } from '@/components/header-bar'
import { TimelineCarousel } from '@/components/timeline-carousel'
import { BreakdownTable } from '@/components/breakdown-table'
import { ToothDetailPanel } from '@/components/tooth-detail-panel'
import { visits, type SurfaceCondition, type TreatmentNote } from '@/data/mock-visits'

export default function App() {
  const [activeIndex, setActiveIndex] = useState(visits.length - 1)
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [surfaceConditions, setSurfaceConditions] = useState<SurfaceCondition[]>([])

  const activeVisit = visits[activeIndex] ?? visits[visits.length - 1]

  const newNotes: TreatmentNote[] = surfaceConditions.map(sc => ({
    tooth: `#${sc.toothNumber}`,
    toothNum: sc.toothNumber,
    surface: sc.surfaces.map(s => s[0].toUpperCase()).join(''),
    surfaceType: sc.surfaces.length > 1 ? 'Multi' : 'Single',
    condition: sc.condition.charAt(0).toUpperCase() + sc.condition.slice(1),
    treatment: sc.treatment ?? '',
    done: false,
    total: sc.cost ?? null,
  }))
  const mergedNotes = [...activeVisit.notes, ...newNotes]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="relative z-[1] max-w-[1200px] mx-auto px-6 py-4 pb-12">
          <HeaderBar
            patientName="Russel Herrera"
            dateLabel={`Today's Baseline — ${activeVisit.date}`}
          />

          <TimelineCarousel
            visits={visits}
            activeIndex={activeIndex}
            onSlideChange={setActiveIndex}
            selectedTooth={selectedTooth ?? undefined}
            onToothClick={setSelectedTooth}
            surfaceConditions={surfaceConditions}
          />

          <BreakdownTable notes={mergedNotes} />
        </div>
      </div>

      {/* Right panel - only when a tooth is selected */}
      {selectedTooth !== null && (
        <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid #e8e6e1', background: '#ffffff', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
          <ToothDetailPanel
            toothNumber={selectedTooth}
            existingConditions={surfaceConditions.filter(sc => sc.toothNumber === selectedTooth)}
            onSave={(condition) => {
              setSurfaceConditions(prev => [...prev, condition])
              setSelectedTooth(null)
            }}
            onClose={() => setSelectedTooth(null)}
          />
        </div>
      )}
    </div>
  )
}
