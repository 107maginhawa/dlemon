"use client"

// SunDemo — an INTERACTIVE, in-DOM replica of the real SUN carousel timeline
// (apps/dentalemon .../timeline-carousel.tsx). A marketing visitor can play with
// the product beat: swipe between a patient's visits (Swiper cover flow, the
// product's exact config), tap any tooth to read its history, and toggle chart
// layers on the open/current visit. Teeth are the REAL product tooth SVGs
// (<Tooth/>), colored per SURFACE with the product's clinical colors. Mock data
// only, but the per-tooth history follows the real timeline rules:
//   a finding is FOUND (existing) -> PLANNED (proposed) -> TREATED (this visit)
//   -> then carries forward as a standing existing restoration.
// The current (open) visit is the cumulative "all visits" state; each snapshot
// shows only what was true at that visit.

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  CaretLeft,
  CaretRight,
  X,
  ClipboardText,
  CheckCircle,
  NotePencil,
  Paperclip,
  Plus,
  Lightbulb,
  HandTap,
  type Icon,
} from "@phosphor-icons/react"
import { Swiper, SwiperSlide } from "swiper/react"
import { EffectCoverflow, Pagination, Keyboard } from "swiper/modules"
import "swiper/css"
import "swiper/css/effect-coverflow"
import "swiper/css/pagination"
import { Tooth } from "./tooth"
import { FDI_TO_UNIVERSAL, type SurfaceStatus } from "./tooth-data"

// ---------------------------------------------------------------------------
// Clinical fill colors — the product's exact palette (getToothFillColor).
// ---------------------------------------------------------------------------
const CONDITION_COLOR = {
  caries: "#FF3B30", // systemRed
  fractured: "#FF9500", // systemOrange
  filled: "#5AC8FA", // systemTeal
  crown: "#FFD60A", // systemYellow
} as const

type Condition = keyof typeof CONDITION_COLOR
type Layer = "existing" | "planned" | "treated"

const PLANNED_EDGE = "#475569" // slate — proposed work (dotted)
const TREATED_EDGE = "#566B3C" // warm sage-green — completed work (solid)

// Whole-tooth conditions (crown) color the entire tooth; the rest are painted on
// the affected surface(s) only — exactly how the real chart marks them.
const WHOLE_TOOTH: ReadonlySet<Condition> = new Set<Condition>(["crown"])

interface Finding {
  condition: Condition
  layer: Layer
  /** human label for the detail panel, e.g. "Composite filling" */
  label: string
  /** the visit (label) where this finding was first recorded */
  found: string
  /** affected surfaces (omit for whole-tooth conditions like crown) */
  surfaces?: string[]
}

interface Visit {
  id: string
  date: string // display label (no em-dashes)
  /** the open / living-document visit — owns interactive layer tabs + "Current" scope */
  current?: boolean
  findings: Record<number, Finding>
}

// FDI arch order, panoramic view: upper right → upper left, lower right → lower left.
const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_FDI = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const POSITION_NAMES = [
  "central incisor",
  "lateral incisor",
  "canine",
  "first premolar",
  "second premolar",
  "first molar",
  "second molar",
  "third molar",
] as const
const ARCH_NAMES: Record<number, string> = {
  1: "upper right",
  2: "upper left",
  3: "lower left",
  4: "lower right",
}
// ponytail: a tiny FDI decoder is plenty for a marketing demo; the real app
// localizes and supports deciduous numbering. Here permanent + English only.
function toothName(fdi: number): string {
  const quadrant = Math.floor(fdi / 10)
  const position = fdi % 10
  const arch = ARCH_NAMES[quadrant]
  const name = POSITION_NAMES[position - 1]
  if (!arch || !name) return `Tooth ${fdi}`
  return `${arch} ${name}`.replace(/\b\w/g, (c) => c.toUpperCase())
}

const STATUS_LABEL: Record<Layer, string> = {
  existing: "Existing",
  planned: "Planned",
  treated: "Treated",
}

