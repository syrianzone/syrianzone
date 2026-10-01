import { createContext, useContext } from 'react';

/**
 * The slot in `GameShell`'s header, beside the rules button, where a game drops
 * its own header buttons. The game owns the state (scores, options) so it builds
 * the buttons, but they belong in the shared header — a portal lets it render
 * there without lifting all that state up.
 */
export const GameHeaderActions = createContext<HTMLElement | null>(null);

export const useGameHeaderActions = () => useContext(GameHeaderActions);
