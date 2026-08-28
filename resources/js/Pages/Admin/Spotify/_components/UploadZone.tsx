import React, { useRef, useState } from 'react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { toast } from '@/Components/ui/sonner';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, CloudUpload, FileAudio, RotateCcw, X } from 'lucide-react';
import { AdminSong, apiError } from '../_lib/types';

interface UploadItem {
  id: number;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadZoneProps {
  onUploaded: (song: AdminSong) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({ onUploaded }: UploadZoneProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  const patchItem = (id: number, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const upload = (id: number, file: File) => {
    patchItem(id, { status: 'uploading', progress: 0, error: undefined });
    const form = new FormData();
    form.append('file', file);
    axios
      .post('/api/v1/admin/spotify/songs', form, {
        onUploadProgress: (e) => {
          patchItem(id, { progress: e.total ? Math.round((e.loaded / e.total) * 100) : 0 });
        },
      })
      .then((res) => {
        patchItem(id, { status: 'done', progress: 100 });
        onUploaded(res.data as AdminSong);
        toast.success(`تم رفع ${file.name} وبدأت المعالجة`);
      })
      .catch((e) => {
        patchItem(id, { status: 'error', error: apiError(e, 'فشل الرفع، حاول مجدداً') });
        toast.error(`فشل رفع ${file.name}`);
      });
  };

  const addFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const isMp3 = /\.mp3$/i.test(file.name) || file.type === 'audio/mpeg';
      if (!isMp3) {
        toast.error(`الملف ${file.name} ليس بصيغة MP3، تم تجاهله`);
        continue;
      }
      // reject before uploading 50MB+ just to get the server's 422
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`الملف ${file.name} أكبر من 50 ميغابايت، تم تجاهله`);
        continue;
      }
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, file, progress: 0, status: 'uploading' }]);
      upload(id, file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const hasFinished = items.some((it) => it.status === 'done');

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30'
        )}
      >
        <CloudUpload className="w-10 h-10 text-primary" />
        <p className="font-semibold text-foreground">اسحب ملفات MP3 هنا أو انقر للاختيار</p>
        <p className="text-xs text-muted-foreground">
          يمكن رفع عدة ملفات دفعة واحدة، الحد الأقصى 50 ميغابايت للملف. تستخرج المدة والغلاف تلقائياً من الملف.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="rounded-2xl border bg-card divide-y">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold text-muted-foreground">قائمة الرفع ({items.length})</span>
            {hasFinished && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setItems((prev) => prev.filter((it) => it.status !== 'done'))}
              >
                إخفاء المكتملة
              </Button>
            )}
          </div>
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-4 py-3">
              <FileAudio className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate" title={it.file.name}>{it.file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatBytes(it.file.size)}</span>
                </div>
                {it.status === 'uploading' && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${it.progress}%` }} />
                  </div>
                )}
                {it.status === 'error' && (
                  <p className="text-xs text-destructive">{it.error}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {it.status === 'uploading' && (
                  <span className="text-xs text-muted-foreground tabular-nums">{it.progress}%</span>
                )}
                {it.status === 'done' && <CheckCircle2 className="w-5 h-5 text-primary" />}
                {it.status === 'error' && (
                  <>
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="إعادة المحاولة"
                      onClick={() => upload(it.id, it.file)}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </>
                )}
                {it.status !== 'uploading' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="إزالة من القائمة"
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
