import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    // @monobase/ui is consumed as source (workspace:*, exports → ./src, no dist build),
    // so its class strings must be scanned here too — otherwise Tailwind purges every
    // class used ONLY in the package. That is what broke the sidebar (QA-001): the
    // primitive's structural/toggle classes (w-[--sidebar-width], group-data-
    // [collapsible=offcanvas]:*, h-svh, fixed md:flex) were never generated.
    "../../packages/ui/src/**/*.{ts,tsx}",
    "./node_modules/@daveyplate/better-auth-ui/dist/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Read from the CSS font tokens in globals.css (:root). Default values
        // are the same Apple system stacks as before; a theme/skin re-points
        // --font-sans / --font-display without touching this config.
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          // AA-dark red for destructive TEXT on a light tint (status badges).
          // `foreground` is white (text ON a red fill); this is its inverse.
          emphasis: "#b91c1c",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        lemon: {
          // Brand palette read from CSS tokens (:root in globals.css). Defaults
          // are the same hexes as before; a theme re-points --lemon-* centrally.
          DEFAULT: "var(--lemon)",
          hover: "var(--lemon-hover)",
          foreground: "var(--lemon-foreground)",
          soft: "rgba(255,233,125,0.15)",
          focus: "rgba(255,233,125,0.35)",
          // Darker lemon for emphasis/selection accents (e.g. CDT-code selected
          // borders & star). AA-readable as a border/icon, not as body text.
          accent: "var(--lemon-accent)",
        },
        // Status-badge roles — fill (-bg) + AA-readable ink (-fg). Defaults
        // reproduce today's literals (green done / neutral planned); diagnosed
        // is the lemon role (pale lemon fill, dark lemon ink — never lemon text).
        "status-done": {
          DEFAULT: "var(--status-done-bg)",
          foreground: "var(--status-done-fg)",
        },
        "status-planned": {
          DEFAULT: "var(--status-planned-bg)",
          foreground: "var(--status-planned-fg)",
        },
        "status-diagnosed": {
          DEFAULT: "var(--status-diagnosed-bg)",
          foreground: "var(--status-diagnosed-fg)",
        },
        // Hairline / outline color token (default = the border color).
        line: "hsl(var(--line))",
        dental: {
          healthy: "var(--dental-healthy)",
          caries: "var(--dental-caries)",
          fractured: "var(--dental-fractured)",
          filled: "var(--dental-filled)",
          crown: "var(--dental-crown)",
          missing: "var(--dental-missing)",
          implant: "var(--dental-implant)",
          extracted: "var(--dental-extracted)",
          watchlist: "var(--dental-watchlist)",
          "watchlist-foreground": "var(--dental-watchlist-foreground)",
        },
        // DEFAULT = the Apple mid-tone FILL color (backgrounds, dots, icons).
        // foreground = AA-readable dark shade for TEXT on a light tint (status
        // badges): mid-tones fail ~1.7-2:1 as text, so never use the DEFAULT for text.
        success: { DEFAULT: "#34C759", foreground: "#15803d" },
        warning: { DEFAULT: "#FF9500", foreground: "#b45309" },
        info: { DEFAULT: "#5AC8FA", foreground: "#0369a1" },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Active visit-card elevation, tokenized (default = the prior literal
        // shadow). Used via `shadow-card-active`; a theme re-points the token.
        "card-active": "var(--card-shadow-active)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
