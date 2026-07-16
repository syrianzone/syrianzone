import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, ExternalLink, Share2 } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/Lib/utils';
import { api } from '../_lib/api';

export function EngagementBar(props: {
  placeId: number;
  placeName: string;
  lat: number;
  lng: number;
  initialSaved: boolean;
  initialSaves: number;
}) {
  const { placeId, placeName, lat, lng } = props;
  const { user } = useAuth();
  const [saved, setSaved] = useState(props.initialSaved);
  const [saves, setSaves] = useState(props.initialSaves);
  const [saveBusy, setSaveBusy] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'copied' | 'failed' | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(shareTimer.current), []);

  const toggleSave = async () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    const next = !saved;
    setSaved(next);
    setSaves((n) => n + (next ? 1 : -1));
    setSaveBusy(true);
    try {
      const res = next ? await api.save(placeId) : await api.unsave(placeId);
      setSaved(res.saved);
      setSaves(res.saves_count);
    } catch {
      setSaved(!next);
      setSaves((n) => n + (next ? -1 : 1));
    } finally {
      setSaveBusy(false);
    }
  };

  const flashShareFeedback = (state: 'copied' | 'failed') => {
    setShareFeedback(state);
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareFeedback(null), 1500);
  };

  const share = async () => {
    const url = `${window.location.origin}/places?place=${placeId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: placeName, url });
        return;
      } catch (e) {
        // only a user cancel is silent; other rejections fall through to the clipboard
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flashShareFeedback('copied');
    } catch {
      flashShareFeedback('failed');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={saved ? 'default' : 'outline'}
          size="sm"
          disabled={saveBusy}
          onClick={toggleSave}
        >
          <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} />
          <span dir="ltr">{saves}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(shareFeedback === 'failed' && 'text-destructive')}
          onClick={share}
        >
          {shareFeedback === 'copied' ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {shareFeedback === 'copied' ? 'تم نسخ الرابط' : shareFeedback === 'failed' ? 'تعذر نسخ الرابط' : 'مشاركة'}
        </Button>
        <Button asChild variant="outline" size="sm">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            افتح في خرائط جوجل
          </a>
        </Button>
      </div>
      {showLogin && (
        <a href="/auth/google" className="text-sm text-primary underline underline-offset-4">
          تسجيل الدخول للتفاعل
        </a>
      )}
    </div>
  );
}
