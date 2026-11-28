import { Search } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { useAppShell } from '@/Lib/appShell';
import { useIsMac } from '@/Lib/platform';

/**
 * The navbar's desktop "quick search" button: it only asks the shell to open
 * the Ctrl/Cmd+K palette. It lives apart from `./GlobalSearch` so the navbar,
 * which every page renders, does not pull the search engine and results
 * renderer into the layout chunk.
 */
export function DesktopSearchTrigger({ className = '' }: { className?: string }) {
    const setSearchOpen = useAppShell((s) => s.setSearchOpen);
    const shortcutLabel = useIsMac() ? '⌘ K' : 'Ctrl K';
    return (
        <Button
            type="button"
            variant="outline"
            onClick={() => setSearchOpen(true)}
            aria-label={`بحث سريع في المنصة (${shortcutLabel})`}
            className={`hidden lg:inline-flex h-9 items-center justify-between gap-3 rounded-lg border-input bg-card/70 px-3 text-xs font-medium text-muted-foreground shadow-none hover:bg-accent/60 hover:text-foreground transition-colors ${className}`}
        >
            <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>بحث سريع...</span>
            </span>
            <kbd
                dir="ltr"
                className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
            >
                {shortcutLabel}
            </kbd>
        </Button>
    );
}
