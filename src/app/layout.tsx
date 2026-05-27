import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DuoFit',
  description: 'İki kişilik fitness takip sistemi',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}