import { ChevronLeft, ChevronRight, Loader2, Pause, Play, Radio } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import type { WidgetProps } from '../../_lib/types';
import type { QuranConfig } from './index';
import QuranNowReading from '@/Components/QuranNowReading';
import RecitationPicker from '@/Pages/Muslim/_components/RecitationPicker';
import { useQuranPlayer } from '@/Lib/quranPlayer';

/**
 * Followed recitation on the board: the global player's current ayah with the
 * word highlight, sharing playback with the Muslim corner's radio/reader.
 */
export default function QuranView(_props: WidgetProps<QuranConfig>) {
  const playing = useQuranPlayer((s) => s.playing);
  const loading = useQuranPlayer((s) => s.loading);
  const error = useQuranPlayer((s) => s.error);
  const current = useQuranPlayer((s) => s.current);
  const recitationCode = useQuranPlayer((s) => s.recitationCode);
  const setRecitation = useQuranPlayer((s) => s.setRecitation);
  const playContinuous = useQuranPlayer((s) => s.playContinuous);
  const toggle = useQuranPlayer((s) => s.toggle);
  const next = useQuranPlayer((s) => s.next);
  const prev = useQuranPlayer((s) => s.prev);

  const startOrToggle = () => {
    if (current) toggle();
    else playContinuous({ recitationCode });
  };

  return (
    <WidgetShell title="إذاعة القرآن الكريم" icon={Radio}>
      <div dir="rtl" className="flex h-full flex-col justify-between gap-2 p-3">
        <QuranNowReading variant="compact" />

        {error && <p className="text-[10px] text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prev}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="الآية السابقة"
              aria-label="الآية السابقة"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={startOrToggle}
              disabled={loading}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:scale-105 disabled:opacity-60 ${
                playing ? 'scale-105 ring-4 ring-primary/20' : 'hover:bg-primary/90'
              }`}
              title={playing ? 'إيقاف مؤقت' : 'تشغيل'}
              aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : playing ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current ms-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={next}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="الآية التالية"
              aria-label="الآية التالية"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <RecitationPicker value={recitationCode} onChange={setRecitation} />
        </div>
      </div>
    </WidgetShell>
  );
}