// ---------------------------------------------------------------------------
// Mock history — Maria Santos, patient since 2019, five visits. Each tooth has a
// coherent clinical arc (found -> planned -> treated -> standing), and visits
// carry standing work forward:
//   16 occlusal: caries (Feb 24) -> planned (Jul) -> filled (Nov) -> standing (Jun 25)
//   26 distal:   caries (Jul 24) -> planned (Nov) -> filled (Jun 25, this visit)
//   36 occlusal: caries (Aug 23) -> filled (Feb 24) -> standing
//   46 buccal:   fractured (Nov 24) -> crown planned (Jun 25)
//   11 crown & 47 amalgam: long-standing existing throughout
// ---------------------------------------------------------------------------
const crown11: Finding = { condition: "crown", layer: "existing", label: "Crown", found: "2019" }
const amalgam47: Finding = { condition: "filled", layer: "existing", label: "Amalgam filling", found: "2020", surfaces: ["occlusal"] }

const VISITS: Visit[] = [
  {
    id: "v1",
    date: "Aug 12, 2023",
    findings: {
      11: crown11,
      47: amalgam47,
      36: { condition: "caries", layer: "existing", label: "Caries", found: "Aug 2023", surfaces: ["occlusal"] },
    },
  },
  {
    id: "v2",
    date: "Feb 3, 2024",
    findings: {
      11: crown11,
      47: amalgam47,
      36: { condition: "filled", layer: "treated", label: "Composite filling", found: "Aug 2023", surfaces: ["occlusal"] },
      16: { condition: "caries", layer: "existing", label: "Caries", found: "Feb 2024", surfaces: ["occlusal"] },
    },
  },
  {
    id: "v3",
    date: "Jul 19, 2024",
    findings: {
      11: crown11,
      47: amalgam47,
      36: { condition: "filled", layer: "existing", label: "Composite filling", found: "Aug 2023", surfaces: ["occlusal"] },
      16: { condition: "caries", layer: "planned", label: "Caries, restoration planned", found: "Feb 2024", surfaces: ["occlusal"] },
      26: { condition: "caries", layer: "existing", label: "Caries", found: "Jul 2024", surfaces: ["distal"] },
    },
  },
  {
    id: "v4",
    date: "Nov 8, 2024",
    findings: {
      11: crown11,
      47: amalgam47,
      36: { condition: "filled", layer: "existing", label: "Composite filling", found: "Aug 2023", surfaces: ["occlusal"] },
      16: { condition: "filled", layer: "treated", label: "Composite filling", found: "Feb 2024", surfaces: ["occlusal"] },
      26: { condition: "caries", layer: "planned", label: "Caries, restoration planned", found: "Jul 2024", surfaces: ["distal"] },
      46: { condition: "fractured", layer: "existing", label: "Fractured cusp", found: "Nov 2024", surfaces: ["buccal"] },
    },
  },
  {
    id: "v5",
    date: "Jun 21, 2025",
    current: true,
    findings: {
      11: crown11,
      47: amalgam47,
      36: { condition: "filled", layer: "existing", label: "Composite filling", found: "Aug 2023", surfaces: ["occlusal"] },
      16: { condition: "filled", layer: "existing", label: "Composite filling", found: "Feb 2024", surfaces: ["occlusal"] },
      26: { condition: "filled", layer: "treated", label: "Composite filling", found: "Jul 2024", surfaces: ["distal"] },
      46: { condition: "crown", layer: "planned", label: "Crown, planned", found: "Nov 2024" },
    },
  },
]

const ALL_LAYERS: Layer[] = ["existing", "planned", "treated"]
// Product config, copied verbatim.
// Softer than the product default so the flanking visit cards read clearly on
// both sides (less tilt/scale-down = less "blur").
const COVERFLOW = { rotate: 28, stretch: 0, depth: 140, modifier: 1, scale: 0.82, slideShadows: false }
const COVERFLOW_FLAT = { rotate: 0, stretch: 0, depth: 0, modifier: 1, scale: 0.9, slideShadows: false }
const ACTIVE_TOOTH_H = 150
const SNAPSHOT_TOOTH_H = 110

