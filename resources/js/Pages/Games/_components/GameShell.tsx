import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import { BookOpen, ChevronLeft, Maximize2, Minimize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/Components/ui/dialog';
import { GameHeaderActions } from './gameHeaderActions';
import HeaderButton from './HeaderButton';
import { useFocusMode } from '@/Contexts/FocusModeContext';

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
  /**
   * Fill the viewport instead of scrolling: the page becomes a fixed-height
   * column and the child gets the leftover space. Games whose table must not
   * scroll (the card tables) set this.
   */
  fit?: boolean;
  children: React.ReactNode;
}

// Chrome shared by every /games/<slug> page: a back link to the hub, the game
// title, a rules button, the focus toggle, whatever buttons the game portals in,
// and the game itself. Keeping this out of each game means a new subgame gets
// consistent navigation for free.
export default function GameShell({
  title,
  description,
  icon: Icon,
  width = 'max-w-3xl',
  rules,
  fit,
  children,
}: Props) {
  // Filled once the header slot mounts; a game portals its own buttons into it.
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  const { focus, setFocus } = useFocusMode();

  // The navbar is non-sticky on games and hidden in focus mode, so the viewport
  // is 4rem taller then. The class strings are literal so Tailwind keeps them.
  const fillHeight = focus ? 'h-[100svh]' : 'h-[calc(100svh-4rem-1px)]';
  const minHeight = focus ? 'min-h-[100svh]' : 'min-h-[calc(100svh-4rem-1px)]';

  return (
    <div
      className={`${fit ? `flex ${fillHeight} flex-col overflow-hidden` : minHeight} bg-background text-foreground`}
      dir="rtl"
    >
      <GameHeaderActions.Provider value={actions}>
        <div
          className={`container mx-auto ${width} px-4 ${
            fit ? 'flex min-h-0 flex-1 flex-col py-3' : 'py-6'
          }`}
        >
          {!focus && (
            <Link
              href="/games"
              className="mb-2 inline-flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground no-underline transition-colors hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
              كل الألعاب
            </Link>
          )}

          <div className={`${fit ? 'mb-2' : 'mb-5'} flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2`}>
            {!focus && (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-card/60">
                  <Icon className="h-7 w-7" />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold">{title}</h1>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </>
            )}

            {/* Rules, the focus toggle, and whatever buttons the game portals in,
                sharing one row (its own line on phones, where they will not fit).
                With the title gone in focus mode, `ms-auto` keeps the buttons in
                the same place. */}
            <div
              className={`flex items-center gap-2 ${
                focus ? 'ms-auto' : 'w-full justify-end sm:w-auto'
              }`}
            >
              <div ref={setActions} className="flex flex-wrap items-center gap-2" />
              {rules && (
                <Dialog>
                  <DialogTrigger asChild>
                    <HeaderButton icon={BookOpen}>القوانين</HeaderButton>
                  </DialogTrigger>
                  <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader className="text-start sm:text-start">
                      <DialogTitle>قوانين {title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm leading-relaxed text-foreground">{rules}</div>
                  </DialogContent>
                </Dialog>
              )}
              <HeaderButton
                icon={focus ? Minimize2 : Maximize2}
                active={focus}
                onClick={() => setFocus(!focus)}
                title={focus ? 'إنهاء وضع التركيز' : 'وضع التركيز: إخفاء الشريط والعنوان'}
              >
                {focus ? 'إنهاء التركيز' : 'تركيز'}
              </HeaderButton>
            </div>
          </div>

          {fit ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
        </div>
      </GameHeaderActions.Provider>
    </div>
  );
}
