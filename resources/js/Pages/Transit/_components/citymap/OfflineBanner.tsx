import { useOffline } from '../../_hooks/useOffline'

export default function OfflineBanner() {
  const isOffline = useOffline()

  if (!isOffline) return null

  return (
    <div
      className="sticky top-[57px] z-30 border-b px-4 py-2 text-center text-sm"
      style={{
        backgroundColor: 'var(--banner-bg)',
        color: 'var(--banner-text)',
        borderColor: 'var(--banner-border)',
      }}
    >
      أنت غير متصل: خطوط الباص متاحة، والخريطة قد تكون محدودة
    </div>
  )
}
