import { useState } from 'react';
import { Bookmark, Heart, MessageCircle } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/Lib/utils';
import { api } from '../_lib/api';

export function EngagementBar(props: {
  placeId: number;
  initialLiked: boolean;
  initialSaved: boolean;
  initialLikes: number;
  initialSaves: number;
  commentsCount: number;
}) {
  const { placeId, commentsCount } = props;
  const { user } = useAuth();
  const [liked, setLiked] = useState(props.initialLiked);
  const [saved, setSaved] = useState(props.initialSaved);
  const [likes, setLikes] = useState(props.initialLikes);
  const [saves, setSaves] = useState(props.initialSaves);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const toggleLike = async () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    setLikeBusy(true);
    try {
      const res = next ? await api.like(placeId) : await api.unlike(placeId);
      setLiked(res.liked);
      setLikes(res.likes_count);
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    } finally {
      setLikeBusy(false);
    }
  };

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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={liked ? 'default' : 'outline'}
          size="sm"
          disabled={likeBusy}
          onClick={toggleLike}
        >
          <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
          <span dir="ltr">{likes}</span>
        </Button>
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
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <span dir="ltr">{commentsCount}</span>
        </span>
      </div>
      {showLogin && (
        <a href="/auth/google" className="text-sm text-primary underline underline-offset-4">
          تسجيل الدخول للتفاعل
        </a>
      )}
    </div>
  );
}
