import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Copy, Download, Loader2, Moon, Share2, Sun } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/Components/ui/dialog';
import { notify } from '@/Lib/notify';
import { getThemeById, useThemeId } from '@/Lib/theme';
import { isShareCancelled, useCanShare } from '@/Lib/webShare';
import type { ElementPngOptions } from '@/Lib/exportElementAsPng';

export type ShareThemeChoice = 'nili' | 'nili-night';
export type ShareFormatChoice = 'story' | 'square';

export interface ShareImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  filename: string;
  shareTitle?: string;
  shareText?: string;
  /** Show the 9:16 قصة / 1:1 منشور toggle. */
  allowFormatToggle?: boolean;
  defaultFormat?: ShareFormatChoice;
  /** Optional export options forwarded to `exportElementAsPng`. */
  exportOptions?: ElementPngOptions;
  /** DOM-based share card renderer. */
  renderCard?: (ctx: {
    themeId: ShareThemeChoice;
    format: ShareFormatChoice;
    cardRef: React.RefObject<HTMLDivElement | null>;
  }) => React.ReactNode;
  /** Canvas/blob-based share image producer (e.g. TierBoard, Alignment). */
  renderImage?: (ctx: {
    themeId: ShareThemeChoice;
    format: ShareFormatChoice;
  }) => Promise<File>;
  /** Optional extra actions (e.g. SVG download). */
  extraActions?: React.ReactNode;
  /** Max display width of the preview container in CSS pixels (default 360). */
  previewMaxWidth?: number;
}

const subscribeNoop = () => () => {};
const hasClipboardImageWrite = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function' &&
  typeof ClipboardItem !== 'undefined';
const useCanCopyImage = () => useSyncExternalStore(subscribeNoop, hasClipboardImageWrite, () => false);

function defaultMadarChoice(activeThemeId: string): ShareThemeChoice {
  return getThemeById(activeThemeId)?.isDark ? 'nili-night' : 'nili';
}

