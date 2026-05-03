'use client'

interface DirectionsButtonProps {
  lat: number
  lng: number
}

export default function DirectionsButton({ lat, lng }: DirectionsButtonProps) {
  return (
    <button
      onClick={() =>
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
      }
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--gold)] transition-colors hover:bg-[var(--border-hover)]"
      aria-label="الاتجاهات"
      title="الاتجاهات"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    </button>
  )
}
