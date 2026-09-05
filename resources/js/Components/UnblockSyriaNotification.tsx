import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

export interface SitePopup {
    enabled: boolean;
    title: string;
    description: string;
    buttonText: string;
    dismissText: string;
    link: string;
    version: number;
}

const FALLBACK_POPUP: SitePopup = {
    enabled: true,
    title: "صوتك بيعمل فرق!",
    description: "ساهم في فك الحظر عن الخدمات التقنية في سوريا. صوّت للخدمات الأكثر أهمية بالنسبة لك لتكون من أولويات العمل.",
    buttonText: "صوّت الآن",
    dismissText: "لاحقاً",
    link: "https://unblocksyria.com",
    version: 1,
};

const UnblockSyriaNotification = () => {
    const { props } = usePage<{ sitePopup?: SitePopup }>();
    const popup: SitePopup = { ...FALLBACK_POPUP, ...(props.sitePopup ?? {}) };

    const [isVisible, setIsVisible] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);

    const dismissKey = `site_popup_dismissed_v${popup.version}`;
    // Back-compat: users who dismissed the old hardcoded popup should see
    // the new manageable copy at least once.
    const legacyKey = 'unblock_syria_notif_dismissed';

    useEffect(() => {
        setHasMounted(true);
        if (!popup.enabled) return;
        const isDismissed = localStorage.getItem(dismissKey);

        // Show after a short delay for better UX
        if (!isDismissed) {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [dismissKey, popup.enabled]);

    const handleDismiss = () => {
        setIsDismissing(true);
        setTimeout(() => {
            setIsVisible(false);
            localStorage.setItem(dismissKey, 'true');
            localStorage.setItem(legacyKey, 'true');
        }, 250);
    };

    if (!hasMounted || !isVisible || !popup.enabled) return null;

    return (
        <div
            className={`fixed bottom-4 left-4 z-[9999] max-w-[350px] w-[calc(100%-2rem)] md:w-full transition-all duration-300 ease-out ${
                isDismissing
                    ? 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                    : 'opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-4 zoom-in-95'
            }`}
        >
            <div className="bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4 relative overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                {/* Minimalist side accent */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />

                <button
                    onClick={handleDismiss}
                    className="absolute top-2 left-4 p-1.5 rounded-full hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="إغلاق"
                >
                    <X size={16} />
                </button>

                <div className="flex flex-col gap-3 text-right" dir="rtl">
                    <div className="flex items-center gap-2.5">
                        <span className="text-2xl" role="img" aria-label="Syria Flag">🇸🇾</span>
                        <h3 className="font-bold text-lg text-foreground tracking-tight">
                            {popup.title}
                        </h3>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        {popup.description}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                        <Button asChild size="sm" className="flex-1 font-bold shadow-sm">
                            <a
                                href={popup.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2"
                            >
                                {popup.buttonText}
                                <ExternalLink size={14} />
                            </a>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDismiss}
                            className="font-medium"
                        >
                            {popup.dismissText}
                        </Button>
                    </div>
                </div>

                {/* Subtle glow effect for attention */}
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-primary/10 blur-3xl rounded-full -z-10" />
            </div>
        </div>
    );
};

export default UnblockSyriaNotification;
