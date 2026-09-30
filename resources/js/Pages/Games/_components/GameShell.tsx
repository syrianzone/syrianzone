import React from 'react';
import { Link } from '@inertiajs/react';
import { BookOpen, ChevronLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/Components/ui/dialog';

interface Props {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Tailwind max-width for the page column. A single square board is happy in
   * `max-w-3xl`, but Solitaire has to fit seven columns *and* a fan lane beside
   * each one, so it asks for more.
   */
  width?: string;
  /** The game's rules, shown behind a "القوانين" button when supplied. */
  rules?: React.ReactNode;
  children: React.ReactNode;
}

// Chrome shared by every /games/<slug> page: a back link to the hub, the game
// title, an optional rules button, and whatever the game renders. Keeping this
// out of each game means a new subgame gets consistent navigation for free.
export default function GameShell({
  title,
  description,
  icon: Icon,
  width = 'max-w-3xl',
  rules,
  children,
}: Props) {
  return (
    <div className="min-h-svh bg-background text-foreground" dir="rtl">
      <div className={`container mx-auto ${width} px-4 py-6`}>
        <Link
          href="/games"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground no-underline transition-colors hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          كل الألعاب
        </Link>

        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-card/60">
            <Icon className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {rules && (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="ms-auto flex shrink-0 items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <BookOpen className="h-4 w-4" />
                  القوانين
                </button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader className="text-start sm:text-start">
                  <DialogTitle>قوانين {title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm leading-relaxed text-foreground">{rules}</div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
