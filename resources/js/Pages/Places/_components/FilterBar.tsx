import { Search } from 'lucide-react';
import { Card } from '@/Components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import { CATEGORIES } from '../_lib/categories';
import type { PlaceCategory } from '../_lib/types';

export function FilterBar(props: {
  category: PlaceCategory | null;
  onCategoryChange: (c: PlaceCategory | null) => void;
  query: string;
  onQueryChange: (q: string) => void;
  className?: string;
}) {
  return (
    <Card dir="rtl" className={cn('p-2 space-y-2 shadow-md', props.className)}>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder="ابحث عن مكان"
          className="pr-9"
        />
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
