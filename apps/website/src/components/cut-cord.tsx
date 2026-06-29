"use client"

import { useEffect, useRef, useState } from "react"

import { Reveal } from "@/components/reveal"

// Full-bleed "cut the cord" motif for the Unsubscribe band. The subscription
// cord (left) is taut and hung with five $/mo charges; a pair of scissors snips
// it with a bright spark and a visible cut gap; the freed end (right) drops
// slack, tagged "NO MORE $/mo" and sealed with the Dentalemon lemon. Pure SVG so
// it stays crisp edge to edge and on-token.
//
// The cut is animated as a snap that fires when the band scrolls into view
// (scissors chomp → spark burst → freed end falls into slack). It re-arms after
// the band fully leaves the viewport, so scrolling back to it replays the cut —
// without re-firing on small scroll jitter (see the hysteresis below). The drawn
// markup IS the after-state, so SSR / no-JS / reduced-motion render the static
// aftermath; the animation only arms on the client when motion is allowed.
// Keyframes live in globals.css (.cut-* classes).
const INK = "#2E2A26"
const SPARK = "#E0B020"
const TAGS = [96, 208, 320, 432, 544]

export function CutCord() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [play, setPlay] = useState(false)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Hysteresis: re-arm only once the band is FULLY gone (ratio 0), then
          // replay when it's back ≥15% in view. The gap between the two
          // thresholds means a small scroll wobble never re-triggers the cut.
          if (entry.intersectionRatio === 0) setPlay(false)
          else if (entry.intersectionRatio >= 0.15) setPlay(true)
        }
      },
      { threshold: [0, 0.15], rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Reveal className="w-full">
      <svg
        ref={svgRef}
        viewBox="0 0 1440 132"
        preserveAspectRatio="xMidYMid meet"
        className={`cut-cord block h-auto w-full font-sans${play ? " cut-play" : ""}`}
        role="img"
        aria-label="A subscription cord, hung with monthly charges, being cut by scissors; the freed end is tagged no more monthly and sealed with a lemon."
      >
        {/* left: the taut subscription cord, ending at the cut with a slight recoil */}
        <g className="cut-left">
          <path d="M0 50 C 240 47, 470 51, 612 50" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />

          {/* five $/mo tags hanging off the taut cord */}
          {TAGS.map((x) => (
            <g key={x}>
              <line x1={x} y1="49" x2={x} y2="72" stroke={INK} strokeWidth="2" />
              <rect x={x - 26} y="72" width="52" height="28" rx="6" fill="#fff" stroke={INK} strokeWidth="2.2" />
              <text x={x} y="86.5" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="600" fill={INK}>
                $/mo
              </text>
            </g>
          ))}
        </g>

        {/* right: the freed end + its tag + lemon, dropping from taut into slack */}
        <g className="cut-freed">
          <path d="M632 60 C 676 104, 880 100, 1300 80 C 1330 78, 1352 77, 1364 76" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />

          {/* freedom tag hanging off the freed end */}
          <g>
            <line x1="1190" y1="81" x2="1190" y2="96" stroke={INK} strokeWidth="2" />
            <rect x="1124" y="96" width="132" height="30" rx="8" fill={INK} />
            <text x="1190" y="111.5" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="700" fill="#FCFBF9">
              NO MORE $/mo
            </text>
          </g>

          {/* the Dentalemon lemon, bigger, sealing the freed end */}
          <g transform="translate(1392 74)">
            <circle r="23" fill="#F4C430" stroke={INK} strokeWidth="2" />
            <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <line x1="0" y1="0" x2="0" y2="-17" />
              <line x1="0" y1="0" x2="14" y2="-9" />
              <line x1="0" y1="0" x2="17" y2="4" />
              <line x1="0" y1="0" x2="8" y2="16" />
            </g>
            <circle r="3" fill="#fff" />
          </g>
        </g>

        {/* scissors — Phosphor "Scissors" glyph (256 grid), inlined, blades on the cut */}
        <g className="cut-scissors">
          <g transform="translate(666 46) rotate(200) scale(0.34) translate(-128 -128)" fill={INK}>
            <path d="M157.73,113.13A8,8,0,0,1,159.82,102L227.48,55.7a8,8,0,0,1,9,13.21l-67.67,46.3a7.92,7.92,0,0,1-4.51,1.4A8,8,0,0,1,157.73,113.13Zm80.87,85.09a8,8,0,0,1-11.12,2.08L136,137.7,93.49,166.78a36,36,0,1,1-9-13.19L121.83,128,84.44,102.41a35.86,35.86,0,1,1,9-13.19l143,97.87A8,8,0,0,1,238.6,198.22ZM80,180a20,20,0,1,0-5.86,14.14A19.85,19.85,0,0,0,80,180ZM74.14,90.13a20,20,0,1,0-28.28,0A19.85,19.85,0,0,0,74.14,90.13Z" />
          </g>
        </g>

        {/* louder snap burst at the cut */}
        <g className="cut-spark" stroke={SPARK} strokeWidth="3.4" strokeLinecap="round">
          <line x1="616" y1="44" x2="610" y2="29" />
          <line x1="627" y1="44" x2="630" y2="28" />
          <line x1="606" y1="47" x2="591" y2="41" />
          <line x1="638" y1="46" x2="650" y2="37" />
          <line x1="600" y1="53" x2="585" y2="54" />
          <line x1="621" y1="42" x2="619" y2="27" />
        </g>
      </svg>
    </Reveal>
  )
}
