import type { ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import { Check, Copy, ExternalLink, MoreVertical, Music, Pause, Play } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { copyText } from '../_lib/clipboard';
import { formatTime } from '../_lib/lrc';
import type { SongSummary } from '../types';

interface SongRowProps {
  song: SongSummary;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  // extra owner controls (playlist editing), rendered before the menu
  trailing?: ReactNode;
  withMenu?: boolean;
}

export default function SongRow({
  song,
  isCurrent,
  isPlaying,
  onPlay,
  selectable = false,
  selected = false,
  onToggleSelect,
  trailing,
  withMenu = true,
}: SongRowProps) {
  const handleRowClick = () => {
    if (selectable) onToggleSelect?.();
    else onPlay();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowClick();
        }
      }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-accent/50',
        selected && 'bg-accent/60'
      )}
    >
      {selectable && (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
            selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </span>
      )}
      {song.cover_url ? (
        <img src={song.cover_url} alt={song.title} className="h-11 w-11 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted">
          <Music className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', isCurrent ? 'text-primary' : 'text-foreground')}>
          {song.title}
        </p>
        {song.artist && <p className="truncate text-xs text-muted-foreground">{song.artist}</p>}
      </div>
      {song.duration_seconds !== null && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatTime(song.duration_seconds)}
        </span>
      )}
      {!selectable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          aria-label={isCurrent && isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          {isCurrent && isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}
        </Button>
      )}
      {trailing}
      {withMenu && !selectable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={(e) => e.stopPropagation()}
              aria-label="خيارات"
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() =>
                copyText(`${window.location.origin}/spotify/song/${song.slug}`, 'تم نسخ رابط الأغنية')
              }
            >
              <Copy className="me-2 h-4 w-4" />
              نسخ رابط الأغنية
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/spotify/song/${song.slug}`}>
                <ExternalLink className="me-2 h-4 w-4" />
                فتح صفحة الأغنية
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
