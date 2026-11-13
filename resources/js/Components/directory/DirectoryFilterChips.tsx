import { FilterChip } from '@/Components/ui/filter-chip';
import { cn } from '@/Lib/utils';
import type { DirectoryFacetOption } from './useDirectory';

interface Props {
    /** Names the chip row for screen readers («التصنيف», «النوع»…). */
    label: string;
    options: readonly DirectoryFacetOption[];
    value: readonly string[];
    onChange: (value: string[]) => void;
    /** «الكل» — the language may differ from the rest of the page. */
    allLabel?: string;
    multiple?: boolean;
    className?: string;
}

const CHIP_CLASS = 'h-8 cursor-pointer rounded-full px-3 text-xs font-semibold sm:text-sm';

/**
 * One facet as a row of chips. A single-select facet replaces the chosen value
 * and clicking it again clears the facet; a multi-select one toggles it.
 */
export default function DirectoryFilterChips({
    label, options, value, onChange, allLabel = 'الكل', multiple = false, className,
}: Props) {
    const toggle = (option: string) => {
        if (!multiple) {
            onChange(value.includes(option) ? [] : [option]);
            return;
        }
        onChange(value.includes(option) ? value.filter((entry) => entry !== option) : [...value, option]);
    };

    return (
        <div role="group" aria-label={label} className={cn('flex flex-wrap justify-center gap-2', className)}>
            <FilterChip
                active={value.length === 0}
                onClick={() => onChange([])}
                className={CHIP_CLASS}
            >
                {allLabel}
            </FilterChip>
            {options.map((option) => (
                <FilterChip
                    key={option.value}
                    active={value.includes(option.value)}
                    onClick={() => toggle(option.value)}
                    className={CHIP_CLASS}
                >
                    {option.label}
                </FilterChip>
            ))}
        </div>
    );
}
