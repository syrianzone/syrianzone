import type { Metadata } from 'next'
import './transit.css'
import { TransitThemeProvider } from './_components/TransitThemeContext'
import { QueryProvider } from './_providers/QueryProvider'

export const metadata: Metadata = {
  title: 'ترانزيت — Syria Transit',
  description: 'خريطة تفاعلية لخطوط السيرافيس في سوريا',
  manifest: '/transit-manifest.webmanifest',
}

export default function TransitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="transit-root min-h-svh" data-transit-theme="jasmine">
      {/* Prevent flash of main-site theme during hydration */}
      <style>{`
        body { background: var(--bg); }
      `}</style>
      <QueryProvider>
        <TransitThemeProvider>
          {children}
        </TransitThemeProvider>
      </QueryProvider>
    </div>
  )
}
