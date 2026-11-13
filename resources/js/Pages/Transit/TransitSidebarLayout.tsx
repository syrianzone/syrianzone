import { useEffect, useState } from 'react'
import { usePage } from '@inertiajs/react'
import { TransitSidebar } from './_components/TransitSidebar'
import { BottomSheet } from '@/Components/BottomSheet'
import { useIsMobile } from '@/Lib/useIsMobile'

export default function TransitSidebarLayout({ children }: { children: React.ReactNode }) {
  const { url } = usePage()
  const path = url.split('?')[0]
  // The sheet is the sidebar's container below `sm` (`sm:!hidden` on the sheet,
  // `hidden sm:block` on the aside), so the question is Tailwind's `sm`.
  const isMobile = useIsMobile('sm')
  // The server renders the wide variant; the sheet joins after mount so the
  // first client render still matches the markup it hydrates.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const hideSidebar = path.startsWith('/transit/studio') || path.startsWith('/transit/admin')
  const sidebarContent = <TransitSidebar pathname={path} />

  return (
    // transit-root activates transit.css (map popup/control theming derives
    // site theme vars here; without it those rules never match anything).
    <div className="transit-shell transit-root flex h-full bg-background">
      {!hideSidebar && (
        <>
          <aside className="transit-sidebar hidden sm:block w-96 shrink-0 bg-card border-s border-border relative z-auto overflow-y-auto">
            {sidebarContent}
          </aside>
          {mounted && isMobile && <BottomSheet>{sidebarContent}</BottomSheet>}
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