export default function ShareImageDialog({
  open,
  onOpenChange,
  title = 'مشاركة الصورة',
  description = 'معاينة البطاقة الجاهزة للمشاركة والتحميل.',
  filename,
  shareTitle,
  shareText,
  allowFormatToggle = false,
  defaultFormat = 'story',
  exportOptions,
  renderCard,
  renderImage,
  extraActions,
  previewMaxWidth = 360,
}: ShareImageDialogProps) {
  const activeThemeId = useThemeId();
  const [themeId, setThemeId] = useState<ShareThemeChoice>(() => defaultMadarChoice(activeThemeId));
  const [format, setFormat] = useState<ShareFormatChoice>(defaultFormat);
  const [busy, setBusy] = useState<'share' | 'download' | 'copy' | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const generation = useRef(0);
  const exporting = useRef(false);

  const supportsShare = useCanShare(() => ({ files: [new File([], filename, { type: 'image/png' })] }));
  const supportsCopy = useCanCopyImage();

  // Sync theme choice to active page theme each time the dialog opens.
  useEffect(() => {
    if (open) {
      setThemeId(defaultMadarChoice(activeThemeId));
      setFormat(defaultFormat);
    }
  }, [open, activeThemeId, defaultFormat]);

  // Reset cached PNG file whenever dialog state, theme, or format changes.
  useEffect(() => {
    setPreparedFile(null);
    setBusy(null);
    exporting.current = false;
    generation.current += 1;
    return () => {
      generation.current += 1;
    };
  }, [open, themeId, format, filename]);

  // For canvas/blob-based renderers, generate the preview image when opened or toggled.
  useEffect(() => {
    if (!open || !renderImage) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewLoading(true);
    renderImage({ themeId, format })
      .then((file) => {
        if (cancelled) return;
        setPreparedFile(file);
        objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) notify.error('تعذّر تجهيز معاينة الصورة');
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, renderImage, themeId, format]);

  // Scale DOM card preview cleanly to fit dialog width without clipping.
  useEffect(() => {
    if (!open || !renderCard) return;
    const updateScale = () => {
      const wrap = previewWrapRef.current;
      const card = cardRef.current;
      if (!wrap || !card) return;
      const available = Math.min(wrap.clientWidth, previewMaxWidth);
      const natural = card.offsetWidth || available;
      setScale(natural > 0 ? Math.min(1, available / natural) : 1);
    };
    const id = requestAnimationFrame(updateScale);
    window.addEventListener('resize', updateScale);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', updateScale);
    };
  }, [open, renderCard, themeId, format, previewMaxWidth]);

  const produceFile = async (): Promise<File | null> => {
    if (preparedFile) return preparedFile;
    if (renderImage) {
      const file = await renderImage({ themeId, format });
      setPreparedFile(file);
      return file;
    }
    const card = cardRef.current;
    if (!card) return null;
    const { renderElementAsPngFile } = await import('@/Lib/exportElementAsPng');
    const file = await renderElementAsPngFile(card, filename, exportOptions);
    setPreparedFile(file);
    return file;
  };

  const runAction = async (action: 'share' | 'download' | 'copy') => {
    if (exporting.current) return;
    exporting.current = true;
    const current = generation.current;
    const isCurrent = () => current === generation.current;
    setBusy(action);
    try {
      const file = await produceFile();
      if (!file || !isCurrent()) return;

      if (action === 'download') {
        const { exportElementAsPng } = await import('@/Lib/exportElementAsPng');
        await exportElementAsPng(file, file.name || filename);
        notify.success('تم تحميل الصورة');
      } else if (action === 'copy') {
        const { copyElementAsPng } = await import('@/Lib/exportElementAsPng');
        const copied = await copyElementAsPng(file);
        if (copied) notify.copy('تم نسخ الصورة إلى الحافظة');
        else notify.error('المتصفح لا يدعم نسخ الصور');
      } else {
        try {
          await navigator.share({
            files: [file],
            ...(shareTitle ? { title: shareTitle } : {}),
            ...(shareText ? { text: shareText } : {}),
          });
        } catch (error) {
          if (!preparedFile && error instanceof DOMException && error.name === 'NotAllowedError') return;
          throw error;
        }
      }
    } catch (error) {
      if (isCurrent() && !isShareCancelled(error)) {
        const msg =
          action === 'share'
            ? 'تعذّرت مشاركة الصورة'
            : action === 'copy'
              ? 'تعذّر نسخ الصورة'
              : 'تعذّر تحميل الصورة';
        notify.error(msg);
      }
    } finally {
      if (isCurrent()) {
        exporting.current = false;
        setBusy(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Controls: Madar Light/Dark + optional 9:16 / 1:1 format */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="مظهر البطاقة"
            className="inline-flex items-center rounded-lg border border-border bg-muted p-1"
          >
            <button
              type="button"
              aria-pressed={themeId === 'nili'}
              onClick={() => setThemeId('nili')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                themeId === 'nili'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              نيلي فاتح
            </button>
            <button
              type="button"
              aria-pressed={themeId === 'nili-night'}
              onClick={() => setThemeId('nili-night')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                themeId === 'nili-night'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              ليل نيلي
            </button>
          </div>

          {allowFormatToggle && (
            <div
              role="group"
              aria-label="أبعاد البطاقة"
              className="inline-flex items-center rounded-lg border border-border bg-muted p-1"
            >
              <button
                type="button"
                aria-pressed={format === 'story'}
                onClick={() => setFormat('story')}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  format === 'story'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                9:16 قصة
              </button>
              <button
                type="button"
                aria-pressed={format === 'square'}
                onClick={() => setFormat('square')}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  format === 'square'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                1:1 منشور
              </button>
            </div>
          )}
        </div>

        {/* Live scaled preview */}
        <div
          ref={previewWrapRef}
          className="flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 p-3"
        >
          {renderCard ? (
            <div
              style={{
                transform: scale < 1 ? `scale(${scale})` : undefined,
                transformOrigin: 'top center',
                boxShadow: '0 10px 30px rgba(14, 17, 41, 0.16)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {renderCard({ themeId, format, cardRef })}
            </div>
          ) : previewLoading ? (
            <div className="flex h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>جارٍ تجهيز المعاينة…</span>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={title}
              className="max-h-[55dvh] w-auto max-w-full rounded-lg shadow-md"
            />
          ) : null}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          {supportsShare && (
            <Button
              type="button"
              onClick={() => runAction('share')}
              disabled={busy !== null || previewLoading}
              aria-busy={busy === 'share'}
              className="gap-2"
            >
              {busy === 'share' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              )}
              مشاركة الصورة
            </Button>
          )}
          <Button
            type="button"
            variant={supportsShare ? 'outline' : 'default'}
            onClick={() => runAction('download')}
            disabled={busy !== null || previewLoading}
            aria-busy={busy === 'download'}
            className="gap-2"
          >
            {busy === 'download' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            تحميل PNG
          </Button>
          {supportsCopy && (
            <Button
              type="button"
              variant="outline"
              onClick={() => runAction('copy')}
              disabled={busy !== null || previewLoading}
              aria-busy={busy === 'copy'}
              className="gap-2"
            >
              {busy === 'copy' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              نسخ الصورة
            </Button>
          )}
          {extraActions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
