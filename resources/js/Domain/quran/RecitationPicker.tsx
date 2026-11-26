import React, { useRef, useState } from 'react';
import { Check, ChevronsUpDown, Mic } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/Components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/Components/ui/command';
import { QURAN_RECITATIONS, recitationByCode, styleLabelAr } from './quran';

interface Props {
  /** v4 recitation code (reciter/rN). */
  value: string;
  onChange: (code: string) => void;
}

// Searchable recitation picker: the shared Popover + Command combobox, so
// focus, Escape, outside taps and arrow-key navigation behave like every other
// picker. Opens upward: the player sits at the viewport bottom.
export default function RecitationPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Two triggers (icon on mobile, full button on desktop): focus returns to
  // whichever one opened the list.
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const current = recitationByCode(value);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    openerRef.current = e.currentTarget;
    setOpen((o) => !o);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={wrapRef} className="relative">
          {/* Mobile: icon only (full dropdown overflows narrow screens). */}
          <Button aria-label={`القارئ: ${current.nameAr}`}
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full sm:hidden"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="listbox"
            title={`القارئ: ${current.nameAr}`}
          >
            <Mic className="h-4 w-4" />
          </Button>
          {/* Desktop: full-width dropdown trigger. */}
          <Button aria-label={`اختيار القارئ: ${current.nameAr}`}
            variant="outline"
            size="sm"
            className="hidden h-9 w-[170px] justify-between gap-1 px-2 text-xs sm:flex"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="listbox"
            title="اختيار القارئ"
          >
            <span className="truncate">{current.nameAr}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="end"
        dir="rtl"
        className="w-[210px] p-0"
        // The triggers toggle on click; a press on them is not "outside".
        onInteractOutside={(e) => {
          if (wrapRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          openerRef.current?.focus();
        }}
      >
        <Command>
          <CommandInput placeholder="ابحث عن قارئ…" aria-label="ابحث عن قارئ" className="h-9 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty className="px-2 py-3 text-center text-[11px] text-muted-foreground">لا نتائج مطابقة</CommandEmpty>
            {QURAN_RECITATIONS.map((r) => (
              <CommandItem
                key={r.code}
                value={r.code}
                keywords={[r.nameAr, r.nameEn]}
                onSelect={() => {
                  onChange(r.code);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 truncate">{r.nameAr}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {styleLabelAr(r.style)}
                </span>
                {r.code === current.code && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
