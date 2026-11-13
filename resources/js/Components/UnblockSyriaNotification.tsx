import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { useConsentBannerPending } from '@/Lib/analyticsConsent';
import popupFacts from '../../data/site-popup.json';

export interface SitePopup {
    enabled: boolean;
    title: string;
    description: string;
    buttonText: string;
    dismissText: string;
    link: string;
    version: number;
}

// The copy ships in resources/data/site-popup.json, which SiteSetting::defaults()
// reads too: the server prop overrides it, the file keeps the two in step.
const FALLBACK_POPUP: SitePopup = popupFacts;

const UnblockSyriaNotification = () => {
    const { props } = usePage<{ sitePopup?: SitePopup }>();
    const popup: SitePopup = { ...FALLBACK_POPUP, ...(props.sitePopup ?? {}) };

    const [isVisible, setIsVisible] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    // One first-visit overlay at a time: the analytics consent card owns the
    // bottom of the screen until the visitor answers it.
    const consentBannerPending = useConsentBannerPending();

    const dismissKey = `site_popup_dismissed_v${popup.version}`;

    useEffect(() => {
        setHasMounted(true);
        if (!popup.enabled) return;
        if (consentBannerPending) return;
        const isDismissed = localStorage.getItem(dismissKey);

        if (!isDismissed) {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [dismissKey, popup.enabled, consentBannerPending]);

    // The panel is fixed in a corner and can sit over page controls (e.g. the
    // promises filter button). Once the user interacts with anything else on
    // the page, or presses the panel's own body, step aside for this page view
    // without recording a dismissal.
    useEffect(() => {
        if (!isVisible || isDismissing) return;
        const outside = (target: EventTarget | null) => target instanceof Node && !panelRef.current?.contains(target);
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (outside(target) || target instanceof Element && !target.closest('a, button')) setIsVisible(false);
        };
        const onFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (outside(target) && target instanceof Element && target.matches('input, textarea, select, [contenteditable="true"]')) setIsVisible(false);
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('focusin', onFocusIn, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('focusin', onFocusIn, true);
        };
    }, [isVisible, isDismissing]);

    const handleDismiss = () => {
        setIsDismissing(true);
        setTimeout(() => {
            setIsVisible(false);
            localStorage.setItem(dismissKey, 'true');
        }, 250);
    };

    if (!hasMounted || !isVisible || !popup.enabled) return null;

    return (
        <div
            ref={panelRef}
            role="region"
            aria-label="إشعار الموقع"
            aria-live="polite"
            className={`pointer-events-none fixed bottom-4 end-4 z-[60] max-w-[350px] w-[calc(100%-2rem)] md:w-full transition-all duration-300 ease-out ${
                isDismissing
                    ? 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                    : 'opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-4 zoom-in-95'
            }`}
        >
            <div className="pointer-events-auto bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4 relative overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                {/* Minimalist side accent */}
                <div className="absolute top-0 end-0 w-1.5 h-full bg-primary" />

                <button
                    onClick={handleDismiss}
                    className="absolute top-2 end-4 p-1.5 rounded-full hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="إغلاق"
                >
                    <X size={16} />
                </button>

                <div className="flex flex-col gap-3 text-right" dir="rtl">
                    <div className="flex items-center gap-2.5">
                        <img
                            src="/flag-replacer/1f1f8-1f1fe.svg"
                            alt="علم سوريا"
                            className="h-6 w-6 rounded-sm shrink-0"
                            width={24}
                            height={24}
                        />
                        <p className="font-bold text-lg text-foreground tracking-tight">
                            {popup.title}
                        </p>
                    </div>

                    <p className="text-sm text-foreground/80 leading-relaxed font-medium">
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
