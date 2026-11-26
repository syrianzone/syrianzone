import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readGeo, writeGeo } from '../_lib/storage';

// 'checking': the cached fix has not been read yet (first render, server and
// hydrating client alike), so no tile may prompt for location before it is.
export type GeoStatus = 'checking' | 'idle' | 'pending' | 'granted' | 'denied';

interface GeoValue {
  coords: { lat: number; lng: number } | null;
  status: GeoStatus;
  request: () => void;
}

const GeoContext = createContext<GeoValue>({ coords: null, status: 'idle', request: () => undefined });

// One fix for the whole board: several location widgets must not produce
// several browser prompts. The fix is cached so a reload does not re-prompt.
export function GeoProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<GeoStatus>('checking');
  const inFlight = useRef(false);

  // storage is read after mount, never during render (hydration)
  useEffect(() => {
    const cached = readGeo();
    if (cached) setCoords(cached);
    setStatus((s) => (s === 'checking' ? (cached ? 'granted' : 'idle') : s));
  }, []);

  const request = useCallback(() => {
    if (inFlight.current || !navigator.geolocation) {
      if (!navigator.geolocation) setStatus('denied');
      return;
    }
    inFlight.current = true;
    setStatus('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeGeo(next);
        setCoords(next);
        setStatus('granted');
        inFlight.current = false;
      },
      () => {
        setStatus('denied');
        inFlight.current = false;
      },
      { timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }, []);

  // stable identity: BoardTile keys its request effect on this value
  const value = useMemo(() => ({ coords, status, request }), [coords, status, request]);

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export function useGeo(): GeoValue {
  return useContext(GeoContext);
}
