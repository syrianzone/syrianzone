'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

const MINIMAL_HEIGHT = 250
const MAX_RATIO = 0.92

interface BottomSheetProps {
  children: React.ReactNode
  className?: string
  storageKey?: string
  initialHeight?: number
  onHeightChange?: (height: number) => void
}

function getInitialHeight(storageKey?: string, initial?: number) {
  if (typeof window === 'undefined') return initial ?? MINIMAL_HEIGHT
  if (storageKey) {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const h = Number(saved)
      if (!isNaN(h) && h >= MINIMAL_HEIGHT) return Math.min(h, window.innerHeight * MAX_RATIO)
    }
  }
  return initial ?? MINIMAL_HEIGHT
}

export function BottomSheet({ children, className, storageKey, initialHeight, onHeightChange }: BottomSheetProps) {
  const [sheetHeight, setSheetHeight] = useState(() => getInitialHeight(storageKey, initialHeight))
  const [isDragging, setIsDragging] = useState(false)

  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const isDraggingRef = useRef(false)

  const updateHeight = useCallback((h: number) => {
    setSheetHeight(h)
    onHeightChange?.(h)
  }, [onHeightChange])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    dragStartHeight.current = sheetHeight
    isDraggingRef.current = true
    setIsDragging(true)
  }, [sheetHeight])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return
    const deltaY = dragStartY.current - e.touches[0].clientY
    const maxH = window.innerHeight * MAX_RATIO
    const newHeight = Math.max(MINIMAL_HEIGHT, Math.min(maxH, dragStartHeight.current + deltaY))
    updateHeight(newHeight)
  }, [updateHeight])

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false
    setIsDragging(false)
    if (storageKey) localStorage.setItem(storageKey, String(sheetHeight))
  }, [sheetHeight, storageKey])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        updateHeight(MINIMAL_HEIGHT)
        if (storageKey) localStorage.setItem(storageKey, String(MINIMAL_HEIGHT))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [storageKey, updateHeight])

  const maxH = typeof window !== 'undefined' ? window.innerHeight * MAX_RATIO : 800
  const progress = Math.min(1, Math.max(0, (sheetHeight - MINIMAL_HEIGHT) / (maxH - MINIMAL_HEIGHT)))

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 bg-card border-t border-border',
        'sm:hidden',
        isDragging ? 'transition-none' : 'transition-[height] duration-200 ease-out',
        className
      )}
      style={{ height: sheetHeight }}
    >
      <div
        className="flex items-center justify-center py-2 touch-none select-none cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={cn(
            'w-10 h-1 rounded-full transition-colors',
            isDragging ? 'bg-muted-foreground/50' : 'bg-muted-foreground/30'
          )}
        />
      </div>

      <div
        className="overflow-y-auto overscroll-contain"
        style={{ height: Math.max(0, sheetHeight - MINIMAL_HEIGHT) }}
      >
        {children}
      </div>

      {progress > 0.85 && (
        <div
          className="fixed inset-0 -z-10 bg-black/40 sm:hidden transition-opacity duration-200"
          style={{ opacity: (progress - 0.85) / 0.15 * 0.5 }}
          onClick={() => {
            updateHeight(MINIMAL_HEIGHT)
            if (storageKey) localStorage.setItem(storageKey, String(MINIMAL_HEIGHT))
          }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export const BOTTOM_SHEET_MINIMAL = 250
