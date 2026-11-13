import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { FilterChipGroup } from '@/Components/ui/filter-chip';
import { Input } from '@/Components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/Components/ui/popover';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { cn } from '@/Lib/utils';
import { matchesFilterText, parseFilterDraft, toggleFilterValue, type SmartFilterFacet, type SmartFilterOption, type SmartFilterValue } from '@/Lib/smartFilterSearch';

interface Props {
    facets: readonly SmartFilterFacet[];
    value: SmartFilterValue;
    onChange: (value: SmartFilterValue) => void;
    placeholder?: string;
    ariaLabel?: string;
    className?: string;
    /** Omit the field frame when hosted inside an existing filter panel. */
    embedded?: boolean;
    /** Scroll applied filters horizontally on small screens. */
    mobileFiltersScroll?: boolean;
}

type Suggestion =
    | { kind: 'search'; id: string; label: string }
    | { kind: 'facet'; id: string; label: string; facet: SmartFilterFacet }
    | { kind: 'option'; id: string; label: string; facet: SmartFilterFacet; option: SmartFilterOption };

/** Only the fields this component edits: other filter keys belong to the caller. */
function sameValue(a: SmartFilterValue, b: SmartFilterValue, facets: readonly SmartFilterFacet[]) {
    if (a.search !== b.search || a.sort !== b.sort) return false;
    return facets.every(({ key }) => {
        const left = a.filters[key] ?? [];
        const right = b.filters[key] ?? [];
        return left.length === right.length && left.every((value) => right.includes(value));
    });
}

/**
 * A search field with structured filters as chips. The caller owns the value
 * and decides how filters combine; this component only holds the draft text,
 * focus and the suggestions popup. It edits `search`, `sort` and its own
 * `facets`; a filter key outside `facets` is the caller's own and is carried
 * through every `onChange` untouched.
 *
 * Typing `facet: value` (label or alias) opens that facet's editor; anything
 * else stays free text. Each facet shows as one chip: click a value to remove
 * it, or the × to clear the facet.
 */
