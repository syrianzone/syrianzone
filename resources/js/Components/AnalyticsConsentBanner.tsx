import { Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import {
    isBannerPending,
    setConsent,
    useAnalyticsConsent,
    useMeasurementId,
} from '@/Lib/analyticsConsent';

/**
 * Small, non-modal consent card for analytics. It is mounted once, in
 * MainLayout, so full-screen layouts (the transit map, the studio) get it too.
 *
 * Nothing renders on the server or on the first client render: both the id and
 * the stored answer are read in effects, which keeps SSR and hydration
 * identical. It never takes focus and never blocks the page.
 */
export default function AnalyticsConsentBanner() {
    const id = useMeasurementId();
    const consent = useAnalyticsConsent();

    // One rule for "the card is on screen", shared with the first-visit
    // overlays that wait for it: an id is configured and the visitor has not
    // answered (a GPC signal resolves to 'denied', i.e. an answer).
    if (!isBannerPending(id, consent)) return null;

    return (
        <section
            aria-label="إحصاءات الزيارات"
            className="fixed z-20 start-3 end-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg md:start-4 md:end-auto md:bottom-[calc(1rem+env(safe-area-inset-bottom))] md:w-80"
        >
            <p className="text-xs leading-relaxed text-muted-foreground">
                نستخدم Google Analytics لقياس عدد الزيارات ومعرفة الصفحات الأكثر استخداماً. لا
                تُفعَّل الإحصاءات إلا بموافقتك.
            </p>

            <div className="mt-3 flex items-center gap-2">
                {/* Equal weight on purpose: refusing is as easy as agreeing. */}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConsent('granted')}
                >
                    موافق
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConsent('denied')}
                >
                    رفض
                </Button>
            </div>

            <Link
                href="/privacy"
                className="mt-2 inline-block text-[11px] text-primary underline underline-offset-2 hover:no-underline"
            >
                سياسة الخصوصية
            </Link>
        </section>
    );
}
