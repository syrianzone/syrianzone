import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import { Download, Loader2, Share2 } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { isShareCancelled, useCanShare } from '@/Lib/webShare';
import Countdown from './Countdown';
import SpeakerAvatar from '@/Domain/promises/SpeakerAvatar';
import StateBadge from '@/Domain/promises/StateBadge';
import { formatDate } from '@/Domain/promises/format';
import type { PromiseDetailData } from '@/Domain/promises/types';

/**
 * A square card with today's count, rendered in the browser so it is never
 * stale (pre-rendered OG images would freeze the number). The exporter is
 * loaded on demand: html2canvas is heavy and most visitors never share.
 *
 * Nothing inside the captured node may use `truncate`: html2canvas lays out
 * ellipsised right-to-left text wrongly and clips Arabic names.
 */
export default function ShareCardDialog({ promise, open, onOpenChange }: {
    promise: PromiseDetailData;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { seo } = usePage().props as { seo?: { canonical?: string } };
    const frameRef = useRef<HTMLDivElement>(null);
    const [busy, setBusy] = useState<'download' | 'share' | null>(null);
    const [preparedFile, setPreparedFile] = useState<File | null>(null);
    const generation = useRef(0);
    const exporting = useRef(false);
    const filename = `promise-${promise.number}.png`;
    const supportsImages = useCanShare(() => ({ files: [new File([], filename, { type: 'image/png' })] }));

    useEffect(() => {
        setPreparedFile(null);
        setBusy(null);
        exporting.current = false;
        return () => { generation.current += 1; };
    }, [open, promise]);

    // The canonical URL comes from the server (config('seo.base_url')), so the
    // card prints the public address even when exported from a local or
    // staging host.
    const shareUrl = (seo?.canonical ?? `/promises/${promise.number}`).replace(/^https?:\/\//, '');

    const exportImage = async (action: 'download' | 'share') => {
        const frame = frameRef.current;
        if (!frame || exporting.current) return;
        exporting.current = true;
        const current = generation.current;
        const isCurrent = () => current === generation.current && frameRef.current === frame && frame.isConnected;
        setBusy(action);
        try {
            let file = preparedFile;
            if (!file) {
                const { renderElementAsPngFile } = await import('@/Lib/exportElementAsPng');
                if (!isCurrent()) return;
                file = await renderElementAsPngFile(frame, filename);
                if (!isCurrent()) return;
                setPreparedFile(file);
            }
            if (action === 'download') {
                const { exportElementAsPng } = await import('@/Lib/exportElementAsPng');
                if (isCurrent()) await exportElementAsPng(file, filename);
            } else {
                try {
                    await navigator.share({ files: [file] });
                } catch (error) {
                    if (!preparedFile && error instanceof DOMException && error.name === 'NotAllowedError') return;
                    throw error;
                }
            }
        } catch (error) {
            if (isCurrent() && !isShareCancelled(error)) notify.error(action === 'share' ? 'تعذّرت مشاركة الصورة' : 'تعذّر إنشاء الصورة');
        } finally {
            if (isCurrent()) {
                exporting.current = false;
                setBusy(null);
            }
        }
    };

    const coSpeakers = promise.coSpeakers ?? [];
    const allSpeakers = [promise.speaker, ...coSpeakers];
    const speakerNames = allSpeakers.map((s) => s.name).filter(Boolean).join(' و');
    const speakerTitles = allSpeakers.map((s) => s.title).filter(Boolean).join(' · ');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>صورة للمشاركة</DialogTitle>
                    <DialogDescription>صورة بعدّاد اليوم لنشرها على وسائل التواصل.</DialogDescription>
                </DialogHeader>

                {/* The captured node is this padded frame rather than the rounded
                    card, so the image's corners take the theme background instead
                    of the exporter's fixed fill. */}
                <div id={`promise-share-${promise.number}`} ref={frameRef} dir="rtl" className="mx-auto w-full max-w-sm bg-background p-3">
                    <div className="flex aspect-square flex-col justify-between gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                                {coSpeakers.length > 0 ? (
                                    <div className="flex shrink-0 items-center">
                                        {allSpeakers.map((s, idx) => (
                                            <SpeakerAvatar
                                                key={s.id ?? idx}
                                                name={s.name}
                                                image={s.image}
                                                size={40}
                                                className={`ring-2 ring-card${idx > 0 ? ' -ms-2.5' : ''}`}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <SpeakerAvatar name={promise.speaker.name} image={promise.speaker.image} size={44} />
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-bold leading-snug">{speakerNames}</p>
                                    {speakerTitles && (
                                        <p className="text-xs leading-snug text-muted-foreground">{speakerTitles}</p>
                                    )}
                                </div>
                            </div>
                            <StateBadge state={promise.state} keptLate={promise.keptLate} />
                        </div>
                        <p className="text-lg font-extrabold leading-snug">{promise.title}</p>
                        <Countdown state={promise.state} counter={promise.counter} deadlineDate={promise.deadlineDate} statementDate={promise.statementDate} size="lg" />
                        <div className="flex items-end justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                            <span>
                                {promise.deadlineDate ? `الموعد ${formatDate(promise.deadlineDate)}` : `أُطلق ${formatDate(promise.statementDate)}`}
                            </span>
                            <span className="text-end font-semibold text-foreground">
                                عداد الوعود
                                <br />
                                <span dir="ltr">{shareUrl}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-start">
                    {supportsImages && (
                        <Button onClick={() => exportImage('share')} disabled={busy !== null} className="gap-2" aria-busy={busy === 'share'}>
                            {busy === 'share' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
                            {busy === 'share' && !preparedFile ? 'جارٍ تجهيز الصورة…' : preparedFile ? 'جاهزة للمشاركة, شارك!' : 'مشاركة الصورة'}
                        </Button>
                    )}
                    <Button variant={supportsImages ? 'outline' : 'default'} onClick={() => exportImage('download')} disabled={busy !== null} className="gap-2" aria-busy={busy === 'download'}>
                        {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                        تحميل الصورة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