function surfacesFor(finding: Finding): SurfaceStatus[] | undefined {
  if (!finding.surfaces?.length) return undefined
  const color = CONDITION_COLOR[finding.condition]
  return finding.surfaces.map((surface) => ({ surface, colorCoding: color }))
}

// ---------------------------------------------------------------------------
// ToothButton — wraps the real <Tooth/> SVG; the button carries the layer cue
// (dotted = planned, green = treated) and the lemon selection ring. Hit area is
// >=24px (fine) / 44px (coarse), matching the product's odontogram behavior.
// ---------------------------------------------------------------------------
function ToothButton({
  fdi,
  finding,
  shown,
  selected,
  interactive,
  heightPx,
  onSelect,
}: {
  fdi: number
  finding?: Finding
  /** whether the finding's layer is currently visible (false = render healthy) */
  shown: boolean
  selected: boolean
  interactive: boolean
  heightPx: number
  onSelect: (fdi: number) => void
}) {
  const active = finding && shown ? finding : undefined
  const layer = active ? active.layer : "existing"
  const whole = active && WHOLE_TOOTH.has(active.condition)

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onSelect(fdi)}
      aria-pressed={selected}
      aria-label={`Tooth ${fdi}, ${toothName(fdi)}${active ? `, ${active.label}, ${STATUS_LABEL[layer]}` : ", sound"}`}
      style={{
        outline:
          layer === "planned"
            ? `2px dotted ${PLANNED_EDGE}`
            : layer === "treated"
              ? `2px solid ${TREATED_EDGE}`
              : undefined,
        outlineOffset: "1px",
        backgroundImage:
          layer === "treated"
            ? "repeating-linear-gradient(135deg, rgba(86,107,60,0.18) 0, rgba(86,107,60,0.18) 2px, transparent 2px, transparent 6px)"
            : undefined,
      }}
      className={`flex min-w-[24px] shrink-0 items-end justify-center rounded-md px-[1px] py-0.5 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-default [@media(pointer:coarse)]:min-w-[44px] ${
        selected ? "ring-2 ring-lemon ring-offset-1" : ""
      }`}
    >
      <Tooth
        fdi={fdi}
        heightPx={heightPx}
        fillColor={whole ? CONDITION_COLOR[active!.condition] : undefined}
        surfaces={active && !whole ? surfacesFor(active) : undefined}
      />
    </button>
  )
}

