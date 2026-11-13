import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePage } from '@inertiajs/react'
import Navbar from './Navbar'
import UnblockSyriaNotification from './UnblockSyriaNotification'
import { DevRoleSwitcher } from './DevRoleSwitcher'
import { FocusModeProvider } from '@/Contexts/FocusModeContext'
import { recordVisit } from '@/Lib/visit'
import { isFullBleed, isNavbarSticky, pathnameOf, routeFamily } from '@/Lib/routes'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const { url } = usePage()
  const path = pathnameOf(url)
  // Focus mode (a game hiding the chrome) is owned here because the navbar is a
  // sibling of the page and cannot be hidden from inside it.
  const [focus, setFocusState] = useState(false)
  const setFocus = useCallback((value: boolean) => setFocusState(value), [])
  const focusValue = useMemo(() => ({ focus, setFocus }), [focus, setFocus])
  // Last-visited tracking for the homepage badge (home itself never overwrites).
  useEffect(() => { recordVisit(path); }, [path])
  // The catalogue decides which pages take the full viewport and which keep
  // the navbar in the flow; the shell only knows its own homepage rule.
  const fullBleed = isFullBleed(path)
  const sticky = path !== '/' && !fullBleed && isNavbarSticky(path)

  return (
    <FocusModeProvider value={focusValue}>
      <div className={fullBleed ? 'flex flex-col h-screen overflow-hidden' : ''}>
        {!focus && (
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none"
          >
            تجاوز إلى المحتوى
          </a>
        )}
        {!focus && <Navbar sticky={sticky} />}
        <main
          id="main-content"
          tabIndex={-1}
          className={
            (fullBleed ? 'flex-1 min-h-0 overflow-hidden ' : '') + 'focus:outline-none'
          }
        >
          {children}
        </main>
        {/* The popup is suppressed for the whole transit section. */}
        {routeFamily(path) !== 'transit' && <UnblockSyriaNotification />}
        <DevRoleSwitcher />
      </div>
    </FocusModeProvider>
  )
}
