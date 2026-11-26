import React from 'react';
import { Download } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import type { SyidDownloadFile } from '@/Domain/syid/facts';

interface DownloadRowProps {
    file: SyidDownloadFile;
    primary?: boolean;
}

export function DownloadRow({ file, primary = false }: DownloadRowProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
            <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={primary ? 'default' : 'secondary'} className="font-mono text-[11px]">
                        {file.format}
                    </Badge>
                    <span className="font-medium text-sm text-foreground">
                        {file.label_ar ?? file.format}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span dir="ltr" className="tabular-nums font-mono">
                        {file.dimensions_ar}
                    </span>
                    <span aria-hidden="true">•</span>
                    <span dir="ltr" className="tabular-nums font-mono">
                        {file.size_label}
                    </span>
                </div>
            </div>

            <a
                href={file.path}
                download={file.download_name}
                className={
                    primary
                        ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 h-10 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0'
                        : 'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 h-10 text-xs sm:text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors shrink-0'
                }
            >
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>تحميل {file.format}</span>
            </a>
        </div>
    );
}
