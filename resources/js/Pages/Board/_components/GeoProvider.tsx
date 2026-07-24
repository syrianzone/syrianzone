import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { readGeo, writeGeo } from '../_lib/storage';

export type GeoStatus = 'idle' | 'pending' | 'granted' | 'denied';

interface GeoValue {
  coords: { lat: number; lng: number } | null;
  status: GeoStatus;
  request: () => void;
}

const GeoContext = createContext<GeoValue>({ coords: null, status: 'idle', request: () => undefined });

// One fix for the whole board: several location widgets must not produce
// several browser prompts. The fix is cached so a reload does not re-prompt.
export function GeoProvider({ children }: { children: ReactNode }) {
  const cached = readGeo();
  const [coords, setCoords] = useState(cached);
  const [status, setStatus] = useState<GeoStatus>(cached ? 'granted' : 'idle');
  const inFlight = useRef(false);

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
