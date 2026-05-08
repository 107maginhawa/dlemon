import { ToothColumn } from './tooth-column'
import type { ConditionType, SurfaceCondition } from '@/data/mock-visits'
import type { SurfaceStatus } from './dental/types'
import { CONDITION_COLORS } from './dental/constants'

interface DentalChartGridProps {
  conditions: Record<number, ConditionType>
  selectedTooth?: number
  onToothClick?: (toothNumber: number) => void
  surfaceConditions?: SurfaceCondition[]
}

const UPPER_ROW = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const LOWER_ROW = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17]

function cellStyle(idx: number): React.CSSProperties {
  return {
    flex: '1 1 0',
    minWidth: 0,
    overflow: 'hidden',
    borderRight: idx === 7
      ? '1px dashed #ccc'
      : idx === 15
        ? 'none'
        : '1px solid #ececec',
  }
}

function getSurfaceStatusForTooth(
  toothNumber: number,
  surfaceConditions: SurfaceCondition[],
): SurfaceStatus[] {
  const matching = surfaceConditions.filter(sc => sc.toothNumber === toothNumber)
  const statuses: SurfaceStatus[] = []
  for (const sc of matching) {
    const color = CONDITION_COLORS[sc.condition]
    for (const surface of sc.surfaces) {
      statuses.push({
        surface,
        colorCoding: color,
        statusDesc: sc.condition,
        surfaceName: surface,
      })
    }
  }
  return statuses
}

function Row({
  teeth,
  conditions,
  selectedTooth,
  onToothClick,
  borderBottom,
  surfaceConditions,
}: {
  teeth: number[]
  conditions: Record<number, ConditionType>
  selectedTooth?: number
  onToothClick?: (n: number) => void
  borderBottom?: string
  surfaceConditions: SurfaceCondition[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom, minHeight: 0, overflow: 'hidden' }}>
      {teeth.map((tooth, idx) => (
        <div key={tooth} style={cellStyle(idx)}>
          <ToothColumn
            toothNumber={tooth}
            condition={conditions[tooth]}
            isSelected={selectedTooth === tooth}
            onClick={() => onToothClick?.(tooth)}
            surfacesStatus={getSurfaceStatusForTooth(tooth, surfaceConditions)}
          />
        </div>
      ))}
    </div>
  )
}

export function DentalChartGrid({ conditions, selectedTooth, onToothClick, surfaceConditions }: DentalChartGridProps) {
  return (
    <div
      className="w-full flex-1 rounded-md"
      style={{
        border: '1px solid #e5e5e5',
        background: '#fafaf9',
        display: 'grid',
        gridTemplateRows: '1fr 1fr',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Upper arch — teeth 1-16 */}
      <Row teeth={UPPER_ROW} conditions={conditions} selectedTooth={selectedTooth} onToothClick={onToothClick} borderBottom="2px dashed #d4d4d4" surfaceConditions={surfaceConditions ?? []} />
      {/* Lower arch — teeth 32-17 */}
      <Row teeth={LOWER_ROW} conditions={conditions} selectedTooth={selectedTooth} onToothClick={onToothClick} surfaceConditions={surfaceConditions ?? []} />
    </div>
  )
}
