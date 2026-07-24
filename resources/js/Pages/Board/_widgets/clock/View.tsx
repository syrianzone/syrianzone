import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import type { WidgetProps } from '../../_lib/types';
import type { ClockConfig } from './index';

// No query: the clock is pure local state and its config rides in the layout
// document, so it syncs to the server for free.
export default function ClockView({ config }: WidgetProps<ClockConfig>) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const time = now.toLocaleTimeString('ar-SY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: config.format === '12',
  });

  const date = now.toLocaleDateString('ar-SY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <WidgetShell title="الساعة" icon={Clock}>
      <div className="flex h-full flex-col items-center justify-center gap-1 p-3">
        <p dir="ltr" className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {time}
        </p>
        {config.showDate && <p className="text-xs text-muted-foreground">{date}</p>}
      </div>
    </WidgetShell>
  );
}
