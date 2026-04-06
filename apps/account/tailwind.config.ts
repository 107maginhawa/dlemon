import type { Config } from "tailwindcss"
import uiConfig from "../../packages/ui/tailwind.config"

const config: Config = {
  darkMode: uiConfig.darkMode,
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "./node_modules/@daveyplate/better-auth-ui/dist/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: uiConfig.theme,
  plugins: uiConfig.plugins,
}

export default config