function Arch({
  fdis,
  visit,
  visibleLayers,
  selected,
  interactive,
  heightPx,
  onSelect,
}: {
  fdis: number[]
  visit: Visit
  visibleLayers: Set<Layer>
  selected: number | null
  interactive: boolean
  heightPx: number
  onSelect: (fdi: number) => void
}) {
  return (
    <div className="flex items-end justify-center gap-[2px]">
      {fdis.map((fdi) => {
        const finding = visit.findings[fdi]
        const shown = !!finding && visibleLayers.has(finding.layer)
        return (
          <ToothButton
            key={fdi}
            fdi={fdi}
            finding={finding}
            shown={shown}
            selected={selected === fdi}
            interactive={interactive}
            heightPx={heightPx}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}

// Per-layer cue swatch (matches the product's getLayerCueSwatch): Existing = plain
// bordered square, Planned = dotted slate, Treated = solid green.
const LAYER_CUE: Record<Layer, { className: string; borderColor?: string }> = {
  existing: { className: "border border-black/20" },
  planned: { className: "border-2 border-dotted", borderColor: PLANNED_EDGE },
  treated: { className: "border-2 border-solid", borderColor: TREATED_EDGE },
}
const LAYER_ORDER: Array<{ key: Layer; label: string }> = [
  { key: "existing", label: "Existing" },
  { key: "planned", label: "Planned" },
  { key: "treated", label: "Treated" },
]

// LayerToggle — the product's Apple-style segmented control (one track, a raised
// white active segment). Interactive only on the current/open visit; snapshots
// render it as a static, non-interactive legend key.
function LayerToggle({
  visible,
  interactive,
  onToggle,
}: {
  visible: Set<Layer>
  interactive: boolean
  onToggle: (layer: Layer) => void
}) {
  const seg =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 min-h-[36px] text-xs font-medium transition-colors"
  return (
    <div
      role={interactive ? "group" : undefined}
      aria-label={interactive ? "Chart layers, toggle to show or hide" : undefined}
      className="inline-flex items-center gap-0.5 rounded-lg bg-[rgba(118,118,128,0.12)] p-0.5"
    >
      {LAYER_ORDER.map(({ key, label }) => {
        const cue = LAYER_CUE[key]
        const active = visible.has(key)
        const swatch = (
          <span
            aria-hidden
            className={`h-2.5 w-2.5 shrink-0 rounded-sm ${cue.className} ${interactive && !active ? "opacity-50" : ""}`}
            style={cue.borderColor ? { borderColor: cue.borderColor } : undefined}
          />
        )
        if (!interactive) {
          return (
            <span key={key} className={`${seg} text-muted`}>
              {swatch}
              {label}
            </span>
          )
        }
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(key)}
            className={`${seg} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
              active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {swatch}
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted">
      {children}
    </span>
  )
}

function LegendKey({ swatch, label, dotted, solid }: { swatch?: string; label: string; dotted?: boolean; solid?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span
        className="inline-block h-3 w-3 rounded-[3px]"
        style={
          dotted
            ? { border: `2px dotted ${PLANNED_EDGE}` }
            : solid
              ? { border: `2px solid ${TREATED_EDGE}` }
              : { background: swatch, border: "1px solid rgba(0,0,0,0.12)" }
        }
      />
      <span className="text-[11px] text-muted">{label}</span>
    </span>
  )
}

// One visit card. The current/open card gets interactive layer tabs + the
// "Current / All visits" scope; snapshots get disabled tabs + "Snapshot".
function VisitCard({
  visit,
  isActive,
  visible,
  onToggleLayer,
  selected,
  onSelect,
}: {
  visit: Visit
  isActive: boolean
  visible: Set<Layer>
  onToggleLayer: (layer: Layer) => void
  selected: number | null
  onSelect: (fdi: number) => void
}) {
  const isCurrent = !!visit.current
  const effectiveVisible = isCurrent ? visible : new Set<Layer>(ALL_LAYERS)
  const heightPx = isActive ? ACTIVE_TOOTH_H : SNAPSHOT_TOOTH_H

  return (
    <div
      aria-hidden={!isActive}
      // Shadow only on the ACTIVE card: it sits front-and-center, so its lift reads
      // as a clean frame glow. Neighbors stay shadow-less — they're tilted in Swiper's
      // 3D (preserve-3d) context, where a shadow escapes overflow-hidden and halos.
      className={`flex h-full flex-col rounded-2xl border bg-white p-4 transition-all sm:p-5 ${
        isActive ? "border-2 border-lemon shadow-frame" : "border-line opacity-80"
      }`}
    >
      {/* header: layer segmented control (interactive only on the open card) + scope/date */}
      <div className="mb-4 flex min-h-[44px] flex-wrap items-center justify-between gap-3">
        <LayerToggle visible={effectiveVisible} interactive={isCurrent && isActive} onToggle={onToggleLayer} />
        <div className="flex items-center gap-1.5">
          {isCurrent ? (
            <>
              <Chip>Current</Chip>
              <Chip>All visits</Chip>
            </>
          ) : (
            <Chip>Snapshot</Chip>
          )}
          <span className="text-sm font-semibold text-ink">{visit.date}</span>
        </div>
      </div>

      {/* odontogram — real tooth SVGs, per-surface color; scrolls horizontally */}
      <div className="space-y-2 overflow-x-auto rounded-xl bg-paper p-3 sm:p-4">
        <Arch fdis={UPPER_FDI} visit={visit} visibleLayers={effectiveVisible} selected={isActive ? selected : null} interactive={isActive} heightPx={heightPx} onSelect={onSelect} />
        <div className="mx-auto h-px w-3/4 bg-line" />
        <Arch fdis={LOWER_FDI} visit={visit} visibleLayers={effectiveVisible} selected={isActive ? selected : null} interactive={isActive} heightPx={heightPx} onSelect={onSelect} />
      </div>
    </div>
  )
}

function StatusBadge({ layer }: { layer: Layer }) {
  const map: Record<Layer, string> = {
    treated: "bg-sage/15 text-[#566B3C]",
    planned: "bg-black/[0.05] text-[#475569]",
    existing: "bg-black/[0.05] text-muted",
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[layer]}`}>
      {STATUS_LABEL[layer]}
    </span>
  )
}

// Per-tooth cross-visit history (oldest → newest) — the "one tooth, its whole
// story" view that makes SUN unique.
function toothHistory(fdi: number): Array<{ date: string; finding: Finding }> {
  return VISITS.filter((v) => v.findings[fdi]).map((v) => ({ date: v.date, finding: v.findings[fdi] }))
}

// Illustrative — what a dentist can do on a tooth in Dentalemon. Presented as a
// capability list (not live controls) for this marketing demo.
const TOOTH_ACTIONS: Array<{ icon: Icon; label: string; desc: string }> = [
  { icon: ClipboardText, label: "Plan a treatment", desc: "Propose work and add it to the plan" },
  { icon: CheckCircle, label: "Mark as treated", desc: "Record completed work, dated to the visit" },
  { icon: Plus, label: "Chart a condition", desc: "Caries, fracture, wear, and more" },
  { icon: NotePencil, label: "Add a clinical note", desc: "Notes that travel with the tooth" },
  { icon: Paperclip, label: "Attach an X-ray", desc: "Link imaging straight to this tooth" },
]

// Interactive per-surface chart (the product's B/M/D/P/O surface map). Pick a
// color, tap a surface, it fills — a hands-on taste of charting a tooth.
const PAINT_COLORS: Array<{ label: string; color: string }> = [
  { label: "Caries", color: CONDITION_COLOR.caries },
  { label: "Filling", color: CONDITION_COLOR.filled },
  { label: "Crown", color: CONDITION_COLOR.crown },
]
const SURFACE_KEYS = ["top", "left", "right", "center", "bottom"] as const

function SurfaceMap({ fdi }: { fdi: number }) {
  const universal = FDI_TO_UNIVERSAL[fdi]
  const ref = useRef<HTMLDivElement>(null)
  const [raw, setRaw] = useState("")
  const [painted, setPainted] = useState<Record<string, string>>({})
  const [paint, setPaint] = useState<string>(CONDITION_COLOR.caries)

  // Reset paint when the tooth changes.
  useEffect(() => {
    setPainted({})
  }, [fdi])

  useEffect(() => {
    let cancelled = false
    fetch(`/teeth/tooth-${universal}-surfacemap.svg`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error())))
      .then((t) => !cancelled && setRaw(t))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [universal])

  // Apply painted colors to the injected SVG; unpainted surfaces stay white.
  // The surface ids sit on the <path> elements directly, so color each element
  // itself (plus any descendant shapes, defensively).
  useEffect(() => {
    const svg = ref.current?.querySelector("svg")
    if (!svg) return
    for (const key of SURFACE_KEYS) {
      const el = svg.querySelector(`#tooth-surfacemap-${key}`)
      if (!el) continue
      const col = painted[key] ?? "#ffffff"
      if (el instanceof SVGElement) el.style.fill = col
      el.querySelectorAll("path, polygon, rect, circle, ellipse").forEach((child) => {
        if (child instanceof SVGElement) child.style.fill = col
      })
    }
  }, [raw, painted])

  function handleClick(e: React.MouseEvent) {
    const group = (e.target as Element).closest('[id^="tooth-surfacemap-"]')
    const id = group?.id ?? ""
    const key = SURFACE_KEYS.find((k) => id === `tooth-surfacemap-${k}`)
    if (!key) return
    setPainted((p) => ({ ...p, [key]: p[key] === paint ? "#ffffff" : paint }))
  }

  return (
    <div>
      {raw ? (
        <div
          ref={ref}
          onClick={handleClick}
          className="mx-auto w-full max-w-[210px] cursor-pointer [&_svg]:h-auto [&_svg]:w-full"
          // surfacemap SVG is our own controlled static asset
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: raw }}
        />
      ) : (
        <div className="mx-auto aspect-square w-full max-w-[210px] rounded-lg bg-black/[0.03]" />
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {PAINT_COLORS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setPaint(c.color)}
            aria-pressed={paint === c.color}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
              paint === c.color ? "border-ink/40 bg-paper text-ink" : "border-line text-muted hover:text-ink"
            }`}
          >
            <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} aria-hidden />
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPainted({})}
          className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          Reset
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">Pick a color, tap a surface to chart it.</p>
    </div>
  )
}

// ToothPanel — a right-side slideout (bottom sheet on mobile) that opens when a
// tooth is tapped. Shows the tooth, an interactive surface chart, its full
// cross-visit history, and the capabilities a dentist has on it. Escape /
// backdrop / close button all dismiss. Slide respects prefers-reduced-motion.
function ToothPanel({
  fdi,
  visit,
  visibleLayers,
  onClose,
}: {
  fdi: number | null
  visit: Visit
  visibleLayers: Set<Layer>
  onClose: () => void
}) {
  useEffect(() => {
    if (fdi === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fdi, onClose])

  const open = fdi !== null
  const history = open ? toothHistory(fdi) : []
  const raw = open ? visit.findings[fdi] : undefined
  const current = raw && visibleLayers.has(raw.layer) ? raw : undefined

  return (
    <>
      {/* mobile backdrop (the panel is a bottom sheet there) */}
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 z-20 bg-ink/20 transition-opacity duration-300 sm:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={open && fdi !== null ? `Tooth ${fdi}: history and actions` : undefined}
        aria-hidden={!open}
        // Shadow ONLY when open. When closed the panel parks off the right edge and
        // its left shadow would blur back onto the frame's right edge (a phantom
        // "frame shadow"). Gated on `open`, it appears only as the panel slides in.
        className={`absolute inset-x-0 bottom-0 z-30 flex max-h-[88%] flex-col overflow-y-auto rounded-t-2xl border-t border-line bg-white p-5 transition-transform duration-300 ease-out sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:h-full sm:max-h-none sm:w-[340px] sm:rounded-t-none sm:rounded-l-2xl sm:border-l sm:border-t-0 ${
          open
            ? "translate-y-0 shadow-[0_-12px_40px_-12px_rgba(46,42,38,0.3)] sm:translate-x-0 sm:shadow-[-12px_0_40px_-12px_rgba(46,42,38,0.3)]"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        }`}
      >
        {open && fdi !== null && (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink">Tooth {fdi}</p>
                <p className="text-xs text-muted">{toothName(fdi)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                <X weight="bold" size={18} />
              </button>
            </div>

            {/* current status */}
            <div className="mb-5 rounded-xl border border-line bg-paper px-3 py-2.5">
              {current ? (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                  <span className="font-semibold text-ink">{current.label}</span>
                  {current.surfaces?.length ? <span className="capitalize text-muted">{current.surfaces.join(", ")}</span> : null}
                  <StatusBadge layer={current.layer} />
                </div>
              ) : (
                <p className="text-sm text-muted">Sound. No active findings on this tooth.</p>
              )}
            </div>

            {/* interactive surface chart — tap a surface, color comes out */}
            <p className="mb-2.5 text-sm font-semibold text-ink">Chart this tooth</p>
            <div className="mb-6 rounded-xl border border-line bg-white p-3">
              <SurfaceMap fdi={fdi} />
            </div>

            {/* cross-visit history — the unique SUN value */}
            <p className="mb-2.5 text-sm font-semibold text-ink">History</p>
            {history.length ? (
              <ol className="mb-6 space-y-3 border-l border-line pl-4">
                {history.map(({ date, finding }, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-ink/30" aria-hidden />
                    <p className="text-xs font-medium text-ink">{date}</p>
                    <p className="text-sm text-muted">
                      {finding.label}
                      {finding.surfaces?.length ? <span className="capitalize"> · {finding.surfaces.join(", ")}</span> : null}
                    </p>
                    <span className="mt-1 inline-block">
                      <StatusBadge layer={finding.layer} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mb-6 text-sm text-muted">No findings yet. This tooth is healthy across every visit.</p>
            )}

            {/* capabilities */}
            <p className="mb-2.5 text-sm font-semibold text-ink">What you can do here</p>
            <div className="flex flex-col gap-1.5">
              {TOOTH_ACTIONS.map(({ icon: ActionIcon, label, desc }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lemon/20 text-ink ring-1 ring-lemon/40">
                    <ActionIcon size={18} weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{label}</span>
                    <span className="block text-xs text-muted">{desc}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

export function SunDemo() {
  const initialSlide = VISITS.length - 1 // most recent visit centered
  const [activeIndex, setActiveIndex] = useState(initialSlide)
  const [selected, setSelected] = useState<number | null>(null)
  const [visible, setVisible] = useState<Set<Layer>>(() => new Set(ALL_LAYERS))
  // Reduced-motion: set after mount (default = full) so SSR + first client
  // render agree, then re-init Swiper flat via the key below if requested.
  const [reduced, setReduced] = useState(false)
  const swiperRef = useRef<{ slidePrev: () => void; slideNext: () => void } | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => {
      setReduced(mq.matches)
      // A preference flip remounts Swiper (key change) back to initialSlide;
      // resync React state so the centered card, active index and detail agree.
      setActiveIndex(initialSlide)
      setSelected(null)
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [initialSlide])

  function toggleLayer(layer: Layer) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) {
        if (next.size === 1) return prev // never empty the set (matches product)
        next.delete(layer)
      } else {
        next.add(layer)
      }
      return next
    })
  }

  function selectTooth(fdi: number) {
    setSelected((cur) => (cur === fdi ? null : fdi)) // tapping the selected tooth clears it
  }

  const activeVisit = VISITS[activeIndex] ?? VISITS[initialSlide]
  // Only the current/open card honors the live filter; snapshots show all layers.
  const visibleForActive = activeVisit.current ? visible : new Set<Layer>(ALL_LAYERS)

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Ambient lemon glow behind the card (sun = lemon) — gives the chart life
          without a hard shadow. Decorative; gently breathes, off on reduced-motion. */}
      <div
        aria-hidden
        className="sun-glow pointer-events-none absolute -inset-x-16 -inset-y-20 rounded-[80px] bg-[radial-gradient(55%_55%_at_50%_50%,rgba(244,196,48,0.6),rgba(244,196,48,0.2)_45%,rgba(244,196,48,0)_72%)] blur-3xl"
      />
      <div className="relative rounded-[28px] border border-ink/15 bg-white p-2">
        <div className="relative overflow-hidden rounded-[22px] border border-ink/15 bg-paper p-4 sm:p-6">
          {/* App top bar */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/patient-maria.jpg"
                alt="Maria Santos"
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover ring-1 ring-line"
              />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-ink">Maria Santos</p>
                <p className="text-xs text-muted">Patient since 2019 &middot; {VISITS.length} visits</p>
              </div>
            </div>
          </div>

          {/* Cover-flow timeline */}
          <Swiper
            key={reduced ? "rm" : "full"}
            modules={[EffectCoverflow, Pagination, Keyboard]}
            effect="coverflow"
            grabCursor
            centeredSlides
            slidesPerView="auto"
            initialSlide={initialSlide}
            onSwiper={(s: { slidePrev: () => void; slideNext: () => void }) => {
              swiperRef.current = s
            }}
            speed={reduced ? 0 : undefined}
            coverflowEffect={reduced ? COVERFLOW_FLAT : COVERFLOW}
            keyboard={{ enabled: true }}
            pagination={{
              clickable: true,
              renderBullet: (index: number, className: string) => {
                const v = VISITS[index]
                const label = v ? `Visit ${index + 1} of ${VISITS.length}, ${v.date}` : `Visit ${index + 1}`
                return `<span class="${className}" role="button" tabindex="0" aria-label="${label}" title="${label}"></span>`
              },
            }}
            onSlideChange={(swiper: { activeIndex: number }) => {
              setActiveIndex(swiper.activeIndex)
              setSelected(null) // teeth differ per visit; clear stale selection
            }}
            className="sun-swiper"
          >
            {VISITS.map((visit, idx) => (
              <SwiperSlide key={visit.id} className="sun-slide">
                <VisitCard
                  visit={visit}
                  isActive={idx === activeIndex}
                  visible={visible}
                  onToggleLayer={toggleLayer}
                  selected={selected}
                  onSelect={selectTooth}
                />
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Empty right gutter on the latest visit (no next card) — fill it with a
              hint that tapping a tooth opens its record panel here. Hidden once a
              tooth is selected (the panel takes this space) and on small screens. */}
          {activeIndex === VISITS.length - 1 && selected === null && (
            <div
              aria-hidden
              className="pointer-events-none absolute right-7 top-[52%] hidden w-[180px] -translate-y-1/2 lg:block"
            >
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-white/70 px-4 py-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lemon/20 text-ink ring-1 ring-lemon/40">
                  <HandTap weight="bold" size={20} />
                </span>
                <p className="text-sm font-semibold text-ink">Tap any tooth</p>
                <p className="text-xs leading-snug text-muted">Its full record, history, and surface chart open right here.</p>
              </div>
            </div>
          )}

          {/* Swipe affordance — functional prev/next arrows in their own row BELOW
              the chart (so they never overlap the teeth) + a tap/swipe hint. Drag,
              dots and arrow keys also work; nudge respects prefers-reduced-motion. */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Previous visit"
              onClick={() => swiperRef.current?.slidePrev()}
              disabled={activeIndex === 0}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:pointer-events-none disabled:opacity-30"
            >
              <CaretLeft weight="bold" size={16} className="sun-arrow-prev" />
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lemon/20 px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-lemon/40">
              <Lightbulb weight="fill" size={13} className="shrink-0 text-lemon-deep" aria-hidden />
              Swipe between visits · tap any tooth for its history
            </span>
            <button
              type="button"
              aria-label="Next visit"
              onClick={() => swiperRef.current?.slideNext()}
              disabled={activeIndex === VISITS.length - 1}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:pointer-events-none disabled:opacity-30"
            >
              <CaretRight weight="bold" size={16} className="sun-arrow-next" />
            </button>
          </div>

          {/* Compact legend — real clinical colors */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <LegendKey swatch={CONDITION_COLOR.caries} label="Caries" />
            <LegendKey swatch={CONDITION_COLOR.fractured} label="Fractured" />
            <LegendKey swatch={CONDITION_COLOR.filled} label="Filled" />
            <LegendKey swatch={CONDITION_COLOR.crown} label="Crown" />
            <LegendKey dotted label="Planned" />
            <LegendKey solid label="Treated" />
          </div>

          {/* Per-tooth slideout — opens on tooth tap */}
          <ToothPanel
            fdi={selected}
            visit={activeVisit}
            visibleLayers={visibleForActive}
            onClose={() => setSelected(null)}
          />
        </div>
      </div>
    </div>
  )
}

export default SunDemo
