import type { Metadata } from "next"
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google"
import "./globals.css"

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://dentalemon.com"),
  title: {
    default: "Dentalemon. Buy once. Own forever.",
    template: "%s · Dentalemon",
  },
  description:
    "Local-first, buy-once dental software for independent practices. Records, billing, scheduling, and one unified patient timeline. Software you actually own, that keeps working even if we disappear.",
  openGraph: {
    title: "Dentalemon. Buy once. Own forever.",
    description:
      "Local-first, buy-once dental software for independent practices. Own your software, your data, your practice.",
    siteName: "Dentalemon",
    type: "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
