import { PageHeader, PageShell } from '@/Components/layout';
import { OMran_SOURCE_URL } from './members2026';

export default function Hero2026({ total, female, male, onOpenArchive }: { total: number; female: number; male: number; onOpenArchive?: () => void }) {
    return (
        <div>
            <PageHeader
                title="أعضاء مجلس الشعب السوري 2026: الأسماء حسب المحافظة"
                description="القائمة الكاملة لأسماء أعضاء مجلس الشعب السوري 2026 موزّعين حسب المحافظة، مع مخطط القاعة التفاعلي والإحصاءات وصفحة مستقلة لكل عضو."
                divider
                actions={
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span className="font-semibold text-foreground">{total} عضواً</span>
                        <span aria-hidden="true">·</span>
                        <span>ذكور {male}</span>
                        <span aria-hidden="true">·</span>
                        <span>إناث {female}</span>
                    </div>
                }
            />
            <PageShell className="pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                    المصدر:{' '}
                    <a href={OMran_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline font-semibold text-primary">
                        مركز عمران: المخطط التفاعلي لمجلس الشعب السوري 2026
                    </a>
                    . بيانات المرحلة الانتقالية محفوظة في{' '}
                    <a href="#historical-archive" onClick={onOpenArchive} className="underline font-semibold text-primary">
                        قسم البيانات التاريخية أسفل الصفحة
                    </a>
                    .
                </p>
            </PageShell>
        </div>
    );
}
