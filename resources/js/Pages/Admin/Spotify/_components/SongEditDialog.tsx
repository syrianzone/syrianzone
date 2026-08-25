import React, { useEffect, useState } from 'react';
import axios from '@/Lib/axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/Components/ui/dialog';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { toast } from '@/Components/ui/sonner';
import { ExternalLink } from 'lucide-react';
import { AdminSong, apiError } from '../_lib/types';

interface SongEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: AdminSong | null;
  onSaved: () => void;
}

export default function SongEditDialog({ open, onOpenChange, song, onSaved }: SongEditDialogProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(song?.title ?? '');
    setArtist(song?.artist ?? '');
    setLyrics(song?.lyrics_lrc ?? '');
  }, [song, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!song) return;
    setSaving(true);
    try {
      await axios.put(`/api/v1/admin/spotify/songs/${song.id}`, {
        title: title.trim(),
        artist: artist.trim() || null,
        lyrics_lrc: lyrics.trim() || null,
      });
      toast.success('تم حفظ التعديلات');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, 'فشل حفظ التعديلات'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">تعديل الأغنية</DialogTitle>
          <DialogDescription>عدّل العنوان والفنان وكلمات الأغنية بصيغة LRC.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="song-title" className="font-semibold text-xs">العنوان</Label>
              <Input
                id="song-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="song-artist" className="font-semibold text-xs">الفنان</Label>
              <Input
                id="song-artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="اختياري"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="song-lyrics" className="font-semibold text-xs">الكلمات (LRC)</Label>
            <Textarea
              id="song-lyrics"
              rows={10}
              dir="rtl"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={'[00:12.30] سطر الكلمات الأول\n[00:17.85] سطر الكلمات الثاني'}
              className="font-mono text-sm leading-6"
            />
            <p className="text-xs text-muted-foreground">
              صيغة LRC: كل سطر يبدأ بختم زمني مثل [00:12.30] يليه نص السطر.
              الأسطر بدون ختم زمني تعرض ككلمات غير متزامنة.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            {song && song.status === 'ready' ? (
              <a
                href={`/spotify/song/${song.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح صفحة الأغنية</span>
              </a>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
              <Button type="submit" disabled={saving || !title.trim()}>
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
