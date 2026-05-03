'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import UnblockSyriaNotification from './UnblockSyriaNotification'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isTransit = pathname?.startsWith('/transit') ?? false

  return (
    <>
      {!isTransit && <Navbar />}
      {children}
      {!isTransit && <UnblockSyriaNotification />}
    </>
  )
}
