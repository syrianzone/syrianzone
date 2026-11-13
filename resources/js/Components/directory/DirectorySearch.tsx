import { Search, X } from 'lucide-react';
import SmartFilterSearch from '@/Components/SmartFilterSearch';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { cn } from '@/Lib/utils';
import type { SmartFilterFacet, SmartFilterValue } from '@/Lib/smartFilterSearch';

interface SearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** Names the input; the surrounding `<search>` landmark takes it too. */
    ariaLabel: string;
    /** `lg` is the hero-sized field of the two official directories. */
    size?: 'default' | 'lg';
    className?: string;
}

/**
 * The plain directory search field: one input with a clear button, inside the
 * `<search>` landmark. Colour and spacing come from the caller when a page's
 * hero differs; behaviour never does.
 */
export function DirectorySearch({
    value, onChange, placeholder, ariaLabel, size = 'default', className,
}: SearchProps) {
    const large = size === 'lg';

    return (
        <search role="search" aria-label={ariaLabel} className={cn('block w-full', className)}>
            <div className="relative w-full">
                <Search
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground',
                        large ? 'h-5 w-5' : 'start-3 h-4 w-4',
                    )}
                />
                <Input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    aria-label={ariaLabel}
                    className={cn(
                        'w-full border-border bg-card shadow-sm',
                        large ? 'h-14 rounded-xl pe-10 ps-12 text-lg' : 'pe-10 ps-10',
                    )}
                />
                {value && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="مسح البحث"
                        title="مسح البحث"
                        onClick={() => onChange('')}
                        className={cn(
                            'absolute end-3 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground',
                            !large && 'end-2 h-9 w-9',
                        )}
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                )}
            </div>
        </search>
    );
}

interface SmartSearchProps {
    facets: readonly SmartFilterFacet[];
    value: SmartFilterValue;
    onChange: (value: SmartFilterValue) => void;
    placeholder: string;
    ariaLabel: string;
    className?: string;
}

/**
 * The richer search: free text plus structured facet chips inside one field,
 * for pages whose filters are many or carry aliases. Same landmark, same state
 * shape as `useDirectory`.
 */
export function DirectorySmartSearch({
    facets, value, onChange, placeholder, ariaLabel, className,
}: SmartSearchProps) {
    return (
        <search role="search" aria-label={ariaLabel} className={cn('block', className)}>
            <SmartFilterSearch
                mobileFiltersScroll
                facets={facets}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                ariaLabel={ariaLabel}
            />
        </search>
    );
}
