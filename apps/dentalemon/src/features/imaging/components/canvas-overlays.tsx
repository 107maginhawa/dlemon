import { Trash2, Pencil } from 'lucide-react'
import { imageToScreen, type CephTransformState } from '@monobase/ceph-math'
import type { ResizeHandle } from '../lib/annotation-geometry'
import type { ImagingAnnotation } from '../hooks/use-measurements'
import type { ToolMode } from './measurement-toolbar'
import { BRAND_GOLD } from '@/constants/brand'

// Overlay geometry is stored in IMAGE space; the canvas draws the film under a
// zoom/pan/rotate/flip transform. Map every rendered point image→screen (mirroring
// the ceph landmark/tracing layers) so overlays stay glued to the film. Stroke
// widths / font sizes stay constant screen-size because we map points, not the
// coordinate system.
const S = (p: XY, t: CephTransformState): XY => imageToScreen(p.x, p.y, t)

// Inline tag glyph — lucide's Tag isn't resolvable under bun-test CJS interop;
// inline SVG keeps this render-safe everywhere.
function TagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  )
}

interface AnnotationShapeProps {
  annotation: ImagingAnnotation
  pixelSpacingMm: number | null | undefined
  transform: CephTransformState
  selectMode?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
  /** Pointer-down on a selected overlay body starts a drag-to-move (see workspace). */
  onStartMove?: (id: string, clientX: number, clientY: number) => void
}

/**
 * Returns true when a distance/area measurement was stored in raw pixel units,
 * meaning the image was not calibrated at draw time. We surface a warning glyph
 * so clinicians never mistake a px value for a clinical mm measurement.
 */
function isUncalibratedPxMeasurement(annotation: ImagingAnnotation): boolean {
  const unit = annotation.measurementUnit
  return (
    (annotation.type === 'distance' || annotation.type === 'line' || annotation.type === 'area') &&
    (unit === 'px' || unit === 'px²' || unit == null)
  )
}

type XY = { x: number; y: number }

/**
 * Wraps a rendered overlay's geometry so it participates in the selection model:
 * a pointer cursor + click-to-select in Select mode (click never bubbles to the
 * canvas, so it can't start a draw), and a white glow when selected (the gold
 * overlays glow white — a distinct, non-color-only cue paired with the action bar).
 */
function SelectableGroup({
  id,
  testId,
  selectMode,
  isSelected,
  onSelect,
  onStartMove,
  children,
}: {
  id: string
  testId: string
  selectMode?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
  onStartMove?: (id: string, clientX: number, clientY: number) => void
  children: React.ReactNode
}) {
  return (
    <g
      data-testid={testId}
      data-annotation-id={id}
      data-selected={isSelected ? 'true' : undefined}
      style={{ cursor: selectMode ? (isSelected ? 'move' : 'pointer') : 'default' }}
      onClick={(e) => {
        if (!selectMode) return
        e.stopPropagation() // never let a select-click fall through and start a draw
        onSelect?.(id)
      }}
      onPointerDown={(e) => {
        // Drag-to-move: only a selected overlay body starts a move. First pointer-down
        // on an unselected overlay just selects it (via onClick) — no accidental drag.
        if (!selectMode || !isSelected || !onStartMove) return
        e.stopPropagation()
        onStartMove(id, e.clientX, e.clientY)
      }}
      filter={isSelected ? 'url(#annotationSelectGlow)' : undefined}
    >
      {children}
    </g>
  )
}

/** Anchor point for a selected annotation's floating action bar (near a corner/end). */
export function annotationAnchor(annotation: ImagingAnnotation): XY | null {
  const geo = annotation.geometry as Record<string, unknown>
  switch (annotation.type) {
    case 'label':
    case 'tooth': {
      const p = geo.point as XY | undefined
      return p ?? null
    }
    case 'arrow': {
      const to = geo.to as XY | undefined
      return to ?? null
    }
    case 'line':
    case 'distance':
    case 'freehand':
    case 'angle':
    case 'area': {
      const pts = geo.points as XY[] | undefined
      return pts && pts.length > 0 ? pts[pts.length - 1]! : null
    }
    case 'shape': {
      const x = geo.x as number | undefined
      const y = geo.y as number | undefined
      const width = (geo.width as number | undefined) ?? 0
      if (x == null || y == null) return null
      return { x: x + width, y }
    }
    default:
      return null
  }
}

