import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Mic } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { QURAN_RECITERS } from '../_lib/quran';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

// Searchable reciter picker (shadcn-styled Button + Input dropdown).
// Opens upward: the player sits at the viewport bottom.
export default function ReciterPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const current = QURAN_RECITERS.find((r) => r.id === value) ?? QURAN_RECITERS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open ]);

  const q = query.trim().toLowerCase();
  const items = q
    ? QURAN_RECITERS.filter((r) => r.nameAr.includes(query.trim()) || r.nameEn.toLowerCase().includes(q))
    : QURAN_RECITERS;

  return (
    <div ref={wrapRef} className="relative">
      {/* Mobile: icon only (full dropdown overflows narrow screens). */}
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-full sm:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={`القارئ: ${current.nameAr}`}
      >
        <Mic className="h-4 w-4" />
      </Button>
      {/* Desktop: full-width dropdown trigger. */}
      <Button
        variant="outline"
        size="sm"
        className="hidden h-9 w-[170px] justify-between gap-1 px-2 text-xs sm:flex"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="اختيار القارئ"
      >
        <span className="truncate">{current.nameAr}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-full min-w-[190px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن قارئ…"
            className="mb-1 h-8 text-xs"
          />
          <div role="listbox" className="max-h-48 overflow-y-auto">
            {items.map((r) => (
              <button
                key={r.id}
                role="option"
                aria-selected={r.id === value}
                onClick={() => {
                  onChange(r.id);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-start text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="truncate">{r.nameAr}</span>
                {r.id === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            ))}
            {items.length === 0 && (
              <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">لا نتائج مطابقة</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
