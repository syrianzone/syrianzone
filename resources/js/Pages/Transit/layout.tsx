import React from 'react'
import { usePage } from '@inertiajs/react'
import './transit.css'
import { TransitThemeProvider, useTransitTheme } from './_components/TransitThemeContext'
import { QueryProvider } from '@/Providers/QueryProvider'
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
  const { url } = usePage()
  const path = url.split('?')[0]
  const isFullHeight =
    path.startsWith('/transit/studio') ||
    path.startsWith('/transit/admin') ||
    path.match(/^\/transit\/city\/[^/]+\/map$/) !== null

  return (
    <div
      className={`transit-root ${isFullHeight ? 'h-full' : 'min-h-svh'}`}
      data-transit-theme={theme}
    >
      {children}
    </div>
  )
}
