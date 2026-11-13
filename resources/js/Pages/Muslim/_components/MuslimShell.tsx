import React from 'react';
import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind max-width for the page column. */
  width?: string;
  children: React.ReactNode;
}

// Chrome shared by the /muslim/<tool> pages: a back link to the hub, the tool
// title and its icon, then the tool itself. Keeping this out of each tool means
// a new tool gets consistent navigation for free (mirrors GameShell).
export default function MuslimShell({ title, icon: Icon, width = 'max-w-2xl', children }: Props) {
  return (
    <div className="min-h-[calc(100svh-var(--sz-navbar-h))] bg-background text-foreground" dir="rtl">
      <div className={`container mx-auto ${width} px-4 py-6`}>
        <Link
          href="/muslim"
          className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground no-underline transition-colors hover:text-primary"
        >
          <ChevronRight className="h-4 w-4" />
          الركن الإسلامي
        </Link>

        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-card/60">
            <Icon className="h-7 w-7" />
          </span>
          <h1 className="min-w-0 flex-1 text-2xl font-bold">{title}</h1>
        </div>

        {children}
      </div>
    </div>
  );
}
