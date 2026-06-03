import '@fontsource/noto-sans-lao/400.css'
import '@fontsource/noto-sans-lao/600.css'
import '@fontsource/noto-sans-lao/700.css'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Phone Scan - Barcode scanner for desktop',
  description: 'Download Phone Scan and scan barcodes from your phone directly into desktop inputs.',
  applicationName: 'Phone Scan',
  icons: {
    icon: '/app-logo-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
