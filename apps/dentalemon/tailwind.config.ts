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
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Segoe UI", "Roboto", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Segoe UI", "Roboto", "sans-serif"],
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
          DEFAULT: "#FFE97D",
          hover: "#F5DC60",
          foreground: "#4A4018",
          soft: "rgba(255,233,125,0.15)",
          focus: "rgba(255,233,125,0.35)",
          // Darker lemon for emphasis/selection accents (e.g. CDT-code selected
          // borders & star). AA-readable as a border/icon, not as body text.
          accent: "#C8B800",
        },
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
