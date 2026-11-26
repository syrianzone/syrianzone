import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/Lib/utils'

const MINIMAL_HEIGHT = 250
const MAX_RATIO = 0.92
const HANDLE_HEIGHT = 40
/** Pointer travel (px) after which a press on the handle is a drag, not a tap. */
const DRAG_THRESHOLD = 5
/** The viewport height assumed until the browser reports one (SSR and hydration). */
const FALLBACK_VIEWPORT = 800

interface BottomSheetProps {
  children: React.ReactNode
  className?: string
  storageKey?: string
  initialHeight?: number
  hideBreakpoint?: 'sm' | 'md' | 'lg'
}

function readStoredHeight(storageKey: string): number | null {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return null
    const h = Number(saved)
    return !isNaN(h) && h >= MINIMAL_HEIGHT ? h : null
  } catch {
    return null
  }
}

function storeHeight(storageKey: string | undefined, height: number) {
  if (!storageKey) return
  try {
    localStorage.setItem(storageKey, String(Math.round(height)))
  } catch {
    // storage unavailable (private mode, quota): the height just isn't remembered
  }
}

/**
 * A resizable sheet pinned to the bottom of a narrow viewport. Drag the handle
 * (touch, pen or mouse) to resize it; the handle is also a button that toggles
 * between collapsed and expanded, and Escape inside the sheet collapses it.
 * The current height is published as `--sz-sheet-h` on the root element so
 * floating controls above the sheet can offset themselves.
 */
export function BottomSheet({
  children,
  className,
  storageKey,
  initialHeight,
  hideBreakpoint = 'sm',
}: BottomSheetProps) {
  // The first render must match the server's markup, so the remembered height
  // and the real viewport are only read once mounted.
  const [sheetHeight, setSheetHeight] = useState(initialHeight ?? MINIMAL_HEIGHT)
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_VIEWPORT)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const dragMoved = useRef(false)
  const pointerId = useRef<number | null>(null)
  const heightRef = useRef(sheetHeight)
  heightRef.current = sheetHeight
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentNaturalHeight, setContentNaturalHeight] = useState(0)

  const maxH = viewportHeight * MAX_RATIO

  useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!storageKey) return
    const saved = readStoredHeight(storageKey)
    if (saved !== null) setSheetHeight(Math.min(saved, window.innerHeight * MAX_RATIO))
  }, [storageKey])

  useEffect(() => {
    if (!contentRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setContentNaturalHeight(entry.contentRect.height)
    })
    ro.observe(contentRef.current)
    return () => ro.disconnect()
  }, [children])

  const resizeTo = useCallback((height: number) => {
    setSheetHeight(height)
    storeHeight(storageKey, height)
  }, [storageKey])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY
    dragStartHeight.current = heightRef.current
    dragMoved.current = false
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== e.pointerId) return
    const deltaY = dragStartY.current - e.clientY
    if (!dragMoved.current) {
      if (Math.abs(deltaY) < DRAG_THRESHOLD) return
      dragMoved.current = true
      setIsDragging(true)
    }
    setSheetHeight(Math.max(MINIMAL_HEIGHT, Math.min(window.innerHeight * MAX_RATIO, dragStartHeight.current + deltaY)))
  }, [])

  const endDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== e.pointerId) return
    pointerId.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!dragMoved.current) return
    setIsDragging(false)
    storeHeight(storageKey, heightRef.current)
  }, [storageKey])

  const contentHeight = contentNaturalHeight
  const naturalTotal = contentHeight + HANDLE_HEIGHT
  const renderedHeight = isDragging ? sheetHeight : Math.min(sheetHeight, Math.max(MINIMAL_HEIGHT, naturalTotal))
  const expanded = renderedHeight > MINIMAL_HEIGHT + 1
  const progress = Math.min(1, Math.max(0, (sheetHeight - MINIMAL_HEIGHT) / (maxH - MINIMAL_HEIGHT)))

  const handleClick = useCallback(() => {
    // A drag ends in a click too; only a tap (or Enter/Space) toggles.
    if (dragMoved.current) {
      dragMoved.current = false
      return
    }
    resizeTo(expanded ? MINIMAL_HEIGHT : window.innerHeight * MAX_RATIO)
  }, [expanded, resizeTo])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--sz-sheet-h', `${Math.round(renderedHeight)}px`)
    return () => {
      root.style.removeProperty('--sz-sheet-h')
    }
  }, [renderedHeight])

  const hideClass = hideBreakpoint === 'md' ? 'md:!hidden' : hideBreakpoint === 'lg' ? 'lg:!hidden' : 'sm:!hidden'

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 bg-card border-t border-border flex flex-col overflow-hidden',
        hideClass,
        isDragging ? 'transition-none' : 'transition-[height] duration-200 ease-out',
        className
      )}
      style={{ height: renderedHeight }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && expanded) {
          e.stopPropagation()
          resizeTo(MINIMAL_HEIGHT)
        }
      }}
    >
      <button
        type="button"
        aria-label={expanded ? 'تصغير اللوحة' : 'توسيع اللوحة'}
        aria-expanded={expanded}
        className="flex w-full items-center justify-center py-2 shrink-0 touch-none select-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleClick}
      >
        <span
          aria-hidden="true"
          className={cn(
            'w-10 h-1 rounded-full transition-colors',
            isDragging ? 'bg-muted-foreground/50' : 'bg-muted-foreground/30'
          )}
        />
      </button>

      <div
        ref={contentRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col"
      >
        {children}
      </div>

      {progress > 0.85 && (
        <div
          className={cn('fixed inset-0 -z-10 bg-black/40 transition-opacity duration-200', hideClass)}
          style={{ opacity: (progress - 0.85) / 0.15 * 0.5 }}
          onClick={() => resizeTo(MINIMAL_HEIGHT)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
