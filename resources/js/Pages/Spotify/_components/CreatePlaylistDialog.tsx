import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import { toast } from '@/Components/ui/sonner';
import { createPlaylist, extractError, rememberEditToken } from '../_lib/api';
import { copyText } from '../_lib/clipboard';

interface CreatePlaylistDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  songIds: number[];
  onCreated: () => void;
}

export default function CreatePlaylistDialog({ open, onOpenChange, songIds, onCreated }: CreatePlaylistDialogProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ slug: string; url: string } | null>(null);

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setName('');
      setCreated(null);
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await createPlaylist(trimmed, songIds);
      rememberEditToken(res.slug, res.edit_token);
      setCreated({ slug: res.slug, url: res.url });
      onCreated();
      toast.success('تم إنشاء القائمة');
    } catch (e) {
      toast.error(extractError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        {created ? (
          <>
            <DialogHeader className="text-start sm:text-start">
              <DialogTitle>تم إنشاء القائمة</DialogTitle>
              <DialogDescription>
                شارك الرابط مع أصدقائك. يمكنك تعديل القائمة من هذا المتصفح فقط، فاحتفظ بالرابط.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input readOnly value={created.url} dir="ltr" className="text-xs" onFocus={(e) => e.target.select()} />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => copyText(created.url, 'تم نسخ رابط القائمة')}
                aria-label="نسخ الرابط"
              >
                <Copy />
              </Button>
            </div>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button asChild>
                <Link href={`/spotify/playlist/${created.slug}`}>
                  <ExternalLink className="me-1 h-4 w-4" />
                  فتح القائمة
                </Link>
              </Button>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
            <DialogHeader className="text-start sm:text-start">
              <DialogTitle>إنشاء قائمة تشغيل</DialogTitle>
              <DialogDescription>
                {songIds.length === 1 ? 'أغنية واحدة محددة' : `${songIds.length} أغانٍ محددة`}
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="اسم القائمة"
            />
            <DialogFooter className="gap-2 sm:justify-start">
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                إنشاء
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
