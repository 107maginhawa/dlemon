import { useState } from 'react'
import { X, Lock, FileText, Download, RefreshCw } from 'lucide-react'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@monobase/ui'
import { ANALYSIS_TYPES, NORM_POPULATIONS, DEFAULT_POPULATION, getPopulationLabel } from '@monobase/ceph-math'
import { useMutation } from '@tanstack/react-query'
import { cephMgmtCreateCephReport } from '@monobase/sdk-ts/generated'
import { useCephLandmarks } from '../hooks/use-ceph-landmarks'
import { useCephAnalysis } from '../hooks/use-ceph-analysis'
import type { CephLandmarkCode } from '../hooks/use-ceph-landmarks'
import { CephLayerPanel, type LayerState } from './CephLayerPanel'
import { CephMeasurementsPanel } from './CephMeasurementsPanel'
import { CephLandmarkPalette } from './CephLandmarkPalette'

export interface CephWorkspacePanelProps {
  imageId: string
  isOpen: boolean
  onClose: () => void
  /** Called after report version is created; parent composites canvas + downloads PNG */
  onExportPng?: (reportVersion: number) => void
  /** Called when a layer toggle changes; parent uses this to show/hide canvas overlays */
  onLayerChange?: (key: keyof LayerState, value: boolean) => void
  /**
   * Controlled landmark selection. When provided, the workspace owns selection
   * (shared with the canvas landmark layer + keyboard flow + loupe). Omit for
   * the uncontrolled fallback (internal state) used by isolated tests.
   */
  selectedCode?: CephLandmarkCode | null
  onSelectCode?: (code: CephLandmarkCode | null) => void
  /**
   * Controlled analysis protocol. When provided, the workspace owns the selected
   * analysisType so the on-canvas angle arcs (driven by the workspace's own
   * useCephAnalysis) and this panel's measurements table read the SAME protocol.
   * Omit for the uncontrolled fallback (internal state) used by isolated tests.
   */
  analysisType?: string
  onAnalysisTypeChange?: (analysisType: string) => void
}

// D-L: report gate landmarks
const GATE_CODES: CephLandmarkCode[] = ['A', 'B', 'Go', 'Po']

// #15 / P1-8: human-readable protocol labels for the analysis switcher.
// Wits is a single metric (AO-BO), NOT a protocol — intentionally not listed.
const ANALYSIS_LABELS: Record<string, string> = {
  steiner_hybrid_sn: 'Steiner (SN)',
  ricketts: 'Ricketts (FH)',
  downs: 'Downs (FH)',
  tweed: 'Tweed (FH)',
  mcnamara: 'McNamara',
  jarabak: 'Jarabak',
}

function isAddonError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  // V-IMG-002: tier blocks now carry the dedicated IMAGING_TIER_REQUIRED code (§9 upgrade UI).
  return /403|forbidden|add-?on|imaging_tier_required/i.test(msg)
}

// P1-10: the auto-landmark kill-switch returns 403 FEATURE_DISABLED when the
// dental_imaging_auto_landmark flag is off — distinct from a tier block.
function isFeatureDisabledError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  return /feature_disabled/i.test(msg)
}

