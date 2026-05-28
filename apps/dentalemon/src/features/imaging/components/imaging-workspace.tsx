import { useEffect, useRef, useState, useCallback } from 'react'
import { composeCephCanvas, canvasToPngBlob } from '../../../lib/ceph-export'
import type { LayerState } from './CephLayerPanel'
import { useOfflineCache } from '../hooks/use-offline-cache'
import { useMeasurements, type ImagingAnnotation } from '../hooks/use-measurements'
import { MeasurementToolbar, type ToolMode } from './measurement-toolbar'
import { AnnotationToolbar } from './annotation-toolbar'
import { CalibrationDialog } from './calibration-dialog'
import { FindingsSidebar } from './FindingsSidebar'
import { CephWorkspacePanel } from './CephWorkspacePanel'
import { CephLandmarkLayer } from './CephLandmarkLayer'
import { CephTracingOverlay } from './CephTracingOverlay'
import { CephAngleArcLayer } from './CephAngleArcLayer'
import { useCephLandmarks } from '../hooks/use-ceph-landmarks'
import { useCephAnalysis } from '../hooks/use-ceph-analysis'
import type { CephTransformState } from '@monobase/ceph-math'
import { computeAngleDeg, computePolygonArea, euclidean } from '../lib/geometry'

interface ImagingWorkspaceProps {
  imageId: string
  imageUrl: string
  className?: string
  toolMode?: ToolMode
  onToolModeChange?: (mode: ToolMode) => void
  onMeasurementSaved?: () => void
  modality?: string
  pixelSpacingMm?: number | null
  onCalibrationSaved?: (pxMm: number) => void
  visitId?: string
  patientId?: string
  branchId?: string
}

// --- Sub-components ---

interface MeasurementShapeProps {
  annotation: ImagingAnnotation
  pixelSpacingMm: number | null | undefined
  onDelete: (id: string) => void
  onAnnotationClick?: (id: string) => void
}

