import React from 'react'
import { usePage } from '@inertiajs/react'
import './transit.css'
import { TransitThemeProvider, useTransitTheme } from './_components/TransitThemeContext'
import { QueryProvider } from '@/Providers/QueryProvider'
import MainLayout from '@/Layouts/MainLayout'
import TransitSidebarLayout from './TransitSidebarLayout'

export default function TransitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout>
      <QueryProvider>
        <TransitThemeProvider>
          <TransitSidebarLayout>
            {children}
          </TransitSidebarLayout>
        </TransitThemeProvider>
      </QueryProvider>
    </MainLayout>
  )
}