export function CephWorkspacePanel({
  imageId,
  isOpen,
  onClose,
  onExportPng,
  onLayerChange,
  selectedCode: controlledSelectedCode,
  onSelectCode,
  analysisType: controlledAnalysisType,
  onAnalysisTypeChange,
}: CephWorkspacePanelProps) {
  const { landmarks, commitLandmark, autoDetect } = useCephLandmarks(imageId)
  // #15: analysis protocol switcher. Drives the analysis query + measurements panel.
  // Controlled/uncontrolled (mirrors selectedCode): when the workspace owns
  // analysisType it shares the value with the canvas arc layer so both stay in sync.
  const [internalAnalysisType, setInternalAnalysisType] = useState<string>('steiner_hybrid_sn')
  const analysisType = controlledAnalysisType ?? internalAnalysisType
  const setAnalysisType = onAnalysisTypeChange ?? setInternalAnalysisType
  // P2-6: reference-population selector for norm display (default = classic literature).
  const [population, setPopulation] = useState<string>(DEFAULT_POPULATION)
  const { analysis, isError } = useCephAnalysis(imageId, analysisType)

  // Controlled/uncontrolled selection: when the parent passes selectedCode +
  // onSelectCode the workspace owns it (shared with canvas/keyboard/loupe);
  // otherwise fall back to local state (isolated component tests).
  const [internalSelectedCode, setInternalSelectedCode] = useState<CephLandmarkCode | null>(null)
  const selectedCode = controlledSelectedCode !== undefined ? controlledSelectedCode : internalSelectedCode
  const setSelectedCode = onSelectCode ?? setInternalSelectedCode
  const [layers, setLayers] = useState<LayerState>({
    landmarks: true,
    tracing: true,
    arcs: true,
  })
  const [createdVersion, setCreatedVersion] = useState<number | null>(null)

  const createReport = useMutation({
    mutationFn: async () => {
      const { data } = await cephMgmtCreateCephReport({
        path: { imageId },
        throwOnError: true,
      })
      // data is DentalImagingModuleCephReport | ErrorResponse; narrow via 'version'.
      return data as { version: number }
    },
    onSuccess: (data) => {
      setCreatedVersion(data.version)
    },
  })

  // useCephLandmarks swallows query errors into landmarks=[]; surface addon
  // state by also reading the analysis query error (same 403 boundary).
  const addonRequired = isError

  if (!isOpen) return null

  function handleLayerChange(key: keyof LayerState, value: boolean) {
    setLayers((prev) => ({ ...prev, [key]: value }))
    onLayerChange?.(key, value)
  }

  const confirmedCodes = new Set(
    landmarks
      .filter((l) => l.status === 'confirmed' || l.status === 'locked')
      .map((l) => l.landmarkCode),
  )
  const unconfirmed = GATE_CODES.filter((c) => !confirmedCodes.has(c))
  const gatePassed = unconfirmed.length === 0

  function handleLockAll() {
    // F4 wires the real lock flow; F3 only surfaces the affordance.
    for (const l of landmarks) {
      if (l.status === 'confirmed') {
        commitLandmark.mutate({
          code: l.landmarkCode,
          x: l.x,
          y: l.y,
          status: 'locked',
        })
      }
    }
  }

  return (
    <div className="w-80 min-w-[20rem] flex flex-col border-l border-zinc-700 bg-zinc-900 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Cephalometric</span>
          {/* #15: analysis-protocol switcher (was a static D-G badge). Data-driven. */}
          <Select value={analysisType} onValueChange={setAnalysisType}>
            <SelectTrigger
              aria-label="Analysis protocol"
              className="h-6 gap-1 rounded-full border-zinc-700 bg-zinc-700 px-2 py-0 text-[10px] font-medium text-lemon"
            >
              <SelectValue>{ANALYSIS_LABELS[analysisType] ?? analysisType}</SelectValue>
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-800 text-zinc-100">
              {ANALYSIS_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {ANALYSIS_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* P2-6: reference-population selector — switches the norm set used for chips. */}
          <Select value={population} onValueChange={setPopulation}>
            <SelectTrigger
              aria-label="Norm population"
              className="h-6 gap-1 rounded-full border-zinc-700 bg-zinc-700 px-2 py-0 text-[10px] font-medium text-zinc-300"
            >
              <SelectValue>{getPopulationLabel(population)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-800 text-zinc-100">
              {NORM_POPULATIONS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {getPopulationLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={onClose}
          aria-label="Close ceph panel"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {addonRequired ? (
        <div className="px-4 py-3 m-4 rounded-md bg-zinc-800 border border-zinc-700">
          <p className="text-sm text-lemon">
            Cephalometric analysis requires the Addon tier
          </p>
        </div>
      ) : (
        <>
          <CephLayerPanel layers={layers} onChange={handleLayerChange} />

          <CephMeasurementsPanel analysis={analysis ?? null} population={population} />

          {/* D-L: confirm gate */}
          <div className="px-4 py-3 border-b border-zinc-700">
            {gatePassed ? (
              <p className="text-xs text-green-400">
                Gate landmarks confirmed
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-zinc-400">
                  Report requires A, B, Go, Po confirmed
                </p>
                <p className="text-[10px] text-zinc-500">
                  Unconfirmed: {unconfirmed.join(', ')}
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <Button
                type="button"
                disabled={!gatePassed || createReport.isPending}
                onClick={() => createReport.mutate()}
                className="bg-lemon text-zinc-900 hover:bg-lemon/90 text-xs font-medium flex-1"
              >
                <FileText size={12} className="mr-1" />
                {createReport.isPending ? 'Creating…' : 'Generate Report'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleLockAll}
                className="border-zinc-600 text-zinc-300 text-xs"
              >
                <Lock size={12} className="mr-1" />
                Lock all confirmed
              </Button>
            </div>

            {createdVersion != null && (
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-600 text-zinc-300 text-xs flex-1"
                  onClick={() => {
                    window.open(
                      `/imaging-ceph-report/${imageId}?version=${createdVersion}`,
                      '_blank',
                    )
                  }}
                >
                  <FileText size={12} className="mr-1" />
                  View Report (v{createdVersion})
                </Button>
                {onExportPng && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-600 text-zinc-300 text-xs"
                    onClick={() => onExportPng(createdVersion)}
                  >
                    <Download size={12} className="mr-1" />
                    PNG
                  </Button>
                )}
              </div>
            )}

            {createReport.isError && (
              <p className="text-xs text-red-400 mt-1">
                {String(createReport.error)}
              </p>
            )}
          </div>

          {/* P1-10: AI / auto landmark detection (addon + dental_imaging_auto_landmark
              flag gated). Primary action uses LEMON TOKENS. The AI visual state on the
              overlay / palette deliberately does NOT use the lemon accent. */}
          <div className="px-4 py-3 border-b border-zinc-700">
            <Button
              type="button"
              disabled={autoDetect.isPending}
              onClick={() => autoDetect.mutate()}
              className="bg-lemon hover:bg-lemon-hover text-lemon-foreground text-xs font-medium w-full"
            >
              <RefreshCw size={12} className="mr-1" />
              {autoDetect.isPending ? 'Detecting…' : 'Auto-detect landmarks'}
            </Button>
            {/* Honest disclosure (plan §4) — every AI point is a draft to confirm. */}
            <p data-ai-disclosure className="mt-2 text-[10px] text-zinc-500 leading-snug">
              Landmarks suggested by automated detection — confirm each before
              generating a report.
            </p>
            {autoDetect.isError && (
              <p data-ai-detect-error className="mt-1 text-xs text-amber-400">
                {isFeatureDisabledError(autoDetect.error)
                  ? 'Automatic detection is currently disabled.'
                  : isAddonError(autoDetect.error)
                    ? 'Automatic detection requires the imaging add-on.'
                    : 'Detection failed. Place landmarks manually.'}
              </p>
            )}
          </div>

          <CephLandmarkPalette
            landmarks={landmarks}
            selectedCode={selectedCode}
            onSelect={setSelectedCode}
          />
        </>
      )}
    </div>
  )
}
