import type { Config } from "tailwindcss"
import uiConfig from "../../packages/ui/tailwind.config"

const config: Config = {
  darkMode: uiConfig.darkMode as Config['darkMode'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: uiConfig.theme,
  plugins: uiConfig.plugins as Config['plugins'],
}

export default config