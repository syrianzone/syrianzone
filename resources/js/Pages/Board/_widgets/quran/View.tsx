import { Play, Pause, Radio, Volume2, VolumeX, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import type { WidgetProps } from '../../_lib/types';
import type { QuranConfig } from './index';
import QuranStationPicker from '@/Components/QuranStationPicker';
import { useLiveRadio } from '@/Lib/useLiveRadio';

export default function QuranView({ config }: WidgetProps<QuranConfig>) {
  const radio = useLiveRadio();
  const { station, isPlaying, isLoading, hasStarted } = radio;

  return (
    <WidgetShell title="إذاعة القرآن الكريم" icon={Radio}>
      <audio {...radio.audioProps} />

      <div dir="rtl" className="flex h-full flex-col justify-between p-3 gap-2">
        {/* Station Info Header */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate leading-snug">
              {station?.name ?? '—'}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {radio.isFallbackList ? 'إذاعات مختارة' : 'MP3Quran Radio'}
            </p>
          </div>
        </div>

        {/* Searchable reciter picker, shared with the Muslim corner applet. */}
        <QuranStationPicker
          stations={radio.stations}
          value={station}
          onSelect={radio.selectStation}
          className="w-full"
          triggerClassName="h-8 text-xs px-2.5 bg-background border-input text-foreground hover:bg-accent"
          placeholder="بحث عن قارئ أو إذاعة..."
          emptyLabel="لا توجد إذاعة مطابقة"
          isLoading={radio.isListLoading}
        />

        {/* Main Controls Row: Volume Slider + Station Prev/Next + Play/Pause Circle FAB */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Volume Control */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={radio.toggleMute}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={radio.isMuted || radio.volume === 0 ? 'إلغاء الكتم' : 'كتم الصوت'}
              aria-label={radio.isMuted || radio.volume === 0 ? 'إلغاء الكتم' : 'كتم الصوت'}
            >
              {radio.isMuted || radio.volume === 0 ? (
                <VolumeX className="h-4 w-4 text-destructive" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={radio.isMuted ? 0 : radio.volume}
              onChange={(e) => radio.setVolume(Number(e.target.value))}
              className="w-14 sm:w-20 h-1.5 accent-primary cursor-pointer rounded-lg bg-muted"
              title={`مستوى الصوت: ${Math.round((radio.isMuted ? 0 : radio.volume) * 100)}%`}
            />
          </div>

          {/* Station Prev/Next + Play/Pause Circle FAB */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={radio.prev}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="إذاعة سابقة"
              aria-label="إذاعة سابقة"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={radio.toggle}
              disabled={isLoading || !station}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md transition-all disabled:opacity-60 ${
                isPlaying
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105'
              }`}
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current ms-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={radio.next}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="إذاعة التالية"
              aria-label="إذاعة التالية"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) fixed at corner of the page for ease of access on large boards */}
      {hasStarted && (
        <div
          dir="rtl"
          className="fixed bottom-6 start-6 z-50 flex items-center gap-2 rounded-full border border-border/60 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
        >
          <button
            type="button"
            onClick={radio.toggle}
            disabled={isLoading}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-all disabled:opacity-60 ${
              isPlaying
                ? 'bg-primary ring-4 ring-primary/30 scale-105'
                : 'bg-primary hover:bg-primary/90'
            }`}
            title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current ms-0.5" />
            )}
          </button>

          <div className="pe-3 min-w-0 max-w-44 hidden sm:block">
            <p className="truncate text-xs font-bold text-foreground leading-tight">
              {station?.name ?? '—'}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {isPlaying ? 'جاري التشغيل...' : 'متوقف مؤقتاً'}
            </p>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
