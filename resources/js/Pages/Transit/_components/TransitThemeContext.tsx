'use client'

import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react'

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

  // useLayoutEffect fires synchronously before browser paint, preventing theme flash
  useLayoutEffect(() => {
    const stored = localStorage.getItem('transit-theme') as TransitTheme
    if (stored === 'damascus-rose' || stored === 'jasmine') {
      setTheme(stored)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('transit-theme', theme)
  }, [theme])

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