export default function SmartFilterSearch({
    facets, value, onChange, placeholder = 'ابحث أو اختر تصفية…',
    ariaLabel = 'البحث والتصفية', className, embedded = false, mobileFiltersScroll = false,
}: Props) {
    const id = useId();
    const listId = `${id}-suggestions`;
    const headingId = `${id}-heading`;
    const hintId = `${id}-hint`;
    const inputRef = useRef<HTMLInputElement>(null);
    const facetInputRefs = useRef(new Map<string, HTMLInputElement>());
    const fieldRef = useRef<HTMLDivElement>(null);
    const lastValue = useRef(value);
    const [draft, setDraft] = useState(value.search);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [filterQuery, setFilterQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [browse, setBrowse] = useState(false);
    const [active, setActive] = useState(-1);
    const [announcement, setAnnouncement] = useState('');
    const parsed = useMemo(() => parseFilterDraft(draft, facets), [draft, facets]);
    const editingFacet = facets.find((facet) => facet.key === editingKey);
    const chosenCount = facets.reduce((n, facet) => n + (value.filters[facet.key]?.length ?? 0), 0);
    const hasChips = facets.some((facet) => facet.key === editingKey || facet.options.some((o) => value.filters[facet.key]?.includes(o.value)));

    // External resets/history replace the local editors. Echoes of our own
    // changes keep the active chip editor intact.
    useEffect(() => {
        if (sameValue(lastValue.current, value, facets)) return;
        lastValue.current = value;
        setDraft(value.search);
        setEditingKey(null);
        setFilterQuery('');
        setOpen(false);
        setActive(-1);
    }, [value, facets]);

    useEffect(() => {
        if (editingKey) facetInputRefs.current.get(editingKey)?.focus();
    }, [editingKey]);

    const rows = useMemo(() => {
        const items: Suggestion[] = [];
        const facet = editingFacet;
        if (facet && !browse) {
            return facet.options.filter((o) => matchesFilterText(o.label, filterQuery))
                .map((option): Suggestion => ({ kind: 'option', id: JSON.stringify([facet.key, option.value]), label: option.label, facet, option }));
        }
        if (draft.trim() && !browse) items.push({ kind: 'search', id: 'search', label: draft.trim() });
        const query = browse ? '' : parsed.query || draft.trim();
        for (const facet of facets) {
            if (!query || [facet.label, ...(facet.aliases ?? [])].some((name) => matchesFilterText(name, query))) {
                items.push({ kind: 'facet', id: `facet-${facet.key}`, label: facet.label, facet });
            }
        }
        if (query) {
            for (const facet of facets) {
                for (const option of facet.options) {
                    if (matchesFilterText(option.label, query)) items.push({ kind: 'option', id: JSON.stringify([facet.key, option.value]), label: option.label, facet, option });
                }
            }
        }
        return items.length === 1 && items[0].kind === 'search' ? [] : items;
    }, [facets, parsed, draft, browse, editingFacet, filterQuery]);
    const activeRow = rows[active];
    const menuOpen = !dismissed && open && rows.length > 0;
    const optionId = (row: Suggestion) => `${listId}-${encodeURIComponent(row.id)}`;
    const heading = !browse && editingFacet ? editingFacet.label : 'البحث والتصفيات';

    useEffect(() => {
        if (!menuOpen || !activeRow) return;
        document.getElementById(`${listId}-${encodeURIComponent(activeRow.id)}`)?.scrollIntoView({ block: 'nearest' });
    }, [menuOpen, activeRow, listId]);

    function emit(next: SmartFilterValue) {
        lastValue.current = next;
        onChange(next);
    }

    function editDraft(next: string) {
        const expression = parseFilterDraft(next, facets);
        setDraft(expression.search);
        setEditingKey(expression.facet?.key ?? null);
        setFilterQuery(expression.facet ? expression.query : '');
        setBrowse(false);
        setOpen(true);
        setActive(0); // Plain text always highlights the explicit text-search row.
        emit({ ...value, search: expression.search });
    }

    function showGroups() {
        inputRef.current?.focus();
        setEditingKey(null);
        setFilterQuery('');
        setBrowse(true);
        setActive(-1);
        setOpen(true);
    }

    function chips() {
        return Array.from(fieldRef.current?.querySelectorAll<HTMLElement>('[data-filter-key]') ?? []);
    }

    function focusSearch() {
        inputRef.current?.focus();
        setEditingKey(null);
        setFilterQuery('');
        setOpen(false);
        setActive(-1);
    }

    function focusChip(key: string) {
        const chip = chips().find((element) => element.dataset.filterKey === key);
        if (!chip || !value.filters[key]?.length) {
            focusSearch();
            return;
        }
        chip.focus();
        chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    // Facets follow DOM order; ArrowLeft moves forward in this RTL field.
    function focusSibling(key: string | null, step: -1 | 1) {
        const elements = chips();
        const index = key === null ? elements.length : elements.findIndex((element) => element.dataset.filterKey === key);
        const next = elements[index + step];
        if (next) focusChip(next.dataset.filterKey!);
        else if (step === 1) focusSearch();
    }

    function openFacet(facet: SmartFilterFacet, activeIndex = -1) {
        facetInputRefs.current.get(facet.key)?.focus();
        setEditingKey(facet.key);
        setFilterQuery('');
        setBrowse(false);
        setOpen(true);
        setActive(activeIndex);
    }

    function leaveEditor() {
        if (editingKey) focusChip(editingKey);
        else focusSearch();
    }

    function choose(row: Suggestion) {
        if (row.kind === 'facet') {
            const leading = browse ? draft.trimEnd() : parsed.leading;
            setDraft(leading);
            setEditingKey(row.facet.key);
            setFilterQuery('');
            emit({ ...value, search: leading });
            setBrowse(false);
            setActive(0);
        } else if (row.kind === 'search') {
            emit({ ...value, search: draft });
        } else {
            const selected = value.filters[row.facet.key]?.includes(row.option.value);
            const search = editingFacet ? draft : matchesFilterText(row.option.label, draft.trim()) ? '' : parsed.leading;
            setDraft(search);
            emit({ ...toggleFilterValue(value, row.facet, row.option.value), search });
            setAnnouncement(`${selected ? 'أُزيلت' : 'أُضيفت'} تصفية ${row.facet.label}: ${row.label}`);
            if (row.facet.selectionMode === 'multiple') {
                // Keep this group open for another pick, retaining all free text.
                setEditingKey(row.facet.key);
                setFilterQuery('');
                setBrowse(false);
                setActive(row.facet.options.findIndex((o) => o.value === row.option.value));
            } else {
                setEditingKey(null);
                setFilterQuery('');
            }
        }
        if (row.kind === 'search' || row.kind === 'option' && row.facet.selectionMode !== 'multiple') {
            inputRef.current?.focus();
            setOpen(false);
        }
    }

    function remove(facet: SmartFilterFacet, option: SmartFilterOption, keyboard = false) {
        if (keyboard) {
            const chip = chips().find((element) => element.dataset.filterKey === facet.key);
            const buttons = Array.from(chip?.querySelectorAll<HTMLButtonElement>('[data-filter-value]') ?? []);
            const index = buttons.findIndex((button) => button.dataset.filterValue === option.value);
            const next = buttons[index + 1] ?? buttons[index - 1];
            if (next) next.focus();
            else focusSibling(facet.key, 1);
        }
        emit(toggleFilterValue(value, facet, option.value));
        setAnnouncement(`أُزيلت تصفية ${facet.label}: ${option.label}`);
        if (keyboard) return;
        setEditingKey(facet.key);
        setFilterQuery('');
        setBrowse(false);
        facetInputRefs.current.get(facet.key)?.focus();
        setOpen(true);
        setActive(-1);
    }

    function clearAll() {
        const own = new Set(facets.map((facet) => facet.key));
        const filters = Object.fromEntries(Object.entries(value.filters).filter(([key]) => !own.has(key)));
        setDraft('');
        setEditingKey(null);
        setFilterQuery('');
        emit({ ...value, search: '', filters });
        setAnnouncement('مُسح البحث والتصفيات');
        inputRef.current?.focus();
        setOpen(false);
    }

    function removeFacet(facet: SmartFilterFacet) {
        focusSibling(facet.key, 1);
        const filters = { ...value.filters };
        delete filters[facet.key];
        emit({ ...value, filters });
        setEditingKey(null);
        setFilterQuery('');
        setAnnouncement(`أُزيلت تصفية ${facet.label} بالكامل`);
        setOpen(false);
    }

    function chipKeyDown(event: KeyboardEvent<HTMLSpanElement>, facet: SmartFilterFacet) {
        if (event.target instanceof HTMLInputElement || event.nativeEvent.isComposing
            || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const target = event.target as HTMLElement;
        const option = facet.options.find((item) => item.value === target.dataset.filterValue);
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            if (option) remove(facet, option, true);
            else removeFacet(facet);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            const step = event.key === 'ArrowLeft' ? 1 : -1;
            if (option) {
                const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-filter-value]'));
                const next = buttons[buttons.indexOf(target as HTMLButtonElement) + step];
                if (next) next.focus();
                else if (step === 1) openFacet(facet);
                else focusChip(facet.key);
            } else focusSibling(facet.key, step);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp'
            || target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openFacet(facet, event.key === 'ArrowUp' ? facet.options.length - 1 : event.key === 'ArrowDown' ? 0 : -1);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (target === event.currentTarget) focusSearch();
            else focusChip(facet.key);
        }
    }

    function keyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.nativeEvent.isComposing) return;
        if (event.key !== 'Tab' && (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) return;
        const input = event.currentTarget;
        const collapsed = input.selectionStart === input.selectionEnd;
        if (collapsed && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            if (!input.value && menuOpen && activeRow?.kind === 'facet' && event.key === 'ArrowLeft') {
                event.preventDefault();
                choose(activeRow);
                return;
            }
            if (event.key === 'ArrowRight' && input.selectionStart === 0) {
                if (editingFacet) {
                    event.preventDefault();
                    const chip = chips().find((element) => element.dataset.filterKey === editingFacet.key);
                    const buttons = chip?.querySelectorAll<HTMLButtonElement>('[data-filter-value]');
                    if (buttons?.length) buttons[buttons.length - 1].focus();
                    else showGroups();
                } else if (hasChips) {
                    event.preventDefault();
                    focusSibling(null, -1);
                }
                return;
            }
            if (editingFacet && event.key === 'ArrowLeft' && input.selectionEnd === input.value.length) {
                event.preventDefault();
                focusSibling(editingFacet.key, 1);
                return;
            }
        }
        if (event.key === 'Backspace' && !input.value && collapsed) {
            if (editingFacet) {
                const chip = chips().find((element) => element.dataset.filterKey === editingFacet.key);
                const buttons = chip?.querySelectorAll<HTMLButtonElement>('[data-filter-value]');
                if (buttons?.length) {
                    event.preventDefault();
                    buttons[buttons.length - 1].focus();
                } else {
                    event.preventDefault();
                    leaveEditor();
                }
            } else if (hasChips) {
                event.preventDefault();
                focusSibling(null, -1);
            }
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive((current) => {
                if (!rows.length) return -1;
                if (!menuOpen || current < 0) return step > 0 ? 0 : rows.length - 1;
                return (current + step + rows.length) % rows.length;
            });
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (menuOpen && activeRow) choose(activeRow);
            else setOpen(false);
        } else if (event.key === 'Escape' && (open || editingFacet)) {
            event.preventDefault();
            event.stopPropagation();
            leaveEditor();
        } else if (event.key === 'Tab') {
            setOpen(false); // Never turn a suggestion into a selection on Tab.
            if (editingFacet && !value.filters[editingFacet.key]?.length) {
                event.preventDefault();
                focusSearch();
            }
        }
    }

    return (
        <div className={className}>
            <Popover open={menuOpen} onOpenChange={setOpen}>
                <PopoverAnchor asChild>
                    <div ref={fieldRef} className={cn(
                        'flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card p-2 shadow-sm transition-colors focus-within:border-foreground/25 sm:gap-2 sm:p-2.5',
                        embedded && 'rounded-none border-0 bg-transparent shadow-none focus-within:ring-0',
                    )}>
                        <Search className="ms-1 hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                        {hasChips && <div role="group" aria-label="التصفيات المطبقة" className={mobileFiltersScroll
                            ? 'flex min-w-0 max-w-full basis-full flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain p-1 scroll-px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:contents'
                            : 'contents'}>
                            {facets.map((facet) => {
                                const options = facet.options.filter((o) => value.filters[facet.key]?.includes(o.value));
                                const editing = editingKey === facet.key;
                                const inputId = `${id}-facet-${encodeURIComponent(facet.key)}`;
                                return options.length > 0 || editing ? (
                                    <FilterChipGroup key={facet.key} label={facet.label} options={options} inputId={inputId}
                                        data-filter-key={facet.key} tabIndex={0} aria-describedby={hintId}
                                        onKeyDown={(event) => chipKeyDown(event, facet)}
                                        onFocus={(event) => {
                                            if (event.target instanceof HTMLInputElement) return;
                                            if (!options.length) { focusSearch(); return; }
                                            setEditingKey(null); setFilterQuery(''); setBrowse(false); setOpen(false); setActive(-1);
                                        }}
                                        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.focus(); }}
                                        className={mobileFiltersScroll ? 'max-sm:max-w-none max-sm:shrink-0 max-sm:whitespace-nowrap max-sm:[&>span]:flex-nowrap' : undefined}
                                        onRemove={(selected) => {
                                            const option = options.find((o) => o.value === selected);
                                            if (option) remove(facet, option);
                                        }}
                                        onClear={() => removeFacet(facet)}>
                                        <Input id={inputId} ref={(node) => {
                                            if (node) facetInputRefs.current.set(facet.key, node);
                                            else facetInputRefs.current.delete(facet.key);
                                        }}
                                            value={editing ? filterQuery : ''} size={editing ? Math.max(1, filterQuery.length + 1) : 1}
                                            onFocus={() => {
                                                if (!editing) { setFilterQuery(''); setActive(-1); }
                                                setEditingKey(facet.key); setBrowse(false); setOpen(true);
                                            }}
                                            onChange={(e) => { setFilterQuery(e.target.value); setActive(0); setOpen(true); }}
                                            onKeyDown={keyDown} autoComplete="off" inputMode="search" enterKeyHint="done"
                                            role="combobox" aria-label={`بحث في ${facet.label}`} aria-describedby={hintId}
                                            aria-expanded={editing && menuOpen} aria-controls={editing && menuOpen ? listId : undefined}
                                            aria-autocomplete="list" aria-activedescendant={editing && menuOpen && activeRow ? optionId(activeRow) : undefined}
                                            className={cn(
                                                'h-8 rounded-none border-0 py-0 text-xs shadow-none focus-visible:ring-0',
                                                editing && filterQuery ? 'w-auto min-w-0 max-w-32 px-0.5'
                                                    : 'absolute end-0 w-px min-w-0 max-w-px p-0 opacity-0',
                                            )} />
                                    </FilterChipGroup>
                                ) : null;
                            })}
                        </div>}
                        <Input ref={inputRef} value={draft} onChange={(e) => editDraft(e.target.value)} onKeyDown={keyDown}
                            onFocus={() => { setEditingKey(null); setFilterQuery(''); setOpen(true); setActive(-1); }}
                            role="combobox" aria-expanded={!editingKey && menuOpen} aria-controls={!editingKey && menuOpen ? listId : undefined}
                            aria-autocomplete="list" aria-activedescendant={!editingKey && menuOpen && activeRow ? optionId(activeRow) : undefined}
                            aria-label={ariaLabel} aria-describedby={hintId} placeholder={placeholder} autoComplete="off"
                            inputMode="search" enterKeyHint="search"
                            className="h-9 min-w-[min(100%,8rem)] flex-1 basis-32 border-0 px-1 shadow-none focus-visible:ring-0" />
                        <div className="ms-auto flex shrink-0 items-center gap-1">
                            {(chosenCount > 0 || draft.length > 0 || editingKey) && (
                                <Button type="button" variant="ghost" size="icon"
                                    className="h-9 w-9 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                                    aria-label="مسح البحث والتصفيات" onClick={clearAll}><X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /></Button>
                            )}
                            <Button type="button" variant="outline"
                                className="h-9 w-9 gap-0 px-0 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0 sm:w-auto sm:gap-1.5 sm:px-2.5"
                                aria-label="التصفيات" title="التصفيات" aria-haspopup="listbox"
                                aria-expanded={menuOpen} aria-controls={menuOpen ? listId : undefined}
                                onClick={() => {
                                    setDismissed(false);
                                    if (menuOpen && browse) setOpen(false);
                                    else showGroups();
                                }}>
                                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only sm:not-sr-only">التصفيات</span>
                                {chosenCount > 0 && <span className="hidden tabular-nums sm:inline" aria-label={`${chosenCount} تصفيات مختارة`}>{chosenCount}</span>}
                            </Button>
                        </div>
                    </div>
                </PopoverAnchor>
                <PopoverContent align="start" side="bottom" collisionPadding={16} sideOffset={8} role="region" aria-label="اقتراحات البحث والتصفية"
                    className="flex max-h-[min(26rem,var(--radix-popover-content-available-height))] w-[min(28rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-background/95 p-1.5 shadow-lg shadow-foreground/5 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                    onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}
                    onEscapeKeyDown={(event) => { event.preventDefault(); leaveEditor(); }}
                    onInteractOutside={(e) => { if (fieldRef.current?.contains(e.target as Node)) e.preventDefault(); }}>
                    <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-2 pb-1.5">
                        {editingFacet && !browse && (
                            <Button type="button" variant="ghost" size="icon"
                                className="h-9 w-9 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                                aria-label="العودة إلى مجموعات التصفيات" title="العودة إلى التصفيات"
                                onClick={showGroups}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
                        )}
                        <span id={headingId} className="min-w-0 flex-1 text-sm font-semibold">{heading}</span>
                        <Button type="button" variant="ghost" size="icon"
                            className="h-9 w-9 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                            aria-label="إغلاق اقتراحات البحث والتصفية" title="إغلاق"
                            onClick={() => { setDismissed(true); focusSearch(); }}>
                            <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                    {/* The scrollbar uses LTR positioning; all list content remains RTL. */}
                    <ScrollArea dir="ltr" type="auto" className="min-h-0"
                        viewportClassName="max-h-[min(21rem,calc(var(--radix-popover-content-available-height)-4.5rem))] overscroll-contain focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-inset"
                        scrollbarClassName="w-1.5 border-0 p-0">
                        <div id={listId} role="listbox" dir="rtl" tabIndex={-1} aria-labelledby={headingId}
                            aria-multiselectable={rows.some((row) => row.kind === 'option' && row.facet.selectionMode === 'multiple') || undefined}
                            className="ps-2 pt-1.5">
                            {rows.map((row, index) => {
                                const secondaryClass = index === active ? 'text-foreground' : 'text-muted-foreground';
                                const chosen = row.kind === 'option' && value.filters[row.facet.key]?.includes(row.option.value);
                                return (
                                    <div key={row.id} id={optionId(row)} role="option" aria-selected={row.kind === 'option' ? !!chosen : index === active}
                                        onMouseDown={(e) => e.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(row)}
                                        className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm', index === active && 'bg-muted/50 text-foreground')}>
                                        {row.kind === 'search' && <Search className={cn('h-4 w-4 shrink-0', secondaryClass)} aria-hidden="true" />}
                                        <span className="min-w-0 flex-1 break-words">
                                            {row.kind === 'search' ? <><span className={secondaryClass}>البحث عن </span>«{row.label}»</>
                                                : row.kind === 'option' ? <><span className={secondaryClass}>{row.facet.label} · </span>{row.label}</> : row.label}
                                        </span>
                                        {row.kind === 'option' && row.option.count !== undefined && <span className={cn('tabular-nums', secondaryClass)}>{row.option.count}</span>}
                                        {row.kind === 'facet' && (value.filters[row.facet.key]?.length ?? 0) > 0 && <span className="tabular-nums text-foreground">{value.filters[row.facet.key].length}</span>}
                                        {chosen && <><Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" /><span className="sr-only">مختار</span></>}
                                        {row.kind === 'facet' && <ChevronLeft className={cn('h-4 w-4 shrink-0', secondaryClass)} aria-hidden="true" />}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
            <p id={hintId} className="sr-only">الأيمن والأيسر للتنقل بين التصفيات وقيمها، وEnter للدخول، وEscape للخروج، وDelete لحذف المحدد. Backspace في حقل فارغ يحدد العنصر السابق. الأعلى والأسفل للتنقل في الاقتراحات وEnter للاختيار.</p>
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
        </div>
    );
}
