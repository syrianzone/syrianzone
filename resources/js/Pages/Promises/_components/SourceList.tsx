import { Badge } from '@/Components/ui/badge';
import { Archive, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { formatDate, safeHref } from '@/Domain/promises/format';
import { SOURCE_TYPE_LABEL } from '@/Domain/promises/status';
import type { PromiseSourceData } from '@/Domain/promises/types';

function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

/** Every place the promise was said or reported, primary source first. */
export default function SourceList({ sources }: { sources: PromiseSourceData[] }) {
    return (
        <ul className="divide-y divide-border">
            {sources.map((s) => {
                const url = safeHref(s.url);
                const archive = safeHref(s.archiveUrl);
                const screenshot = safeHref(s.screenshotUrl);

                return (
                    <li key={s.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{s.outlet || hostOf(s.url)}</span>
                            <Badge variant="outline" className="text-[11px]">{SOURCE_TYPE_LABEL[s.type] ?? s.type}</Badge>
                            {s.isPrimary && <Badge variant="secondary" className="text-[11px]">المصدر الأساسي</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            {s.publishedDate && <span className="text-muted-foreground">{formatDate(s.publishedDate)}</span>}
                            {url && (
                                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />فتح المصدر
                                    {s.videoTimestamp && <span className="text-muted-foreground">(عند الدقيقة <span dir="ltr">{s.videoTimestamp}</span>)</span>}
                                </a>
                            )}
                            {archive && (
                                <a href={archive} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />نسخة مؤرشفة
                                </a>
                            )}
                            {screenshot && (
                                <a href={screenshot} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                                    <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />لقطة شاشة
                                </a>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
