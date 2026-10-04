import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Separator } from '@/Components/ui/separator';
import { Trash2, History } from 'lucide-react';
import type { CompassResult as Result } from '../data/types';
import { loadResults, deleteAccountResult } from '../lib/storage';
import { SPECTRA } from '../data/spectra';
import { COMPASS_FLAGS } from '../flags';

const VERSION_LABEL: Record<string, string> = { short: 'قصيرة', standard: 'قياسية', full: 'كاملة' };

/** Local + account history. Each row is individually deletable. */
export default function SavedResults({
  isLoggedIn,
  accountResults,
  onChanged,
  onOpen,
}: {
  isLoggedIn: boolean;
  accountResults: Result[];
  onChanged: () => void;
  onOpen: (r: Result) => void;
}) {
  const [local, setLocal] = useState<Result[]>([]);

  useEffect(() => {
    setLocal(loadResults());
  }, []);

  // merge: prefer account rows (identifiable), else local-only
  const rows: (Result & { source: 'account' | 'local' })[] = [
    ...accountResults.map((r) => ({ ...r, source: 'account' as const })),
    ...local
      .filter((l) => !accountResults.some((a) => a.id && a.id === l.id))
      .map((r) => ({ ...r, source: 'local' as const })),
  ];

  if (rows.length === 0) return null;

  const spectrumName = (id: string | null) => SPECTRA.find((s) => s.id === id)?.name ?? '—';

  const remove = async (row: Result & { source: 'account' | 'local' }) => {
    if (row.source === 'account' && row.id != null) {
      try {
        await deleteAccountResult(row.id);
      } catch {}
      onChanged();
    } else {
      // local-only: rewrite localStorage without this row
      const kept = loadResults().filter((r) => r.id !== row.id);
      try {
        localStorage.setItem('sz-compass-v2-results', JSON.stringify(kept));
      } catch {}
      setLocal(kept);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-primary" /> نتائجي
        </CardTitle>
        <CardDescription className="text-xs">
          {isLoggedIn ? 'نتائجك المحفوظة في حسابك وعلى هذا الجهاز.' : 'نتائجك المحفوظة على هذا الجهاز.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r, i) => (
          <React.Fragment key={`${r.source}-${r.id}-${i}`}>
            <div className="flex items-center justify-between gap-2 py-1.5">
              <button
                type="button"
                onClick={() => onOpen(r)}
                className="min-w-0 flex-1 text-right rounded-md px-1 -mx-1 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium truncate">
                  {spectrumName(r.spectrum)}
                  {COMPASS_FLAGS.showCharacterNames && r.topFigure ? ` · ${r.topFigure}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString('ar')} · {VERSION_LABEL[r.version] ?? r.version}
                  {r.topScore != null ? ` · ${Math.round(r.topScore * 100)}%` : ''}
                </p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {r.source === 'account' && <Badge variant="secondary" className="text-[10px]">حسابي</Badge>}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive h-8 w-8"
                  onClick={() => remove(r)}
                  aria-label="حذف النتيجة"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {i < rows.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
}
