import React from 'react'
import './transit.css'
import { TransitThemeProvider } from './_components/TransitThemeContext'
import MainLayout from '@/Layouts/MainLayout'
import TransitSidebarLayout from './TransitSidebarLayout'

// The React Query client is mounted once for the whole app (app.tsx / ssr.tsx),
// so Transit shares the global cache instead of forking its own.
export default function TransitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout>
      <TransitThemeProvider>
        <TransitSidebarLayout>
          {children}
        </TransitSidebarLayout>
      </TransitThemeProvider>
    </MainLayout>
  )
}
