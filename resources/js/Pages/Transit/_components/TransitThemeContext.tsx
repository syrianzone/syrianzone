'use client'

import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { THEME_REGISTRY, getThemePreference, resolveTheme } from '@/Lib/theme'

type TransitTheme = 'jasmine' | 'damascus-rose'

interface TransitThemeContextType {
  theme: TransitTheme
  toggleTheme: () => void
}

const TransitThemeContext = createContext<TransitThemeContextType>({
  theme: 'jasmine',
  toggleTheme: () => {},
})

export function useTransitTheme() {
  return useContext(TransitThemeContext)
}

export function TransitThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<TransitTheme>('jasmine')

  const syncWithGlobalTheme = useCallback(() => {
    const activePref = getThemePreference()
    const resolved = resolveTheme(activePref)

    if (resolved === 'jasmine') {
      setTheme('jasmine')
    } else if (resolved === 'damascus-rose') {
      setTheme('damascus-rose')
    } else {
      const themeConfig = THEME_REGISTRY.find(t => t.id === resolved)
      const isDark = themeConfig ? themeConfig.isDark : false
      setTheme(isDark ? 'damascus-rose' : 'jasmine')
    }
  }, [])

  // Sync initially before render
  useLayoutEffect(() => {
    syncWithGlobalTheme()
  }, [syncWithGlobalTheme])

  // Set up observer to sync when html data-theme attribute changes
  useEffect(() => {
    syncWithGlobalTheme()

    const observer = new MutationObserver(syncWithGlobalTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => observer.disconnect()
  }, [syncWithGlobalTheme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'jasmine' ? 'damascus-rose' : 'jasmine'))
  }, [])

  return (
    <TransitThemeContext.Provider value={{ theme, toggleTheme }}>
      <div data-transit-theme={theme} className="contents">
        {children}
      </div>
    </TransitThemeContext.Provider>
  )
}
