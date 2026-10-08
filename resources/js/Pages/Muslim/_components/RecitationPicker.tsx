import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Mic } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { QURAN_RECITATIONS, recitationByCode, styleLabelAr } from '../_lib/quran';

interface Props {
  /** v4 recitation code (reciter/rN). */
  value: string;
  onChange: (code: string) => void;
}

// Searchable recitation picker (shadcn-styled Button + Input dropdown).
// Opens upward: the player sits at the viewport bottom.
export default function RecitationPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const current = recitationByCode(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QURAN_RECITATIONS;
    return QURAN_RECITATIONS.filter(
      (r) => r.nameAr.includes(query.trim()) || r.nameEn.toLowerCase().includes(q),
    );
  }, [query]);

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
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-full min-w-[210px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
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
                key={r.code}
                role="option"
                aria-selected={r.code === current.code}
                onClick={() => {
                  onChange(r.code);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-start text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="min-w-0 truncate">{r.nameAr}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {styleLabelAr(r.style)}
                </span>
                {r.code === current.code && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
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