export function MeasurementShape({ annotation, transform, selectMode, isSelected, onSelect, onStartMove }: AnnotationShapeProps) {
  const geo = annotation.geometry as Record<string, unknown>

  const wrap = (inner: React.ReactNode) => (
    <SelectableGroup id={annotation.id} testId="saved-measurement" selectMode={selectMode} isSelected={isSelected} onSelect={onSelect} onStartMove={onStartMove}>
      {inner}
    </SelectableGroup>
  )

  if (annotation.type === 'line' || annotation.type === 'distance') {
    const raw = geo.points as XY[] | undefined
    if (!raw || raw.length < 2) return null
    const p1 = S(raw[0]!, transform)
    const p2 = S(raw[1]!, transform)
    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    const uncalibrated = isUncalibratedPxMeasurement(annotation)
    const unit = annotation.measurementUnit ?? 'px'
    const label =
      annotation.measurementValue !== null
        ? `${uncalibrated ? '⚠ ' : ''}${annotation.measurementValue.toFixed(1)} ${unit}`
        : ''
    const labelColor = uncalibrated ? '#FCA5A5' : BRAND_GOLD
    return wrap(
      <>
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={labelColor} strokeWidth={2} strokeDasharray={uncalibrated ? '5 3' : undefined} />
        <text x={mx} y={my - 6} fill={labelColor} fontSize={12} textAnchor="middle" aria-label={uncalibrated ? `Uncalibrated measurement: ${label}` : label}>
          {label}
        </text>
      </>,
    )
  }

  if (annotation.type === 'angle') {
    const raw = geo.points as XY[] | undefined
    if (!raw || raw.length < 3) return null
    const p1 = S(raw[0]!, transform)
    const p2 = S(raw[1]!, transform)
    const p3 = S(raw[2]!, transform)
    const label =
      annotation.measurementValue !== null ? `${annotation.measurementValue.toFixed(1)}°` : ''
    return wrap(
      <>
        <polyline points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`} fill="none" stroke={BRAND_GOLD} strokeWidth={2} />
        <text x={p2.x} y={p2.y - 8} fill={BRAND_GOLD} fontSize={12} textAnchor="middle">
          {label}
        </text>
      </>,
    )
  }

  if (annotation.type === 'area') {
    const raw = geo.points as XY[] | undefined
    if (!raw || raw.length < 3) return null
    const pts = raw.map((p) => S(p, transform))
    const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ')
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const uncalibrated = isUncalibratedPxMeasurement(annotation)
    const unit = annotation.measurementUnit ?? 'px²'
    const label =
      annotation.measurementValue !== null
        ? `${uncalibrated ? '⚠ ' : ''}${annotation.measurementValue.toFixed(1)} ${unit}`
        : ''
    const areaColor = uncalibrated ? '#FCA5A5' : BRAND_GOLD
    return wrap(
      <>
        <polygon points={pointsStr} fill={areaColor} fillOpacity={0.2} stroke={areaColor} strokeWidth={2} strokeDasharray={uncalibrated ? '5 3' : undefined} />
        <text x={cx} y={cy} fill={areaColor} fontSize={12} textAnchor="middle" aria-label={uncalibrated ? `Uncalibrated measurement: ${label}` : label}>
          {label}
        </text>
      </>,
    )
  }

  return null
}

export function AnnotationShape({ annotation, transform, selectMode, isSelected, onSelect, onStartMove }: AnnotationShapeProps) {
  const geo = annotation.geometry as Record<string, unknown>

  const wrap = (inner: React.ReactNode) => (
    <SelectableGroup id={annotation.id} testId="annotation-shape" selectMode={selectMode} isSelected={isSelected} onSelect={onSelect} onStartMove={onStartMove}>
      {inner}
    </SelectableGroup>
  )

  if (annotation.type === 'label') {
    const raw = geo.point as XY | undefined
    const text = geo.text as string | undefined
    if (!raw || !text) return null
    const pt = S(raw, transform)
    return wrap(
      // UJ-IMG-002: annotation text rendered as JSX string child — React escapes it, no XSS possible
      <text x={pt.x} y={pt.y} fill={BRAND_GOLD} fontSize={13} fontWeight={600}>
        {text}
      </text>,
    )
  }

  if (annotation.type === 'arrow') {
    const rawFrom = geo.from as XY | undefined
    const rawTo = geo.to as XY | undefined
    if (!rawFrom || !rawTo) return null
    const from = S(rawFrom, transform)
    const to = S(rawTo, transform)
    return wrap(
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={BRAND_GOLD} strokeWidth={2} markerEnd="url(#arrowhead)" />,
    )
  }

  if (annotation.type === 'freehand') {
    const raw = geo.points as XY[] | undefined
    if (!raw || raw.length < 2) return null
    const pts = raw.map((p) => S(p, transform))
    return wrap(
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={BRAND_GOLD} strokeWidth={2} />,
    )
  }

  if (annotation.type === 'shape') {
    const shapeType = geo.shapeType as 'rect' | 'ellipse' | undefined
    const x = geo.x as number | undefined
    const y = geo.y as number | undefined
    const width = geo.width as number | undefined
    const height = geo.height as number | undefined
    if (shapeType == null || x == null || y == null || width == null || height == null) return null

    // Map the two defining corners; derive the axis-aligned screen box. Exact for
    // zoom/pan/flip. ponytail: under 90/270° rotation the box stays axis-aligned
    // (position follows the film; footprint isn't re-oriented) — upgrade to a mapped
    // polygon/rotated <g> only if clinicians rotate boxed regions.
    const tl = S({ x, y }, transform)
    const br = S({ x: x + width, y: y + height }, transform)
    const sx = Math.min(tl.x, br.x)
    const sy = Math.min(tl.y, br.y)
    const sw = Math.abs(br.x - tl.x)
    const sh = Math.abs(br.y - tl.y)

    if (shapeType === 'rect') {
      return wrap(
        <rect x={sx} y={sy} width={sw} height={sh} fill={BRAND_GOLD} fillOpacity={0.1} stroke={BRAND_GOLD} strokeWidth={2} />,
      )
    }
    if (shapeType === 'ellipse') {
      return wrap(
        <ellipse cx={sx + sw / 2} cy={sy + sh / 2} rx={sw / 2} ry={sh / 2} fill={BRAND_GOLD} fillOpacity={0.1} stroke={BRAND_GOLD} strokeWidth={2} />,
      )
    }
    return null
  }

  if (annotation.type === 'tooth') {
    const raw = geo.point as XY | undefined
    const toothNumber = geo.toothNumber as number | undefined
    if (!raw || toothNumber == null) return null
    const pt = S(raw, transform)
    return wrap(
      <>
        <circle cx={pt.x} cy={pt.y} r={14} fill={BRAND_GOLD} fillOpacity={0.2} stroke={BRAND_GOLD} strokeWidth={2} />
        <text x={pt.x} y={pt.y + 5} fill={BRAND_GOLD} fontSize={11} fontWeight={700} textAnchor="middle">
          {toothNumber}
        </text>
      </>,
    )
  }

  return null
}

interface ActionBarProps {
  annotation: ImagingAnnotation
  transform: CephTransformState
  onDelete: (id: string) => void
  onLinkFinding?: (id: string) => void
  /** Re-type a label / re-number a tooth (opens the prefilled input dialog). */
  onEdit?: (id: string) => void
}

/**
 * Floating controls for the currently-selected annotation. Real, focusable HTML
 * buttons (via <foreignObject>) at ≥44px touch targets — replacing the old 12px
 * SVG dot that was under the WCAG target and unreachable without an armed tool.
 * Rides in the same overlay coord space as the annotation, so it stays glued to
 * its shape. Label/tooth annotations also get Edit (re-type) + "Link finding".
 */
export function AnnotationActionBar({ annotation, transform, onDelete, onLinkFinding, onEdit }: ActionBarProps) {
  const raw = annotationAnchor(annotation)
  if (!raw) return null
  const anchor = S(raw, transform)
  const isTextual = annotation.type === 'label' || annotation.type === 'tooth'
  const showEdit = isTextual && onEdit != null
  const showLink = isTextual && onLinkFinding != null
  // 44px touch target + gap per button, plus horizontal padding.
  const count = 1 + (showEdit ? 1 : 0) + (showLink ? 1 : 0)
  const width = 8 + count * 44
  const height = 52
  return (
    <foreignObject x={anchor.x + 6} y={Math.max(0, anchor.y - height - 6)} width={width} height={height} data-testid="annotation-action-bar">
      <div className="flex h-full items-center gap-1 rounded-lg bg-zinc-900/95 px-1 shadow-lg ring-1 ring-white/20 backdrop-blur">
        <button
          type="button"
          aria-label="Delete annotation"
          data-testid="annotation-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(annotation.id) }}
          className="flex h-11 w-11 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <Trash2 className="h-5 w-5" aria-hidden />
        </button>
        {showEdit && (
          <button
            type="button"
            aria-label="Edit annotation"
            data-testid="annotation-edit"
            onClick={(e) => { e.stopPropagation(); onEdit?.(annotation.id) }}
            className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Pencil className="h-5 w-5" aria-hidden />
          </button>
        )}
        {showLink && (
          <button
            type="button"
            aria-label="Link to finding"
            data-testid="annotation-link-finding"
            onClick={(e) => { e.stopPropagation(); onLinkFinding?.(annotation.id) }}
            className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <TagIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </foreignObject>
  )
}

interface ResizeHandlesProps {
  annotation: ImagingAnnotation
  transform: CephTransformState
  onStartResize: (handle: ResizeHandle, clientX: number, clientY: number) => void
}

/**
 * Corner resize handles for a selected `shape` (rect/ellipse). Each handle carries a
 * 44px transparent touch target (WCAG AA / iPad) around a small visible knob, mapped
 * image→screen so it tracks the film. No-op for non-shape overlays.
 */
export function ShapeResizeHandles({ annotation, transform, onStartResize }: ResizeHandlesProps) {
  if (annotation.type !== 'shape') return null
  const geo = annotation.geometry as Record<string, unknown>
  const x = geo.x as number | undefined
  const y = geo.y as number | undefined
  const width = geo.width as number | undefined
  const height = geo.height as number | undefined
  if (x == null || y == null || width == null || height == null) return null

  const corners: { handle: ResizeHandle; img: XY }[] = [
    { handle: 'nw', img: { x, y } },
    { handle: 'ne', img: { x: x + width, y } },
    { handle: 'sw', img: { x, y: y + height } },
    { handle: 'se', img: { x: x + width, y: y + height } },
  ]

  return (
    <g data-testid="shape-resize-handles">
      {corners.map(({ handle, img }) => {
        const p = S(img, transform)
        return (
          <g
            key={handle}
            style={{ cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onStartResize(handle, e.clientX, e.clientY) }}
          >
            <rect x={p.x - 22} y={p.y - 22} width={44} height={44} fill="transparent" data-resize-handle={handle} />
            <rect x={p.x - 5} y={p.y - 5} width={10} height={10} fill="#FFFFFF" stroke={BRAND_GOLD} strokeWidth={2} />
          </g>
        )
      })}
    </g>
  )
}

interface DrawingPreviewProps {
  toolMode: ToolMode | undefined
  points: XY[]
  transform: CephTransformState
}

export function DrawingPreview({ toolMode, points: rawPoints, transform }: DrawingPreviewProps) {
  if (rawPoints.length === 0) return null
  // In-progress points are captured in image space (screenToImage on click); map
  // back to screen for the live preview, same as saved overlays.
  const points = rawPoints.map((p) => S(p, transform))

  if (toolMode === 'calibration' || toolMode === 'distance') {
    const p0 = points[0]
    if (!p0) return null
    if (points.length < 2) {
      return <circle cx={p0.x} cy={p0.y} r={4} fill={BRAND_GOLD} fillOpacity={0.8} />
    }
    const p1 = points[1]!
    return <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={BRAND_GOLD} strokeWidth={2} strokeDasharray="6 3" />
  }

  if (toolMode === 'angle') {
    return <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={BRAND_GOLD} strokeWidth={2} strokeDasharray="6 3" />
  }

  if (toolMode === 'area' && points.length >= 2) {
    return <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill={BRAND_GOLD} fillOpacity={0.15} stroke={BRAND_GOLD} strokeWidth={2} strokeDasharray="6 3" />
  }

  if (toolMode === 'label' || toolMode === 'tooth') {
    const p0 = points[0]
    if (!p0) return null
    return <circle cx={p0.x} cy={p0.y} r={5} fill={BRAND_GOLD} fillOpacity={0.7} />
  }

  if (toolMode === 'arrow' && points.length >= 1) {
    const p0 = points[0]!
    if (points.length < 2) {
      return <circle cx={p0.x} cy={p0.y} r={4} fill={BRAND_GOLD} fillOpacity={0.8} />
    }
    const p1 = points[1]!
    return <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={BRAND_GOLD} strokeWidth={2} strokeDasharray="6 3" markerEnd="url(#arrowhead)" />
  }

  if (toolMode === 'freehand' && points.length >= 2) {
    return <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={BRAND_GOLD} strokeWidth={2} strokeDasharray="4 2" />
  }

  if (toolMode === 'shape' && points.length >= 1) {
    const p0 = points[0]!
    if (points.length < 2) {
      return <circle cx={p0.x} cy={p0.y} r={4} fill={BRAND_GOLD} fillOpacity={0.8} />
    }
    const p1 = points[1]!
    const x = Math.min(p0.x, p1.x)
    const y = Math.min(p0.y, p1.y)
    const width = Math.abs(p1.x - p0.x)
    const height = Math.abs(p1.y - p0.y)
    return <rect x={x} y={y} width={width} height={height} fill={BRAND_GOLD} fillOpacity={0.1} stroke={BRAND_GOLD} strokeWidth={2} strokeDasharray="6 3" />
  }

  return null
}
