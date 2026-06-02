import { LANDMARK_CODES, LANDMARK_LABELS } from '../lib/ceph-geometry'
import type { CephLandmark, CephLandmarkCode } from '../hooks/use-ceph-landmarks'
import { CEPH_LOW_CONFIDENCE_THRESHOLD } from '../hooks/use-ceph-landmarks'

export interface CephLandmarkPaletteProps {
  landmarks: CephLandmark[]
  selectedCode: CephLandmarkCode | null
  onSelect: (code: CephLandmarkCode) => void
}

// One-line anatomical hint per landmark — shown inline under the active landmark and
// as a hover title. Go/Po/Or/Gn/Me keep their D-P single-point/construction notes.
const D_P_TOOLTIPS: Record<CephLandmarkCode, string> = {
  S: 'Sella — center of the sella turcica (pituitary fossa)',
  N: 'Nasion — most anterior point of the frontonasal suture',
  A: 'A-point (Subspinale) — deepest point on the maxillary curve below ANS',
  B: 'B-point (Supramentale) — deepest point on the mandibular curve above Pogonion',
  ANS: 'Anterior nasal spine — tip of the anterior nasal spine',
  PNS: 'Posterior nasal spine — tip of the posterior nasal spine',
  Go: 'Gonion — single-point approximation of bilateral landmark (mandibular angle)',
  Po: 'Porion — single-point approximation of bilateral landmark (auditory meatus)',
  Or: 'Orbitale — single-point approximation of bilateral landmark (lowest orbital rim)',
  Me: 'Menton — lowest point of the mandibular symphysis (Y-axis substitute when Gnathion absent)',
  Pog: 'Pogonion — most anterior point of the bony chin',
  Gn: 'Gnathion — constructed midpoint of Pogonion and Menton when both present; otherwise Menton',
  U1T: 'Upper incisor tip — incisal edge of the most prominent upper central incisor',
  U1A: 'Upper incisor apex — root apex of that upper central incisor',
  L1T: 'Lower incisor tip — incisal edge of the most prominent lower central incisor',
  L1A: 'Lower incisor apex — root apex of that lower central incisor',
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
  // Show the anatomical hint for the landmark the clinician is about to place
  // (the selected one, or the next unplaced) — active landmark only, not all 16.
  const activeCode = selectedCode ?? nextUnplaced

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
        // Only locked points are immutable. Confirmed (not locked) stay selectable
        // so the clinician can re-select them for arrow-key nudging (#13).
        const isDisabled = locked
        const tooltip = D_P_TOOLTIPS[code]
        const showHint = code === activeCode
        // P1-10 AI provenance display helpers.
        const confidencePct =
          lm && lm.confidence != null ? Math.round(lm.confidence * 100) : null
        const lowConfidence =
          lm != null && lm.confidence != null && lm.confidence < CEPH_LOW_CONFIDENCE_THRESHOLD
        return (
          <div key={code} className="flex flex-col">
          <button
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
            {/* P1-10: AI-suggested-unconfirmed points read distinctly from a
                human 'placed' point — "AI · unconfirmed" + confidence, with a
                low-confidence flag. Deliberately NOT the lemon accent (cyan/amber). */}
            {lm && lm.source === 'ai' && status === 'placed' ? (
              <span className="flex items-center gap-1">
                {lowConfidence && (
                  <span
                    data-ai-low-confidence={code}
                    title="Low confidence — review carefully"
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-900 text-amber-300"
                  >
                    low
                  </span>
                )}
                <span
                  data-ai-unconfirmed={code}
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-sky-900 text-sky-300"
                >
                  AI · unconfirmed{confidencePct != null ? ` ${confidencePct}%` : ''}
                </span>
              </span>
            ) : (
              status !== 'unplaced' && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeClass(status)}`}
                >
                  {lm && lm.source === 'ai_corrected' ? 'AI · corrected' : status}
                </span>
              )
            )}
          </button>
          {showHint && (
            <p
              data-landmark-hint={code}
              className="px-3 pt-1 pb-0.5 text-[10px] text-zinc-500 leading-snug"
            >
              {tooltip}
            </p>
          )}
          </div>
        )
      })}
    </div>
  )
}
