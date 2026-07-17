import { useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Card } from '@/Components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import { CATEGORIES, CATEGORY_LABELS } from '../_lib/categories';
import type { GeoSuggestion, LatLng, PlaceCategory, PlaceListItem } from '../_lib/types';

// token: optional hemisphere letter, signed number (dot or comma decimal), optional °, optional letter
const COORD_TOKEN = String.raw`([NSEW])?\s*([+-]?\d{1,3}(?:[.,]\d+)?)\s*°?\s*([NSEW])?`;
// separator: comma/semicolon, whitespace, or both; greedy number matching keeps decimal commas
// inside the token, and the comma-decimal gate below vets the ambiguous cases
const COORD_RE = new RegExp(String.raw`^\s*${COORD_TOKEN}\s*(?:[,;]\s*|\s+)${COORD_TOKEN}\s*$`, 'i');

// accepts: "34.7394153, 36.6750744" | "34,73192° N, 36,70764° E" | "36,70764° E, 34,73192° N"
// | "34.7 S, 36.6 W" | "34 36"
// rejects: "34,73192, 36,70764" (comma decimals, no marker) | "91, 30" | "34, 190"
// | "34.7 N, 36.6 N" | "دمشق" | "-34.7 S, 36.6 W"
export function parseLatLng(q: string): LatLng | null {
  const m = COORD_RE.exec(q);
  if (!m) return null;
  const [, pre1, num1, suf1, pre2, num2, suf2] = m as (string | undefined)[];
  if (num1 === undefined || num2 === undefined) return null;

  // comma decimals are only trusted when the input carries a ° or hemisphere marker
  const hasCommaDecimal = /\d,\d/.test(num1) || /\d,\d/.test(num2);
  const hasMarker = m[0].includes('°') || Boolean(pre1 || suf1 || pre2 || suf2);
  if (hasCommaDecimal && !hasMarker) return null;

  const token = (pre: string | undefined, suf: string | undefined, raw: string) => {
    if (pre && suf) return null;
    const letter = (pre ?? suf)?.toUpperCase() ?? null;
    if (letter && /[+-]/.test(raw)) return null;
    let value = Number(raw.replace(',', '.'));
    if (letter === 'S' || letter === 'W') value = -value;
    return { value, letter };
  };
  const t1 = token(pre1, suf1, num1);
  const t2 = token(pre2, suf2, num2);
  if (!t1 || !t2) return null;

  const axis = (l: string | null) => (l === 'N' || l === 'S' ? 'lat' : l === 'E' || l === 'W' ? 'lng' : null);
  const a1 = axis(t1.letter);
  const a2 = axis(t2.letter);
  if (a1 && a2 && a1 === a2) return null;

  let lat: number;
  let lng: number;
  if (a1 === 'lng' || a2 === 'lat') {
    lat = t2.value;
    lng = t1.value;
  } else {
    lat = t1.value;
    lng = t2.value;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function FilterBar(props: {
  category: PlaceCategory | null;
  onCategoryChange: (c: PlaceCategory | null) => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: PlaceListItem[];
  geoResults: GeoSuggestion[];
  resultsLoading: boolean;
  coordCandidate: LatLng | null;
  onSelectResult: (place: PlaceListItem) => void;
  onSelectGeo: (suggestion: GeoSuggestion) => void;
  onGoToCoord: (point: LatLng) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasQuery = props.query.trim() !== '';
  const showDropdown = open && hasQuery;
  const optionCount = props.coordCandidate ? 1 : props.results.length + props.geoResults.length;

  function close() {
    setOpen(false);
    setActiveIndex(0);
  }

  function activate(index: number) {
    if (props.coordCandidate) {
      props.onGoToCoord(props.coordCandidate);
      close();
      return;
    }
    if (index < props.results.length) {
      const place = props.results[index];
      if (!place) return;
      props.onSelectResult(place);
      close();
      return;
    }
    const suggestion = props.geoResults[index - props.results.length];
    if (!suggestion) return;
    props.onSelectGeo(suggestion);
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      // consumed here: don't let the page's Escape listener also cancel add-mode
      if (showDropdown) e.stopPropagation();
      close();
      inputRef.current?.blur();
      return;
    }
    if (!showDropdown || optionCount === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(activeIndex);
    }
  }

  return (
    <Card dir="rtl" className={cn('p-2 space-y-2 shadow-md', props.className)}>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="place-search-listbox"
          aria-activedescendant={showDropdown && optionCount > 0 ? `place-search-option-${activeIndex}` : undefined}
          value={props.query}
          onChange={(e) => {
            props.onQueryChange(e.target.value);
            setOpen(e.target.value.trim() !== '');
            setActiveIndex(0);
          }}
          onFocus={() => { if (hasQuery) setOpen(true); }}
          onBlur={close}
          onKeyDown={handleKeyDown}
          placeholder="ابحث عن مكان أو إحداثيات"
          className="pr-9"
        />
        {showDropdown && (
          <Card
            id="place-search-listbox"
            role="listbox"
            // preventDefault keeps the input focused so onBlur does not close before row clicks land
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full mt-1 z-20 max-h-72 overflow-y-auto p-1 shadow-md"
          >
            {props.coordCandidate ? (
              <button
                type="button"
                id="place-search-option-0"
                role="option"
                aria-selected={activeIndex === 0}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-right',
                  activeIndex === 0 && 'bg-accent',
                )}
                onClick={() => activate(0)}
                onMouseEnter={() => setActiveIndex(0)}
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>الانتقال إلى النقطة</span>
                <span dir="ltr" className="mr-auto text-xs text-muted-foreground">
                  {props.coordCandidate.lat}, {props.coordCandidate.lng}
                </span>
              </button>
            ) : props.resultsLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : props.results.length === 0 && props.geoResults.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">لا توجد نتائج</p>
            ) : (
              props.results.map((place, i) => (
                <button
                  key={place.id}
                  type="button"
                  id={`place-search-option-${i}`}
                  role="option"
                  aria-selected={activeIndex === i}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-right',
                    activeIndex === i && 'bg-accent',
                  )}
                  onClick={() => activate(i)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="truncate">{place.name}</span>
                  <Badge variant="outline" className="shrink-0">{CATEGORY_LABELS[place.category]}</Badge>
                </button>
              ))
            )}
            {!props.coordCandidate && !props.resultsLoading && props.geoResults.map((suggestion, gi) => {
              const i = props.results.length + gi;
              return (
                <button
                  key={`geo-${gi}`}
                  type="button"
                  id={`place-search-option-${i}`}
                  role="option"
                  aria-selected={activeIndex === i}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-right',
                    activeIndex === i && 'bg-accent',
                  )}
                  onClick={() => activate(i)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{suggestion.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{suggestion.address}</span>
                  </span>
                </button>
              );
            })}
            {!props.coordCandidate && props.geoResults.length > 0 && (
              // required attribution for Places data shown off a Google map
              <p className="px-2 py-1 text-left text-[10px] text-muted-foreground" dir="ltr">powered by Google</p>
            )}
          </Card>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Badge
          variant={props.category === null ? 'default' : 'outline'}
          className="cursor-pointer shrink-0"
          onClick={() => props.onCategoryChange(null)}
        >
          الكل
        </Badge>
        {CATEGORIES.map((c) => (
          <Badge
            key={c.key}
            variant={props.category === c.key ? 'default' : 'outline'}
            className="cursor-pointer shrink-0"
            onClick={() => props.onCategoryChange(props.category === c.key ? null : c.key)}
          >
            {c.label}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
