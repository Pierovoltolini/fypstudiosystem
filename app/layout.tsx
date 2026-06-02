import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import ThemeProvider from '@/components/providers/ThemeProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'FYP.STUDIO',
    template: '%s | FYP.STUDIO',
  },
  description: 'A modern commerce operating system.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://fyp.studio'
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px' },
            }}
            richColors
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
