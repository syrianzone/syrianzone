import React from 'react'
import './transit.css'
import { TransitThemeProvider, useTransitTheme } from './_components/TransitThemeContext'
import { QueryProvider } from './_providers/QueryProvider'
import MainLayout from '@/Layouts/MainLayout'

export default function TransitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout>
      <QueryProvider>
        <TransitThemeProvider>
          <TransitRootWrapper>
            {children}
          </TransitRootWrapper>
        </TransitThemeProvider>
      </QueryProvider>
    </MainLayout>
  )
}

function TransitRootWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTransitTheme()
  return (
    <div className="transit-root min-h-svh" data-transit-theme={theme}>
      {/* Prevent flash of main-site theme during hydration */}
      <style>{`
        body { background: var(--bg); }
      `}</style>
      {children}
    </div>
  )
}
