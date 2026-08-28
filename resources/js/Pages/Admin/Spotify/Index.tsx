import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Toaster, toast } from '@/Components/ui/sonner';
import { Edit3, ExternalLink, Image as ImageIcon, Mic2, Music4, RefreshCw, Trash2 } from 'lucide-react';
import UploadZone from './_components/UploadZone';
import SongEditDialog from './_components/SongEditDialog';
import { AdminSong, apiError, formatDuration } from './_lib/types';

interface AdminSpotifyProps {
  geminiEnabled: boolean;
}

function StatusBadge({ song }: { song: AdminSong }) {
  if (song.status === 'processing') {
    return <Badge variant="secondary" className="animate-pulse">معالجة</Badge>;
  }
  if (song.status === 'failed') {
    return (
      <div className="space-y-1">
        <Badge variant="destructive" title={song.error ?? undefined}>فشل</Badge>
        {song.error && (
          <p className="text-xs text-destructive max-w-[180px] truncate" title={song.error}>{song.error}</p>
        )}
      </div>
    );
  }
  return <Badge variant="default">جاهز</Badge>;
}

function LyricsBadge({ song }: { song: AdminSong }) {
  switch (song.lyrics_status) {
    case 'pending':
      return <Badge variant="secondary" className="animate-pulse">جارٍ الاستخراج</Badge>;
    case 'ready':
      return <Badge variant="default">جاهزة</Badge>;
    case 'failed':
      return <Badge variant="destructive">فشل</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground">بدون كلمات</Badge>;
  }
}

