import { useEffect } from 'react'
import { usePage } from '@inertiajs/react'
import Navbar from './Navbar'
import UnblockSyriaNotification from './UnblockSyriaNotification'
import { DevRoleSwitcher } from './DevRoleSwitcher'
import { recordVisit } from '@/Lib/visit'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const { url } = usePage()
  const path = url.split('?')[0]
  // Last-visited tracking for the homepage badge (home itself never overwrites).
  useEffect(() => { recordVisit(path); }, [path])
  const isTransit = path.startsWith('/transit')
  // Full-height pages: studio, admin, and city map — no body scrollbar, navbar non-sticky
  const isFullHeight =
    path.startsWith('/transit/studio') ||
    path.startsWith('/transit/admin') ||
    path.match(/^\/transit\/city\/[^/]+\/map$/) !== null ||
    path.match(/^\/transit\/city\/[^/]+\/route\/[^/]+$/) !== null ||
    path.match(/^\/transit\/city\/[^/]+$/) !== null
  // The games hub and each game: a non-sticky navbar too, but the page still
  // scrolls when a board is taller than the screen.
  const isGames = path === '/games' || path.startsWith('/games/')

  return (
    <div className={isFullHeight ? 'flex flex-col h-screen overflow-hidden' : ''}>
      <Navbar sticky={!isFullHeight && !path.startsWith('/muslim') && path !== '/' && !isGames} />
      <div className={isFullHeight ? 'flex-1 min-h-0 overflow-hidden' : ''}>
        {children}
      </div>
      {!isTransit && <UnblockSyriaNotification />}
      <DevRoleSwitcher />
    </div>
  )
}
