/**
 * The global search modal. Mounted lazily (React.lazy in Layouts/MainLayout),
 * so everything the page shells also need — the search engine, the results
 * renderer, the filter tabs, the shortcut labels — lives in `./GlobalSearch`.
 * Importing any of those from this file would make the modal a static
 * dependency of the eager graph and Rollup would drop the code-split.
 *
 * The Ctrl/Cmd+K shortcut belongs to the shell (Layouts/MainLayout), which also
 * mounts this modal on demand; this file only renders the dialog state.
 */
import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Loader2, Search, Sparkles, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/Components/ui/dialog';
import {
    Command,
    CommandList,
} from '@/Components/ui/command';
import { useAppShell } from '@/Lib/appShell';
import { pathnameOf } from '@/Lib/routes';
import { FILTER_TABS, IS_MAC, SearchResultsContent, useGlobalSearchData } from './GlobalSearch';
import type { FilterScope } from './GlobalSearch';

export default function GlobalCommandPalette() {
    const { url } = usePage();
    const pathname = pathnameOf(url);
    const open = useAppShell((s) => s.searchOpen);
    const setOpen = useAppShell((s) => s.setSearchOpen);

    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<FilterScope>('all');
    const inputRef = useRef<HTMLInputElement | null>(null);

    const data = useGlobalSearchData(query, scope, open);

    // Reset state when closed
    useEffect(() => {
        if (!open) {
            setQuery('');
            setScope('all');
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                dir="rtl"
                style={{ fontFamily: 'var(--site-font, inherit)' }}
                className="top-[6%] sm:top-[13%] translate-y-0 w-[calc(100vw-1.25rem)] max-w-2xl rounded-2xl border-border/80 bg-card p-0 shadow-2xl overflow-hidden gap-0 [&>button:last-child]:hidden"
            >
                <DialogTitle className="sr-only">بحث شامل في المساحة السورية</DialogTitle>
                <DialogDescription className="sr-only">
                    ابحث في أقسام المنصة، خطوط ومدن ترانزيت، سور القرآن الكريم، الألعاب، المعابر الحدودية، ودليل الهاتف
                </DialogDescription>

                <Command
                    shouldFilter={false}
                    className="bg-transparent text-foreground"
                >
                    {/* Top Search Input Row */}
                    <div className="flex items-center gap-2.5 border-b border-border/80 px-3.5 py-3 bg-muted/25">
                        <Search className="h-5 w-5 text-primary shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ابحث عن أداة، مدينة، خط سرفيس، سورة، معبر، أو رقم طوارئ..."
                            aria-label="ابحث في المنصة"
                            autoFocus
                            className="flex-1 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                        {data.loadingRemote && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                        )}
                        {query && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery('');
                                    inputRef.current?.focus();
                                }}
                                aria-label="مسح البحث"
                                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="إغلاق نافذة البحث"
                            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                        >
                            Esc
                        </button>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 bg-background/60 px-3 py-2 no-scrollbar">
                        {FILTER_TABS.map((tab) => {
                            const active = scope === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setScope(tab.id)}
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                                        active
                                            ? 'bg-primary text-primary-foreground shadow-2xs'
                                            : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Results List */}
                    <CommandList className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto p-2">
                        <SearchResultsContent
                            data={data}
                            pathname={pathname}
                            onClose={() => setOpen(false)}
                        />
                    </CommandList>

                    {/* Footer Bar */}
                    <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <span className="hidden sm:inline-flex items-center gap-1">
                                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
                                <span>للتنقل</span>
                            </span>
                            <span className="hidden sm:inline-flex items-center gap-1">
                                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
                                <span>للفتح</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-primary" />
                                <span>بحث فوري في الأدوات، المدن، السور، والمعابر</span>
                            </span>
                        </div>
                        <span dir="ltr" className="font-mono text-[10px] opacity-75">
                            {IS_MAC ? '⌘ + K' : 'Ctrl + K'}
                        </span>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
