import { createContext, useContext, type ReactNode } from 'react';

// BoardTile owns the edit controls but WidgetShell owns the header they belong
// in, and the widget View sits between them. Passing the controls through
// context keeps widgets ignorant of edit mode entirely.
const TileChromeContext = createContext<ReactNode>(null);

export function TileChromeProvider(props: { actions: ReactNode; children: ReactNode }) {
  return <TileChromeContext.Provider value={props.actions}>{props.children}</TileChromeContext.Provider>;
}

export function useTileActions(): ReactNode {
  return useContext(TileChromeContext);
}
