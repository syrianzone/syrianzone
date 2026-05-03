import Header from '../../_components/layout/Header'

export default function CityRoutesLoading() {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--bg)]">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-6">
          <div className="mb-2 h-8 w-40 animate-pulse rounded-lg bg-[var(--surface)]" />
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface)]" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="h-10 w-1.5 animate-pulse rounded-full bg-[var(--border)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--border)]" />
              </div>
              <div className="space-y-1 text-end">
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-12 animate-pulse rounded bg-[var(--border)]" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
