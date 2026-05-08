import type { ConditionType } from '@/data/mock-visits'
import { UniversalTooth } from './dental/universal-tooth'
import { CONDITION_COLORS } from './dental/constants'
import type { SurfaceStatus } from './dental/types'

interface ToothColumnProps {
  toothNumber: number
  condition?: ConditionType
  isSelected?: boolean
  onClick?: () => void
  surfacesStatus?: SurfaceStatus[]
}

export function ToothColumn({ toothNumber, condition, isSelected, onClick, surfacesStatus }: ToothColumnProps) {
  const fillColor = condition ? CONDITION_COLORS[condition] : undefined
  const hasSurfaceColors = surfacesStatus && surfacesStatus.length > 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2px 1px',
        background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
        borderRadius: 4,
        transition: 'background 0.15s',
      }}
    >
      <UniversalTooth
        toothNumber={toothNumber}
        surfacesStatus={hasSurfaceColors ? surfacesStatus : undefined}
        fillColor={hasSurfaceColors ? undefined : fillColor}
        size="sm"
        showLabel={true}
        interactive={true}
        onClick={onClick ? () => onClick() : undefined}
      />
    </div>
  )
}
