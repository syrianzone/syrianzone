import { createContext, useContext, type ReactNode } from 'react';

export type AppearanceMode = 'light' | 'dark';

const light = {
  background: '#F2F3F5',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  text: '#17211D',
  secondary: '#626B66',
  separator: '#DDE2DF',
  accent: '#147A51',
  accentMuted: '#DDEFE5',
  onAccent: '#FFFFFF',
  danger: '#B53232',
  success: '#147A51'
};

const dark: typeof light = {
  background: '#101512',
  surface: '#1B231E',
  elevated: '#25302A',
  text: '#F2F6F3',
  secondary: '#A5B3AA',
  separator: '#354139',
  accent: '#85D6AA',
  accentMuted: '#233E2E',
  onAccent: '#102C1D',
  danger: '#FFAAA4',
  success: '#85D6AA'
};

export const themeColors = { light, dark };

const ThemeContext = createContext({ mode: 'light' as AppearanceMode, colors: light });

export function ThemeProvider({ mode, children }: { mode: AppearanceMode; children: ReactNode }): React.JSX.Element {
  return <ThemeContext.Provider value={{ mode, colors: themeColors[mode] }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): { mode: AppearanceMode; colors: typeof light } {
  return useContext(ThemeContext);
}
