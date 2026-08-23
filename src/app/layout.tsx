import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'Mini PM',
  description: 'Your AI-powered product research & content toolkit',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex" suppressHydrationWarning>
        <Sidebar />
        <main className="flex-1 overflow-hidden ml-[240px]">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
}
