import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export function useForegroundClock(milliseconds = 1000, enabled = true): Date {
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    function update(): void {
      if (timer) clearInterval(timer);
      timer = null;
      if (!focused || AppState.currentState !== 'active') return;
      setNow(new Date());
      timer = setInterval(() => setNow(new Date()), milliseconds);
    }
    update();
    const listener = AppState.addEventListener('change', update);
    return () => { listener.remove(); if (timer) clearInterval(timer); };
  }, [enabled, focused, milliseconds]);
  return now;
}
