import { createContext, useContext } from 'react'
import { useColorScheme } from '@/Lib/theme'

type TransitTheme = 'jasmine' | 'damascus-rose'

interface TransitThemeContextType {
  /** The Transit palette matching the applied scheme (jasmine = light, damascus-rose = dark). */
  theme: TransitTheme
}

const TransitThemeContext = createContext<TransitThemeContextType>({
  theme: 'jasmine',
})

export function useTransitTheme() {
  return useContext(TransitThemeContext)
}

export function TransitThemeProvider({ children }: { children: React.ReactNode }) {
  const theme: TransitTheme = useColorScheme() === 'dark' ? 'damascus-rose' : 'jasmine'

  return (
    <TransitThemeContext.Provider value={{ theme }}>
      <div data-transit-theme={theme} className="contents">
        {children}
      </div>
    </TransitThemeContext.Provider>
  )
}
