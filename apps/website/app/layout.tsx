import type { Metadata } from 'next'
import "./globals.css"
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Monobase Healthcare Platform - Digital Healthcare Solutions',
  description: 'The complete digital healthcare platform unifying patient care, provider workflows, and healthcare operations. HIPAA-compliant telemedicine, EMR, billing, and more.',
  keywords: 'healthcare platform, telemedicine, EMR, electronic medical records, healthcare billing, healthcare management, HIPAA compliant, digital health',
  authors: [{ name: 'Monobase Healthcare' }],
  openGraph: {
    title: 'Monobase Healthcare Platform',
    description: 'The complete digital healthcare platform for modern healthcare delivery',
    type: 'website',
    siteName: 'Monobase Healthcare',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monobase Healthcare Platform',
    description: 'The complete digital healthcare platform for modern healthcare delivery',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
