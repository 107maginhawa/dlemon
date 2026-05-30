import { useState } from 'react'
import { X, Lock, FileText, Download } from 'lucide-react'
import { Button } from '@monobase/ui'
import { useMutation } from '@tanstack/react-query'
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
}

// D-L: report gate landmarks
const GATE_CODES: CephLandmarkCode[] = ['A', 'B', 'Go', 'Po']

function isAddonError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  // V-IMG-002: tier blocks now carry the dedicated IMAGING_TIER_REQUIRED code (§9 upgrade UI).
  return /403|forbidden|add-?on|imaging_tier_required/i.test(msg)
}

export function CephWorkspacePanel({
  imageId,
  isOpen,
  onClose,
  onExportPng,
  onLayerChange,
}: CephWorkspacePanelProps) {
  const { landmarks, commitLandmark } = useCephLandmarks(imageId)
  const { analysis, isError } = useCephAnalysis(imageId)

  const [selectedCode, setSelectedCode] = useState<CephLandmarkCode | null>(null)
  const [layers, setLayers] = useState<LayerState>({
    landmarks: true,
    tracing: true,
    arcs: true,
  })
  const [createdVersion, setCreatedVersion] = useState<number | null>(null)

  const createReport = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/dental/imaging/images/${imageId}/ceph/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ version: number }>
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
          {/* D-G: driven from analysis (not hard-coded) so it tracks the active protocol */}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-[#FFE97D] font-medium">
            {analysis?.analysisType ?? 'steiner_hybrid_sn'}
          </span>
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
          <p className="text-sm text-[#FFE97D]">
            Cephalometric analysis requires the Addon tier
          </p>
        </div>
      ) : (
        <>
          <CephLayerPanel layers={layers} onChange={handleLayerChange} />

          <CephMeasurementsPanel analysis={analysis ?? null} />

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
                className="bg-[#FFE97D] text-zinc-900 hover:bg-[#FFE97D]/90 text-xs font-medium flex-1"
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
