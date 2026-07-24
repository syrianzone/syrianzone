import { usePage } from '@inertiajs/react'
import Navbar from './Navbar'
import UnblockSyriaNotification from './UnblockSyriaNotification'
import { DevRoleSwitcher } from './DevRoleSwitcher'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const { url } = usePage()
  const path = url.split('?')[0]
  const isTransit = path.startsWith('/transit')
  // Full-height pages: studio, admin, and city map — no body scrollbar, navbar non-sticky
  const isFullHeight =
    path.startsWith('/transit/studio') ||
    path.startsWith('/transit/admin') ||
    path.match(/^\/transit\/city\/[^/]+\/map$/) !== null

  return (
    <div className={isFullHeight ? 'flex flex-col h-screen overflow-hidden' : ''}>
      <Navbar sticky={!isFullHeight} />
      <div className={isFullHeight ? 'flex-1 min-h-0 overflow-hidden' : ''}>
        {children}
      </div>
      {!isTransit && <UnblockSyriaNotification />}
      <DevRoleSwitcher />
    </div>
  )
}
