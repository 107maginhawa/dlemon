import type { Config } from "tailwindcss"

// Self-contained marketing-site theme. Tokens mirror DESIGN.md (provisional,
// sampled to harmonize with public/images/hero.png). Near-white body; warmth is
// contained to the hero block + the lemon accent. No dark mode.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2E2A26", // charcoal — all body/heading text, the line-art ink
        paper: "#FFFFFF", // body surface — clean white (Apple-aligned)
        cream: "#F8EFE6", // hero illustration's own backdrop tone (fallback behind hero art)
        lemon: { DEFAULT: "#F4C430", deep: "#E0B020", wash: "#FBF2D2" }, // accent + soft villain wash
        sage: "#8FA66A", // quiet secondary (plants); never competes with lemon
        muted: "#6B6258", // muted text — clears 4.5:1 on paper
        line: "#EDE9E3", // hairline borders / dividers / input strokes
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      maxWidth: { prose: "72ch" },
      boxShadow: {
        // soft ink-tinted lift for bordered card frames — depth without a dark line
        frame: "0 1px 2px rgb(46 42 38 / 0.05), 0 10px 30px -12px rgb(46 42 38 / 0.18)",
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
}

export default config
