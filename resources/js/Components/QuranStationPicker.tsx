// Searchable reciter picker, shared by the Muslim corner's radio applet and the
// Board widget. Lifted from the Board combobox so both surfaces filter, order
// and select identically.

import React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import type { QuranRadioStation } from '@/Lib/quranRadio';

interface Props {
  stations: QuranRadioStation[];
  value: QuranRadioStation | null;
  onSelect: (id: number) => void;
  /** `bottom` drops the panel downwards, `top` opens it upwards (mobile). */
  drop?: 'top' | 'bottom';
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  emptyLabel?: string;
  isLoading?: boolean;
}

export function QuranStationPicker({
  stations,
  value,
  onSelect,
  drop = 'bottom',
  className,
  triggerClassName,
  placeholder = 'ابحث عن قارئ…',
  emptyLabel = 'لا يوجد قارئ مطابق',
  isLoading = false,
}: Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const needle = query.trim();
  const filtered = needle
    ? stations.filter((s) => s.name.includes(needle) || s.name.toLowerCase().includes(needle.toLowerCase()))
    : stations;

  return (
    <div className={`relative ${className ?? ''}`} ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full justify-between font-normal text-foreground ${triggerClassName ?? 'h-10 text-sm px-3'}`}
      >
        <span className="truncate">{isLoading && !value ? 'جارٍ التحميل…' : (value?.name ?? 'اختر قارئاً')}</span>
        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="إذاعات القرآن"
          className={`absolute start-0 z-50 w-full min-w-[240px] rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-md animate-in fade-in zoom-in-95 ${
            drop === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1'
          }`}
        >
          <div className="relative mb-1.5">
            <Search className="absolute start-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-8 text-sm ps-7 pe-2 bg-background"
            />
          </div>

          <div className="sz-scroll max-h-64 overflow-y-auto space-y-0.5 pe-1">
            {filtered.map((s) => {
              const isSelected = s.id === value?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(s.id);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center justify-between rounded-sm px-2 py-2 text-start text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }`}
                >
                  <span className="truncate">{s.name}</span>
                  {isSelected && <Check className="ms-1 h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}

            {filtered.length === 0 && (
              <p className="py-3 text-center text-sm text-muted-foreground">{emptyLabel}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuranStationPicker;
