import { LANDMARK_CODES, LANDMARK_LABELS } from '../lib/ceph-geometry'
import type { CephLandmark, CephLandmarkCode } from '../hooks/use-ceph-landmarks'

export interface CephLandmarkPaletteProps {
  landmarks: CephLandmark[]
  selectedCode: CephLandmarkCode | null
  onSelect: (code: CephLandmarkCode) => void
}

// D-P single-point / construction tooltips
const D_P_TOOLTIPS: Partial<Record<CephLandmarkCode, string>> = {
  Go: 'Gonion — single-point approximation of bilateral landmark',
  Po: 'Porion — single-point approximation of bilateral landmark',
  Or: 'Orbitale — single-point approximation of bilateral landmark',
  Gn: 'Gnathion — constructed midpoint of Pogonion and Menton when both present; otherwise Menton',
  Me: 'Menton — used as Y-axis substitute when Gnathion not constructed',
}

type Status = 'unplaced' | 'placed' | 'confirmed' | 'locked'

function badgeClass(status: Status): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-900 text-green-300'
    case 'locked':
      return 'bg-slate-700 text-slate-400'
    case 'placed':
      return 'bg-zinc-600 text-zinc-200'
    default:
      return ''
  }
}

export function CephLandmarkPalette({
  landmarks,
  selectedCode,
  onSelect,
}: CephLandmarkPaletteProps) {
  const byCode = new Map(landmarks.map((l) => [l.landmarkCode, l]))
  const codes = LANDMARK_CODES as readonly CephLandmarkCode[]
  const nextUnplaced = codes.find((c) => !byCode.has(c)) ?? null

  return (
    <div className="flex flex-col gap-1 px-4 py-3 overflow-y-auto">
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
        Landmarks
      </span>
      {codes.map((code) => {
        const lm = byCode.get(code)
        const status: Status = lm ? lm.status : 'unplaced'
        const isSelected = selectedCode === code
        const isNext = nextUnplaced === code
        const locked = status === 'locked'
        const isDisabled = locked || status === 'confirmed'
        const tooltip = D_P_TOOLTIPS[code]
        return (
          <button
            key={code}
            type="button"
            disabled={isDisabled}
            title={tooltip}
            data-landmark-code={code}
            data-next-unplaced={isNext ? 'true' : undefined}
            onClick={() => {
              if (isDisabled) return
              onSelect(code)
            }}
            className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm border transition-colors ${
              isSelected
                ? 'bg-[#FFE97D]/20 border-[#FFE97D]'
                : 'border-zinc-700 hover:border-zinc-500'
            } ${isNext ? 'ring-1 ring-[#FFE97D]' : ''} ${
              isDisabled ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            <span className="flex flex-col min-w-0">
              <span className="text-white truncate">{LANDMARK_LABELS[code]}</span>
              <span className="text-[10px] text-zinc-500">{code}</span>
            </span>
            {status !== 'unplaced' && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeClass(status)}`}
              >
                {status}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
