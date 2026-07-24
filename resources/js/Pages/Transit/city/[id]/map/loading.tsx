import Header from '../../../_components/layout/Header'

export default function MapLoading() {
  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <Header />
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-[var(--muted)]">جاري تحميل الخريطة...</span>
      </div>
    </div>
  )
}
