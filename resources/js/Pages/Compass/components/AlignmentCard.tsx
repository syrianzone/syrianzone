import React from 'react';
import { Globe, Sun, MoonStar, Compass, Minus, type LucideIcon } from 'lucide-react';
import type { AlignBloc } from '../data/types';

const BLOCS: { id: AlignBloc; icon: LucideIcon; powers: string }[] = [
  { id: 'west', icon: Globe, powers: 'أمريكا · أوروبا' },
  { id: 'gulf', icon: Sun, powers: 'السعودية · الخليج' },
  { id: 'turkish', icon: MoonStar, powers: 'تركيا · قطر' },
  { id: 'east', icon: Compass, powers: 'إيران · الصين · روسيا' },
  { id: 'neutral', icon: Minus, powers: 'غير منحاز' },
];

export function BlocIcon({ id, className }: { id: AlignBloc; className?: string }) {
  const b = BLOCS.find((x) => x.id === id);
  if (!b) return null;
  const Icon = b.icon;
  return <Icon className={className} style={{ color: `var(--align-${id})` }} />;
}

export default function AlignmentCard({
  align,
  label,
}: {
  align: Record<AlignBloc, number>;
  label: Record<AlignBloc, string>;
}) {
  const values = BLOCS.map((b) => Math.max(0, align[b.id] ?? 0));
  const total = values.reduce((s, x) => s + x, 0);
  const max = Math.max(...values, 1);
  const top = BLOCS[values.indexOf(Math.max(...values))];

  return (
    <div className="space-y-3">
      {total > 0 && (
        <p className="text-sm flex items-center gap-1.5">
          <span>توجّهك الأبرز:</span>
          <BlocIcon id={top.id} className="w-4 h-4" />
          <span className="font-bold text-primary">{label[top.id]}</span>{' '}
          <span className="text-muted-foreground">
            ({Math.round(((align[top.id] ?? 0) / total) * 100)}%)
          </span>
        </p>
      )}
      <div className="space-y-2">
        {BLOCS.map((b) => {
          const v = Math.max(0, align[b.id] ?? 0);
          const Icon = b.icon;
          return (
            <div key={b.id} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs w-28 shrink-0">
                <Icon className="w-3.5 h-3.5" style={{ color: `var(--align-${b.id})` }} />
                {label[b.id]}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(v / max) * 100}%`, background: `var(--align-${b.id})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
