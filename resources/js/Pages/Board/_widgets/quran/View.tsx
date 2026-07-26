import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Radio, Volume2, VolumeX, ChevronRight, ChevronLeft, Loader2, ChevronsUpDown, Search, Check } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { WidgetShell } from '../../_components/WidgetShell';
import type { WidgetProps } from '../../_lib/types';
import type { QuranConfig } from './index';

interface RadioStation {
  id: number;
  name: string;
  url: string;
}

const DEFAULT_RADIOS: RadioStation[] = [
  { id: 8, name: 'إذاعة عبد الباسط عبد الصمد', url: 'https://backup.qurango.net/radio/abdulbasit_abdulsamad_mojawwad' },
  { id: 10, name: 'إذاعة محمد صديق المنشاوي', url: 'https://backup.qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad' },
  { id: 9, name: 'إذاعة محمود خليل الحصري', url: 'https://backup.qurango.net/radio/mahmoud_khalil_alhussary' },
  { id: 7, name: 'إذاعة ماهر المعيقلي', url: 'https://backup.qurango.net/radio/maher' },
  { id: 6, name: 'إذاعة مشاري العفاسي', url: 'https://backup.qurango.net/radio/mishary_alafasi' },
  { id: 1, name: 'إذاعة إبراهيم الأخضر', url: 'https://backup.qurango.net/radio/ibrahim_alakdar' },
  { id: 2, name: 'إذاعة أبو بكر الشاطري', url: 'https://backup.qurango.net/radio/shaik_abu_bakr_al_shatri' },
  { id: 3, name: 'إذاعة أحمد العجمي', url: 'https://backup.qurango.net/radio/ahmad_alajmy' },
  { id: 105, name: 'إذاعة تلاوات خاشعة', url: 'https://backup.qurango.net/radio/salma' },
];

export default function QuranView({ config }: WidgetProps<QuranConfig>) {
  const [stations, setStations] = useState<RadioStation[]>(DEFAULT_RADIOS);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // Search & Dropdown State
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch full radio stations list from MP3Quran API
  useEffect(() => {
    let active = true;
    fetch('https://mp3quran.net/api/v3/radios?language=ar')
      .then((res) => res.json())
      .then((data) => {
        if (active && Array.isArray(data?.radios) && data.radios.length > 0) {
          setStations(data.radios);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentStation = stations[currentIndex] || DEFAULT_RADIOS[0];

  // Sync audio src and volume when station or volume changes
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.src = currentStation.url;
    audioRef.current.volume = isMuted ? 0 : volume;

    if (isPlaying) {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => setIsLoading(false))
        .catch(() => {
          setIsPlaying(false);
          setIsLoading(false);
        });
    }
  }, [currentIndex, currentStation.url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    setHasStarted(true);

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setIsLoading(false);
        });
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : newVol;
    }
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioRef.current) {
      audioRef.current.volume = nextMute ? 0 : volume;
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % stations.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + stations.length) % stations.length);
  };

  const filteredStations = stations.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <WidgetShell title="إذاعة القرآن الكريم" icon={Radio}>
      <audio
        ref={audioRef}
        src={currentStation.url}
        preload="none"
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
      />

      <div dir="rtl" className="flex h-full flex-col justify-between p-3 gap-2">
        {/* Station Info Header */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate leading-snug">
              {currentStation.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              MP3Quran Radio
            </p>
          </div>
        </div>

        {/* Searchable Shadcn Dropdown Combobox */}
        <div className="relative" ref={dropdownRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full justify-between h-8 text-xs font-normal px-2.5 bg-background border-input text-foreground hover:bg-accent"
          >
            <span className="truncate">{currentStation.name}</span>
            <ChevronsUpDown className="ms-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>

          {isOpen && (
            <div className="absolute top-full start-0 z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground p-1.5 shadow-md animate-in fade-in zoom-in-95">
              {/* Search Input inside Dropdown */}
              <div className="relative mb-1.5">
                <Search className="absolute start-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث عن قارئ أو إذاعة..."
                  className="h-7 text-xs ps-7 pe-2 bg-background"
                />
              </div>

              {/* Station Options List */}
              <div className="max-h-48 overflow-y-auto space-y-0.5 pe-1">
                {filteredStations.map((s) => {
                  const isSelected = s.id === currentStation.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const idx = stations.findIndex((st) => st.id === s.id);
                        if (idx !== -1) setCurrentIndex(idx);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary ms-1" />}
                    </button>
                  );
                })}

                {filteredStations.length === 0 && (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    لا توجد إذاعة مطابقة
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Controls Row: Volume Slider + Station Prev/Next + Play/Pause Circle FAB */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Volume Control */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={isMuted || volume === 0 ? 'إلغاء الكتم' : 'كتم الصوت'}
              aria-label={isMuted || volume === 0 ? 'إلغاء الكتم' : 'كتم الصوت'}
            >
              {isMuted || volume === 0 ? (
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
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-14 sm:w-20 h-1.5 accent-primary cursor-pointer rounded-lg bg-muted"
              title={`مستوى الصوت: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
          </div>

          {/* Station Prev/Next + Play/Pause Circle FAB */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="إذاعة سابقة"
              aria-label="إذاعة سابقة"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoading}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md transition-all ${
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
              onClick={handleNext}
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
            onClick={togglePlay}
            disabled={isLoading}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-all ${
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
              {currentStation.name}
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
