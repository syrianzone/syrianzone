import React from 'react'
import './transit.css'
import { TransitThemeProvider } from './_components/TransitThemeContext'
import { QueryProvider } from './_providers/QueryProvider'
import MainLayout from '@/Layouts/MainLayout'

export default function TransitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout>
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
    </MainLayout>
  )
}