export default function SpotifyAdminIndex({ geminiEnabled }: AdminSpotifyProps) {
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<AdminSong | null>(null);
  const [coverUploadingId, setCoverUploadingId] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverSongId = useRef<number | null>(null);

  // one toast per failure streak, and a dead session stops the poll instead of
  // toasting every 2.5 seconds until the tab dies
  const failedBefore = useRef(false);
  const [pollDead, setPollDead] = useState(false);
  const fetchSongs = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/admin/syriafy/songs');
      // tolerate both a bare array and a wrapped { songs: [...] } payload
      const list = Array.isArray(res.data) ? res.data : res.data.songs;
      setSongs(list ?? []);
      failedBefore.current = false;
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (status === 401 || status === 419) {
        setPollDead(true);
        toast.error('انتهت الجلسة، أعد تحميل الصفحة');
      } else if (!failedBefore.current) {
        toast.error('فشل تحميل قائمة الأغاني');
      }
      failedBefore.current = true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // keep refreshing while any upload is processing or lyrics extraction is pending
  const hasActive = songs.some((s) => s.status === 'processing' || s.lyrics_status === 'pending');
  useEffect(() => {
    if (!hasActive || pollDead) return;
    const id = setInterval(fetchSongs, 2500);
    return () => clearInterval(id);
  }, [hasActive, fetchSongs]);

  const handleUploaded = (song: AdminSong) => {
    setSongs((prev) => [song, ...prev.filter((s) => s.id !== song.id)]);
  };

  const handleDelete = async (song: AdminSong) => {
    if (!confirm(`هل أنت متأكد من حذف "${song.title}"؟ سيحذف الملف الصوتي والغلاف نهائياً.`)) return;
    try {
      await axios.delete(`/api/v1/admin/syriafy/songs/${song.id}`);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      toast.success('تم حذف الأغنية');
    } catch (e) {
      toast.error(apiError(e, 'فشل حذف الأغنية'));
    }
  };

  const handleExtractLyrics = async (song: AdminSong) => {
    try {
      await axios.post(`/api/v1/admin/syriafy/songs/${song.id}/extract-lyrics`);
      toast.success('بدأ استخراج الكلمات، قد يستغرق بضع دقائق');
      fetchSongs();
    } catch (e) {
      toast.error(apiError(e, 'فشل بدء استخراج الكلمات'));
    }
  };

  const handleRetry = async (song: AdminSong) => {
    try {
      await axios.post(`/api/v1/admin/syriafy/songs/${song.id}/retry`);
      toast.success('أعيدت المعالجة');
      fetchSongs();
    } catch (e) {
      toast.error(apiError(e, 'فشل إعادة المعالجة'));
    }
  };

  const pickCover = (song: AdminSong) => {
    coverSongId.current = song.id;
    coverInputRef.current?.click();
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const songId = coverSongId.current;
    e.target.value = '';
    if (!file || songId == null) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast.error('صيغة الصورة غير مدعومة، المسموح: JPG أو PNG أو WebP');
      return;
    }
    setCoverUploadingId(songId);
    const form = new FormData();
    form.append('image', file);
    try {
      await axios.post(`/api/v1/admin/syriafy/songs/${songId}/cover`, form);
      toast.success('تم تحديث الغلاف');
      fetchSongs();
    } catch (err) {
      toast.error(apiError(err, 'فشل رفع الغلاف'));
    } finally {
      setCoverUploadingId(null);
    }
  };

  const extractDisabledReason = (song: AdminSong): string | null => {
    if (!geminiEnabled) return 'استخراج الكلمات غير مفعل: أضف GEMINI_API_KEY في إعدادات الخادم';
    if (song.status !== 'ready') return 'يتاح استخراج الكلمات بعد اكتمال معالجة الأغنية';
    if (song.lyrics_status === 'pending') return 'الاستخراج جارٍ حالياً';
    return null;
  };

  return (
    <MainLayout>
      <Head title="إدارة الأناشيد" />
      <Toaster />

      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border shadow-xs">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Music4 className="w-7 h-7 text-primary" />
              <span>إدارة الأناشيد</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              رفع الأغاني وإدارة الكلمات والأغلفة. تخزن الملفات على R2 ضمن مجلد spotify/.
            </p>
          </div>
          <a href="/syriafy" target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              <span>الصفحة العامة</span>
            </Button>
          </a>
        </div>

        <UploadZone onUploaded={handleUploaded} />

        <Card className="overflow-hidden border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="font-bold">الأغنية</TableHead>
                  <TableHead className="font-bold">المدة</TableHead>
                  <TableHead className="font-bold">الحالة</TableHead>
                  <TableHead className="font-bold">الكلمات</TableHead>
                  <TableHead className="font-bold">أضيفت</TableHead>
                  <TableHead className="text-end font-bold">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : songs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      لا توجد أغانٍ بعد، ابدأ برفع ملفات MP3 من الأعلى.
                    </TableCell>
                  </TableRow>
                ) : (
                  songs.map((song) => {
                    const extractReason = extractDisabledReason(song);
                    return (
                      <TableRow key={song.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
                              {song.cover_url ? (
                                <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Music4 className="w-5 h-5 text-muted-foreground/50" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-foreground font-semibold text-sm truncate max-w-[220px]" title={song.title}>
                                {song.title}
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                                {song.artist || 'فنان غير محدد'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {formatDuration(song.duration_seconds)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge song={song} />
                        </TableCell>
                        <TableCell>
                          <LyricsBadge song={song} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(song.created_at).toLocaleDateString('ar-SY')}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="تعديل العنوان والفنان والكلمات"
                              onClick={() => {
                                setSelectedSong(song);
                                setEditOpen(true);
                              }}
                            >
                              <Edit3 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={coverUploadingId === song.id ? 'جاري رفع الغلاف...' : 'رفع صورة غلاف'}
                              disabled={coverUploadingId === song.id}
                              onClick={() => pickCover(song)}
                            >
                              <ImageIcon className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={extractReason ?? 'استخراج الكلمات تلقائياً (Gemini)'}
                              disabled={extractReason != null}
                              onClick={() => handleExtractLyrics(song)}
                            >
                              <Mic2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            {song.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="إعادة المعالجة"
                                onClick={() => handleRetry(song)}
                              >
                                <RefreshCw className="w-4 h-4 text-muted-foreground hover:text-primary" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="حذف"
                              onClick={() => handleDelete(song)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleCoverChange}
        />

        <SongEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          song={selectedSong}
          onSaved={fetchSongs}
        />
      </div>
    </MainLayout>
  );
}
