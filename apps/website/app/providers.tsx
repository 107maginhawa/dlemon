"use client"

import { ThemeProvider } from 'next-themes'
import { ApiProvider } from '@monobase/sdk/react/provider'

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7213'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ApiProvider apiBaseUrl={apiBaseUrl}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        {children}
      </ThemeProvider>
    </ApiProvider>
  )
}
