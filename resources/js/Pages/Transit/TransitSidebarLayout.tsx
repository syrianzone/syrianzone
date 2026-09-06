'use client'
import { useState, useEffect } from 'react'
import { usePage } from '@inertiajs/react'
import { TransitSidebar } from './_components/TransitSidebar'
import { BottomSheet } from './_components/BottomSheet'

export default function TransitSidebarLayout({ children }: { children: React.ReactNode }) {
  const { url } = usePage()
  const path = url.split('?')[0]
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    const mq = window.matchMedia('(max-width: 767px)')
    mq.addEventListener('change', checkMobile)
    return () => mq.removeEventListener('change', checkMobile)
  }, [])

  const hideSidebar = path.startsWith('/transit/studio') || path.startsWith('/transit/admin')
  const sidebarContent = <TransitSidebar pathname={path} search={new URLSearchParams(url.split('?')[1] || '')} />

  return (
    // transit-root activates transit.css (map popup/control theming derives
    // site theme vars here; without it those rules never match anything).
    <div className="transit-shell transit-root flex h-full bg-background">
      {!hideSidebar && (
        <>
          <aside className="transit-sidebar hidden sm:block w-96 shrink-0 bg-card border-s border-border relative z-auto overflow-y-auto">
            {sidebarContent}
          </aside>
          {isMobile && <BottomSheet>{sidebarContent}</BottomSheet>}
        </>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  )
}
