import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, extractError } from '../_lib/api';
import type { PlaceComment } from '../_lib/types';

export function CommentsSection(props: { placeId: number }) {
  const { placeId } = props;
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<PlaceComment[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setComments([]);
    setPage(1);
    setLastPage(1);
    setError(null);
    setLoading(true);
    api.listComments(placeId, 1)
      .then((res) => {
        if (cancelled) return;
        setComments(res.data);
        setLastPage(res.last_page);
      })
      .catch((e) => {
        if (!cancelled) setError(extractError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.listComments(placeId, page + 1);
      setComments((prev) => [...prev, ...res.data]);
      setPage(res.current_page);
      setLastPage(res.last_page);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setError(null);
    setPosting(true);
    try {
      const created = await api.addComment(placeId, trimmed);
      setComments((prev) => [created, ...prev]);
      setBody('');
    } catch (e) {
      setError(extractError(e));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(extractError(e));
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-foreground">التعليقات</h3>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {user ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Textarea
            value={body}
            maxLength={500}
            rows={2}
            onChange={(e) => setBody(e.target.value)}
            placeholder="أضف تعليقاً"
          />
          <Button type="submit" size="sm" disabled={posting || !body.trim()}>
            {posting && <Loader2 className="h-4 w-4 animate-spin" />}
            إرسال
          </Button>
        </form>
      ) : (
        <a href="/auth/google" className="block text-sm text-primary underline underline-offset-4">
          تسجيل الدخول عبر جوجل
        </a>
      )}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={c.user.avatar_url ?? undefined} alt={c.user.name} />
              <AvatarFallback>{c.user.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{c.user.name}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{c.body}</p>
            </div>
            {user && (user.id === c.user.id || isAdmin) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => remove(c.id)}
                aria-label="حذف التعليق"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {loading && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && comments.length === 0 && (
        <p className="text-sm text-muted-foreground">لا توجد تعليقات بعد</p>
      )}
      {page < lastPage && !loading && (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={loadMore}>
          عرض المزيد
        </Button>
      )}
    </div>
  );
}
