import { usePage } from '@inertiajs/react'
import Navbar from './Navbar'
import UnblockSyriaNotification from './UnblockSyriaNotification'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const { url } = usePage()
  const isTransit = url.startsWith('/transit')

  return (
    <>
      {!isTransit && <Navbar />}
      {children}
      {!isTransit && <UnblockSyriaNotification />}
    </>
  )
}
