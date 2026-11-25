import React from 'react';
import { Image as ImageIcon, Landmark, Quote, TrendingUp } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { CLAIM_KIND_META } from '@/Domain/fakenewstest/claims';
import type { ClaimKind } from '@/Domain/fakenewstest/types';
import { cn } from '@/Lib/utils';

const KIND_ICONS: Record<ClaimKind, React.ComponentType<{ className?: string }>> = {
  decisions: Landmark,
  economy: TrendingUp,
  quotes: Quote,
  media: ImageIcon,
};

interface KindBadgeProps {
  kind: ClaimKind;
  className?: string;
}

export default function KindBadge({ kind, className }: KindBadgeProps) {
  const Icon = KIND_ICONS[kind];
  const meta = CLAIM_KIND_META[kind];

  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1.5 px-2.5 py-1 text-xs font-semibold text-foreground/90',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </Badge>
  );
}
