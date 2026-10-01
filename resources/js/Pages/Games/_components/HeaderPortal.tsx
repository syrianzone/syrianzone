import React from 'react';
import { createPortal } from 'react-dom';
import { useGameHeaderActions } from './gameHeaderActions';

/**
 * Renders its children into `GameShell`'s header slot, beside "القوانين". A game
 * keeps its own state and buttons but lets them sit in the shared header.
 * Renders nothing until the slot has mounted (and during SSR).
 */
export default function HeaderPortal({ children }: { children: React.ReactNode }) {
  const target = useGameHeaderActions();
  if (!target) return null;
  return createPortal(children, target);
}