function MeasurementShape({ annotation, onDelete }: MeasurementShapeProps) {
  const geo = annotation.geometry as Record<string, unknown>

  if (annotation.type === 'line' || annotation.type === 'distance') {
    const pts = geo.points as { x: number; y: number }[] | undefined
    if (!pts || pts.length < 2) return null
    const p1 = pts[0]!
    const p2 = pts[1]!
    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    const label =
      annotation.measurementValue !== null
        ? `${annotation.measurementValue.toFixed(1)} ${annotation.measurementUnit ?? 'px'}`
        : ''
    return (
      <g>
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#FFE97D" strokeWidth={2} />
        <text x={mx} y={my - 6} fill="#FFE97D" fontSize={12} textAnchor="middle">
          {label}
        </text>
        <circle
          cx={p2.x}
          cy={p2.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  if (annotation.type === 'angle') {
    const pts = geo.points as { x: number; y: number }[] | undefined
    if (!pts || pts.length < 3) return null
    const p1 = pts[0]!
    const p2 = pts[1]!
    const p3 = pts[2]!
    const label =
      annotation.measurementValue !== null
        ? `${annotation.measurementValue.toFixed(1)}°`
        : ''
    return (
      <g>
        <polyline
          points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
          fill="none"
          stroke="#FFE97D"
          strokeWidth={2}
        />
        <text x={p2.x} y={p2.y - 8} fill="#FFE97D" fontSize={12} textAnchor="middle">
          {label}
        </text>
        <circle
          cx={p3.x}
          cy={p3.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  if (annotation.type === 'area') {
    const pts = geo.points as { x: number; y: number }[] | undefined
    if (!pts || pts.length < 3) return null
    const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ')
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const lastPt = pts[pts.length - 1]!
    const label =
      annotation.measurementValue !== null
        ? `${annotation.measurementValue.toFixed(1)} ${annotation.measurementUnit ?? 'px²'}`
        : ''
    return (
      <g>
        <polygon
          points={pointsStr}
          fill="#FFE97D"
          fillOpacity={0.2}
          stroke="#FFE97D"
          strokeWidth={2}
        />
        <text x={cx} y={cy} fill="#FFE97D" fontSize={12} textAnchor="middle">
          {label}
        </text>
        <circle
          cx={lastPt.x}
          cy={lastPt.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  return null
}

// --- Annotation shape renderer ---

function AnnotationShape({ annotation, onDelete, onAnnotationClick }: MeasurementShapeProps) {
  const geo = annotation.geometry as Record<string, unknown>

  if (annotation.type === 'label') {
    const pt = geo.point as { x: number; y: number } | undefined
    const text = geo.text as string | undefined
    if (!pt || !text) return null
    return (
      <g
        style={{ cursor: onAnnotationClick ? 'pointer' : 'default' }}
        onClick={() => onAnnotationClick?.(annotation.id)}
      >
        {/* UJ-IMG-002: annotation text rendered as JSX string child — React escapes it, no XSS possible */}
        <text x={pt.x} y={pt.y} fill="#FFE97D" fontSize={13} fontWeight={600}>
          {text}
        </text>
        <circle
          cx={pt.x}
          cy={pt.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onDelete(annotation.id) }}
        />
      </g>
    )
  }

  if (annotation.type === 'arrow') {
    const from = geo.from as { x: number; y: number } | undefined
    const to = geo.to as { x: number; y: number } | undefined
    if (!from || !to) return null
    return (
      <g>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="#FFE97D"
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />
        <circle
          cx={to.x}
          cy={to.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  if (annotation.type === 'freehand') {
    const pts = geo.points as { x: number; y: number }[] | undefined
    if (!pts || pts.length < 2) return null
    const lastPt = pts[pts.length - 1]!
    return (
      <g>
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#FFE97D"
          strokeWidth={2}
        />
        <circle
          cx={lastPt.x}
          cy={lastPt.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  if (annotation.type === 'shape') {
    const shapeType = geo.shapeType as 'rect' | 'ellipse' | undefined
    const x = geo.x as number | undefined
    const y = geo.y as number | undefined
    const width = geo.width as number | undefined
    const height = geo.height as number | undefined
    if (shapeType == null || x == null || y == null || width == null || height == null) return null

    const deleteX = x + (width ?? 0)
    const deleteY = y

    if (shapeType === 'rect') {
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="#FFE97D"
            fillOpacity={0.1}
            stroke="#FFE97D"
            strokeWidth={2}
          />
          <circle
            cx={deleteX}
            cy={deleteY}
            r={6}
            fill="red"
            fillOpacity={0.7}
            style={{ cursor: 'pointer' }}
            onClick={() => onDelete(annotation.id)}
          />
        </g>
      )
    }

    if (shapeType === 'ellipse') {
      const cx = x + width / 2
      const cy = y + height / 2
      return (
        <g>
          <ellipse
            cx={cx}
            cy={cy}
            rx={width / 2}
            ry={height / 2}
            fill="#FFE97D"
            fillOpacity={0.1}
            stroke="#FFE97D"
            strokeWidth={2}
          />
          <circle
            cx={deleteX}
            cy={deleteY}
            r={6}
            fill="red"
            fillOpacity={0.7}
            style={{ cursor: 'pointer' }}
            onClick={() => onDelete(annotation.id)}
          />
        </g>
      )
    }
  }

  if (annotation.type === 'tooth') {
    const pt = geo.point as { x: number; y: number } | undefined
    const toothNumber = geo.toothNumber as number | undefined
    if (!pt || toothNumber == null) return null
    return (
      <g>
        <circle cx={pt.x} cy={pt.y} r={14} fill="#FFE97D" fillOpacity={0.2} stroke="#FFE97D" strokeWidth={2} />
        <text x={pt.x} y={pt.y + 5} fill="#FFE97D" fontSize={11} fontWeight={700} textAnchor="middle">
          {toothNumber}
        </text>
        <circle
          cx={pt.x + 14}
          cy={pt.y - 14}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  return null
}

interface DrawingPreviewProps {
  toolMode: ToolMode | undefined
  points: { x: number; y: number }[]
}

function DrawingPreview({ toolMode, points }: DrawingPreviewProps) {
  if (points.length === 0) return null

  if (toolMode === 'calibration' || toolMode === 'distance') {
    const p0 = points[0]
    if (!p0) return null
    if (points.length < 2) {
      return (
        <circle cx={p0.x} cy={p0.y} r={4} fill="#FFE97D" fillOpacity={0.8} />
      )
    }
    const p1 = points[1]!
    return (
      <line
        x1={p0.x}
        y1={p0.y}
        x2={p1.x}
        y2={p1.y}
        stroke="#FFE97D"
        strokeWidth={2}
        strokeDasharray="6 3"
      />
    )
  }

  if (toolMode === 'angle') {
    return (
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#FFE97D"
        strokeWidth={2}
        strokeDasharray="6 3"
      />
    )
  }

  if (toolMode === 'area' && points.length >= 2) {
    return (
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="#FFE97D"
        fillOpacity={0.15}
        stroke="#FFE97D"
        strokeWidth={2}
        strokeDasharray="6 3"
      />
    )
  }

  // Annotation mode previews
  if (toolMode === 'label' || toolMode === 'tooth') {
    const p0 = points[0]
    if (!p0) return null
    return <circle cx={p0.x} cy={p0.y} r={5} fill="#FFE97D" fillOpacity={0.7} />
  }

  if (toolMode === 'arrow' && points.length >= 1) {
    const p0 = points[0]!
    if (points.length < 2) {
      return <circle cx={p0.x} cy={p0.y} r={4} fill="#FFE97D" fillOpacity={0.8} />
    }
    const p1 = points[1]!
    return (
      <line
        x1={p0.x}
        y1={p0.y}
        x2={p1.x}
        y2={p1.y}
        stroke="#FFE97D"
        strokeWidth={2}
        strokeDasharray="6 3"
        markerEnd="url(#arrowhead)"
      />
    )
  }

  if (toolMode === 'freehand' && points.length >= 2) {
    return (
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#FFE97D"
        strokeWidth={2}
        strokeDasharray="4 2"
      />
    )
  }

  if (toolMode === 'shape' && points.length >= 1) {
    const p0 = points[0]!
    if (points.length < 2) {
      return <circle cx={p0.x} cy={p0.y} r={4} fill="#FFE97D" fillOpacity={0.8} />
    }
    const p1 = points[1]!
    const x = Math.min(p0.x, p1.x)
    const y = Math.min(p0.y, p1.y)
    const width = Math.abs(p1.x - p0.x)
    const height = Math.abs(p1.y - p0.y)
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#FFE97D"
        fillOpacity={0.1}
        stroke="#FFE97D"
        strokeWidth={2}
        strokeDasharray="6 3"
      />
    )
  }

  return null
}

// --- Main component ---

export function ImagingWorkspace({
  imageId,
  imageUrl,
  className,
  toolMode: externalToolMode,
  onToolModeChange,
  onMeasurementSaved,
  modality,
  pixelSpacingMm: externalPixelSpacingMm,
  onCalibrationSaved,
  visitId = '',
  patientId = '',
  branchId = '',
}: ImagingWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef(0)
  const flipRef = useRef(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)

  // Tool state — controlled externally or internally
  const [internalToolMode, setInternalToolMode] = useState<ToolMode>('none')
  const toolMode = externalToolMode ?? internalToolMode
  const setToolMode = (mode: ToolMode) => {
    setInternalToolMode(mode)
    onToolModeChange?.(mode)
  }

  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([])
  const [calibrationOpen, setCalibrationOpen] = useState(false)
  const [calibrationPixelDist, setCalibrationPixelDist] = useState(0)
  const [internalPixelSpacingMm, setInternalPixelSpacingMm] = useState<number | null>(null)
  const [findingsPanelOpen, setFindingsPanelOpen] = useState(false)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [cephPanelOpen, setCephPanelOpen] = useState(false)
  const [cephTransform, setCephTransform] = useState<CephTransformState | null>(null)
  const [cephSelectedCode, setCephSelectedCode] = useState<import('../hooks/use-ceph-landmarks').CephLandmarkCode | null>(null)
  const [cephLayers, setCephLayers] = useState<LayerState>({ landmarks: true, tracing: true, arcs: true })

  const isCeph = modality === 'cephalometric'
  const { landmarks: cephLandmarks, dragLandmark, commitLandmark } = useCephLandmarks(
    isCeph && cephPanelOpen ? imageId : '',
  )
  const { analysis: cephAnalysis } = useCephAnalysis(
    isCeph && cephPanelOpen ? imageId : '',
  )

  const pixelSpacingMm = externalPixelSpacingMm ?? internalPixelSpacingMm

  const { measurements, createMeasurement, deleteMeasurement } = useMeasurements(imageId)

  const { getCachedBlob, setCachedBlob } = useOfflineCache()

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width / 2 + offsetRef.current.x, canvas.height / 2 + offsetRef.current.y)
    ctx.scale(scaleRef.current * (flipRef.current ? -1 : 1), scaleRef.current)
    ctx.rotate((rotationRef.current * Math.PI) / 2)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
    setCephTransform({
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      imgWidth: img.width,
      imgHeight: img.height,
      scale: scaleRef.current,
      flip: flipRef.current,
      rotation: rotationRef.current,
      offsetX: offsetRef.current.x,
      offsetY: offsetRef.current.y,
    })
  }, [setCephTransform])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cached = await getCachedBlob(imageId)
      const src = cached ? URL.createObjectURL(cached) : imageUrl
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        imgRef.current = img
        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = canvas.offsetWidth || 800
          canvas.height = canvas.offsetHeight || 600
        }
        render()
        if (!cached) {
          fetch(imageUrl)
            .then((r) => r.blob())
            .then((blob) => setCachedBlob(imageId, blob))
            .catch(() => {})
        }
      }
      img.src = src
    })()
    return () => {
      cancelled = true
    }
  }, [imageId, imageUrl, getCachedBlob, setCachedBlob, render])

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      scaleRef.current = Math.max(0.1, Math.min(10, scaleRef.current - e.deltaY * 0.001))
      render()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [render])

  // Mouse pan — only active when no tool selected
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onDown = (e: MouseEvent) => {
      if (toolMode !== 'none') return
      isDraggingRef.current = true
      lastPosRef.current = { x: e.clientX, y: e.clientY }
    }
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      offsetRef.current.x += e.clientX - lastPosRef.current.x
      offsetRef.current.y += e.clientY - lastPosRef.current.y
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      render()
    }
    const onUp = () => {
      isDraggingRef.current = false
    }
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [render, toolMode])

  const rotate = (dir: 1 | -1) => {
    rotationRef.current = (rotationRef.current + dir + 4) % 4
    render()
  }
  const flip = () => {
    flipRef.current = !flipRef.current
    render()
  }
  const fullscreen = () => {
    void containerRef.current?.requestFullscreen()
  }

  // SVG click handler
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (toolMode === 'none') return
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const newPoints = [...drawPoints, { x, y }]

      if (toolMode === 'calibration') {
        if (newPoints.length < 2) {
          setDrawPoints(newPoints)
          return
        }
        // 2 points — open dialog
        const dist = euclidean(newPoints[0]!, newPoints[1]!)
        setCalibrationPixelDist(dist)
        setDrawPoints(newPoints)
        setCalibrationOpen(true)
        return
      }

      if (toolMode === 'distance') {
        if (newPoints.length < 2) {
          setDrawPoints(newPoints)
          return
        }
        const distPx = euclidean(newPoints[0]!, newPoints[1]!)
        const value = pixelSpacingMm ? distPx * pixelSpacingMm : distPx
        const unit = pixelSpacingMm ? 'mm' : 'px'
        createMeasurement.mutate({
          type: 'distance',
          geometry: { points: newPoints },
          measurementValue: Math.round(value * 10) / 10,
          measurementUnit: unit,
        })
        setDrawPoints([])
        onMeasurementSaved?.()
        return
      }

      if (toolMode === 'angle') {
        if (newPoints.length < 3) {
          setDrawPoints(newPoints)
          return
        }
        const deg = computeAngleDeg(newPoints[0]!, newPoints[1]!, newPoints[2]!)
        createMeasurement.mutate({
          type: 'angle',
          geometry: { points: newPoints },
          measurementValue: Math.round(deg * 10) / 10,
          measurementUnit: 'deg',
        })
        setDrawPoints([])
        onMeasurementSaved?.()
        return
      }

      if (toolMode === 'area') {
        // Double-click to close polygon
        if (e.detail === 2 && newPoints.length >= 3) {
          const areaPx = computePolygonArea(newPoints.slice(0, -1))
          const value = pixelSpacingMm ? areaPx * pixelSpacingMm * pixelSpacingMm : areaPx
          const unit = pixelSpacingMm ? 'mm²' : 'px²'
          createMeasurement.mutate({
            type: 'area',
            geometry: { points: newPoints.slice(0, -1) },
            measurementValue: Math.round(value * 10) / 10,
            measurementUnit: unit,
          })
          setDrawPoints([])
          onMeasurementSaved?.()
          return
        }
        setDrawPoints(newPoints)
        return
      }

      // -----------------------------------------------------------------------
      // Annotation modes (no tier gate)
      // -----------------------------------------------------------------------

      if (toolMode === 'label') {
        // Single click → prompt for text
        const text = window.prompt('Label text (max 200 chars):')
        if (!text || text.trim().length === 0) {
          setDrawPoints([])
          return
        }
        createMeasurement.mutate({
          type: 'label',
          geometry: { type: 'label', point: { x, y }, text: text.trim().slice(0, 200) },
        })
        setDrawPoints([])
        onMeasurementSaved?.()
        return
      }

      if (toolMode === 'tooth') {
        // Single click → prompt for tooth number
        const input = window.prompt('Tooth number (1–32):')
        const toothNumber = input ? parseInt(input, 10) : NaN
        if (!input || isNaN(toothNumber) || toothNumber < 1 || toothNumber > 32) {
          setDrawPoints([])
          return
        }
        createMeasurement.mutate({
          type: 'tooth',
          geometry: { type: 'tooth', point: { x, y }, toothNumber },
        })
        setDrawPoints([])
        onMeasurementSaved?.()
        return
      }

      if (toolMode === 'arrow') {
        if (newPoints.length < 2) {
          setDrawPoints(newPoints)
          return
        }
        const from = newPoints[0]!
        const to = newPoints[1]!
        createMeasurement.mutate({
          type: 'arrow',
          geometry: { type: 'arrow', from, to },
        })
        setDrawPoints([])
        onMeasurementSaved?.()
        return
      }

      if (toolMode === 'freehand') {
        // Double-click to finish
        if (e.detail === 2 && newPoints.length >= 2) {
          createMeasurement.mutate({
            type: 'freehand',
            geometry: { type: 'freehand', points: newPoints.slice(0, -1) },
          })
          setDrawPoints([])
          onMeasurementSaved?.()
          return
        }
        setDrawPoints(newPoints)
        return
      }

      if (toolMode === 'shape') {
        if (newPoints.length < 2) {
          setDrawPoints(newPoints)
          return
        }
        const p0 = newPoints[0]!
        const p1 = newPoints[1]!
        const shapeX = Math.min(p0.x, p1.x)
        const shapeY = Math.min(p0.y, p1.y)
        const shapeW = Math.abs(p1.x - p0.x)
        const shapeH = Math.abs(p1.y - p0.y)
        createMeasurement.mutate({
          type: 'shape',
          geometry: {
            type: 'shape',
            shapeType: 'rect',
            x: shapeX,
            y: shapeY,
            width: shapeW,
            height: shapeH,
          },
        })
        setDrawPoints([])
        onMeasurementSaved?.()
        return
      }
    },
    [toolMode, drawPoints, pixelSpacingMm, createMeasurement, onMeasurementSaved],
  )

  const handleCalibrationConfirm = useCallback(
    async (actualMm: number) => {
      if (calibrationPixelDist <= 0 || actualMm <= 0) return
      const pxMm = actualMm / calibrationPixelDist
      await fetch(`/dental/imaging/images/${imageId}/calibration`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixelSpacingMm: pxMm }),
      })
      setInternalPixelSpacingMm(pxMm)
      onCalibrationSaved?.(pxMm)
      setCalibrationOpen(false)
      setDrawPoints([])
      setToolMode('none')
    },
    [calibrationPixelDist, imageId, onCalibrationSaved],
  )

  const handleExportPng = useCallback(
    async (reportVersion: number) => {
      const img = imgRef.current
      if (!img) return
      const canvas = composeCephCanvas(img, cephLandmarks)
      const blob = await canvasToPngBlob(canvas)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ceph-report-${imageId}-v${reportVersion}.png`
      a.click()
      URL.revokeObjectURL(url)
    },
    [imageId, cephLandmarks],
  )

  const isCalibrated = Boolean(pixelSpacingMm)

  return (
    <div ref={containerRef} className={`relative flex flex-col bg-black ${className ?? ''}`}>
      {/* Existing toolbar */}
      <div className="flex items-center gap-2 p-2 bg-zinc-900">
        <button
          onClick={() => rotate(-1)}
          className="px-2 py-1 text-xs text-white bg-zinc-700 rounded"
        >
          ↺ CCW
        </button>
        <button
          onClick={() => rotate(1)}
          className="px-2 py-1 text-xs text-white bg-zinc-700 rounded"
        >
          ↻ CW
        </button>
        <button onClick={flip} className="px-2 py-1 text-xs text-white bg-zinc-700 rounded">
          ⇆ Flip
        </button>
        <label className="text-xs text-zinc-300">
          Brightness
          <input
            type="range"
            min={0}
            max={200}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="ml-1 w-20"
          />
        </label>
        <label className="text-xs text-zinc-300">
          Contrast
          <input
            type="range"
            min={0}
            max={200}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="ml-1 w-20"
          />
        </label>
        <button
          onClick={() => setFindingsPanelOpen((prev) => !prev)}
          className={`px-2 py-1 text-xs rounded ${
            findingsPanelOpen
              ? 'bg-[#FFE97D]/20 text-[#FFE97D] border border-[#FFE97D]/40'
              : 'text-white bg-zinc-700'
          }`}
          aria-pressed={findingsPanelOpen}
        >
          Findings
        </button>
        {isCeph && (
          <button
            onClick={() => setCephPanelOpen((prev) => !prev)}
            className={`px-2 py-1 text-xs rounded ${
              cephPanelOpen
                ? 'bg-[#FFE97D]/20 text-[#FFE97D] border border-[#FFE97D]/40'
                : 'text-white bg-zinc-700'
            }`}
            aria-pressed={cephPanelOpen}
            aria-label="Toggle ceph panel"
          >
            Ceph
          </button>
        )}
        <button
          onClick={fullscreen}
          className="ml-auto px-2 py-1 text-xs text-white bg-zinc-700 rounded"
        >
          ⛶ Fullscreen
        </button>
      </div>

      {/* Measurement toolbar */}
      <MeasurementToolbar
        toolMode={toolMode}
        onToolChange={setToolMode}
        isCalibrated={isCalibrated}
        modality={modality}
      />

      {/* Annotation toolbar */}
      <AnnotationToolbar toolMode={toolMode} onToolChange={setToolMode} />

      {/* Canvas + SVG overlay + FindingsSidebar */}
      <div className="flex flex-row flex-1 overflow-hidden">
        <div
          style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)`, flex: 1, position: 'relative' }}
          className="overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            style={{ display: 'block' }}
          />
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full"
            data-testid="measurement-svg-overlay"
            style={{
              cursor: toolMode !== 'none' ? 'crosshair' : 'default',
              pointerEvents: toolMode !== 'none' ? 'auto' : 'none',
            }}
            onClick={handleSvgClick}
          >
            {/* Arrowhead marker for arrow annotations */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#FFE97D" />
              </marker>
            </defs>

            {measurements.map((m) => {
              const isAnnotationType = ['label', 'arrow', 'freehand', 'shape', 'tooth'].includes(m.type)
              if (isAnnotationType) {
                return (
                  <AnnotationShape
                    key={m.id}
                    annotation={m}
                    pixelSpacingMm={pixelSpacingMm}
                    onDelete={(id) => deleteMeasurement.mutate(id)}
                    onAnnotationClick={(id) => {
                      setSelectedAnnotationId(id)
                      setFindingsPanelOpen(true)
                    }}
                  />
                )
              }
              return (
                <MeasurementShape
                  key={m.id}
                  annotation={m}
                  pixelSpacingMm={pixelSpacingMm}
                  onDelete={(id) => deleteMeasurement.mutate(id)}
                />
              )
            })}
            <DrawingPreview toolMode={toolMode} points={drawPoints} />
          </svg>

          {/* Ceph overlays — rendered when ceph panel open and transform ready */}
          {isCeph && cephPanelOpen && cephTransform && (
            <>
              {cephLayers.tracing && (
                <CephTracingOverlay
                  landmarks={cephLandmarks}
                  transform={cephTransform}
                  width={cephTransform.canvasWidth}
                  height={cephTransform.canvasHeight}
                />
              )}
              {cephLayers.arcs && (
                <CephAngleArcLayer
                  landmarks={cephLandmarks}
                  transform={cephTransform}
                  measurements={cephAnalysis?.measurements ?? {}}
                  width={cephTransform.canvasWidth}
                  height={cephTransform.canvasHeight}
                />
              )}
              {cephLayers.landmarks && (
                <CephLandmarkLayer
                  landmarks={cephLandmarks}
                  selectedCode={cephSelectedCode}
                  transform={cephTransform}
                  width={cephTransform.canvasWidth}
                  height={cephTransform.canvasHeight}
                  onPlace={(code, x, y) => {
                    setCephSelectedCode(null)
                    void commitLandmark.mutateAsync({ code, x, y })
                  }}
                  onDrag={(code, x, y) => dragLandmark(code, x, y)}
                  onCommit={(code, x, y) => void commitLandmark.mutateAsync({ code, x, y })}
                />
              )}
            </>
          )}
        </div>

        {/* Findings sidebar */}
        <FindingsSidebar
          imageId={imageId}
          isOpen={findingsPanelOpen}
          onClose={() => setFindingsPanelOpen(false)}
          initialAnnotationId={selectedAnnotationId ?? undefined}
        />

        {/* Ceph workspace panel */}
        <CephWorkspacePanel
          imageId={imageId}
          isOpen={isCeph && cephPanelOpen}
          onClose={() => setCephPanelOpen(false)}
          onLayerChange={(key, value) => setCephLayers((prev) => ({ ...prev, [key]: value }))}
          onExportPng={(v) => void handleExportPng(v)}
        />
      </div>

      {/* Calibration dialog */}
      <CalibrationDialog
        open={calibrationOpen}
        pixelDistance={calibrationPixelDist}
        onConfirm={(mm) => void handleCalibrationConfirm(mm)}
        onCancel={() => {
          setCalibrationOpen(false)
          setDrawPoints([])
        }}
      />
    </div>
  )
}
