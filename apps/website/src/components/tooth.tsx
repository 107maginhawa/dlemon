"use client"

// Tooth — renders the REAL product tooth SVG (apps/dentalemon/public/teeth,
// "column" variant: front + back + occlusal views) and tints it the way the
// product does: a whole-tooth fill (crowns) OR specific SURFACES only
// (occlusal / mesial / distal caries, fillings). Self-contained: fetches the
// static SVG, rewrites its ids to anatomical surfaces, colors via DOMParser.

import { useEffect, useMemo, useState } from "react"
import { FDI_TO_UNIVERSAL, transformSvgIds, applyColors, type SurfaceStatus } from "./tooth-data"

// Module cache: one fetch + id-transform per universal tooth, reused everywhere.
const svgCache = new Map<number, string>()
async function loadSvg(universal: number): Promise<string> {
  const cached = svgCache.get(universal)
  if (cached) return cached
  const res = await fetch(`/teeth/tooth-${universal}-column.svg`)
  if (!res.ok) throw new Error(`tooth ${universal} svg ${res.status}`)
  const transformed = transformSvgIds(await res.text(), universal)
  svgCache.set(universal, transformed)
  return transformed
}

export function Tooth({
  fdi,
  fillColor,
  surfaces,
  heightPx,
}: {
  fdi: number
  /** whole-tooth fill (crowns, whole-tooth states) */
  fillColor?: string
  /** color specific surfaces only (occlusal/mesial/distal caries, fillings) */
  surfaces?: SurfaceStatus[]
  heightPx: number
}) {
  const universal = FDI_TO_UNIVERSAL[fdi]
  const [raw, setRaw] = useState("")
  useEffect(() => {
    let cancelled = false
    if (!universal) return
    loadSvg(universal)
      .then((s) => !cancelled && setRaw(s))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [universal])

  const colored = useMemo(
    () => (raw ? applyColors(raw, universal, { fillColor, surfacesStatus: surfaces }) : ""),
    [raw, universal, fillColor, surfaces],
  )
  // Column SVG aspect is ~212:856 (0.2477 wide:tall).
  const width = Math.round(heightPx * 0.2477)

  if (!colored) {
    // ponytail: placeholder keeps arch width stable while the SVG streams in.
    return <span style={{ height: heightPx, width }} className="shrink-0 rounded bg-black/[0.04]" />
  }
  return (
    <span
      className="tooth-svg shrink-0"
      style={{ height: heightPx, width }}
      // SVG is our own controlled static asset.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: colored }}
    />
  )
}
