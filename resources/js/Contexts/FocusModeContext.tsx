import { createContext, useContext } from 'react';

interface FocusMode {
  /** When on, the navbar, the back link, and the page title are hidden. */
  focus: boolean;
  setFocus: (value: boolean) => void;
}

/**
 * Focus mode is page-level: it has to hide the navbar, which lives in
 * `ConditionalLayout` outside the game. The layout owns the state and provides
 * it here; `GameShell` reads it to hide the title and show the toggle.
 */
const FocusModeContext = createContext<FocusMode>({ focus: false, setFocus: () => {} });

export const FocusModeProvider = FocusModeContext.Provider;

export const useFocusMode = () => useContext(FocusModeContext);
