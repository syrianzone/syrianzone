import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * EDITABLE TEXT SECTION
 * You can easily change the message and link here.
 */
const NOTIFICATION_CONTENT = {
    title: "صوتك بيعمل فرق!",
    description: "ساهم في فك الحظر عن الخدمات التقنية في سوريا. صوّت للخدمات الأكثر أهمية بالنسبة لك لتكون من أولويات العمل.",
    buttonText: "صوّت الآن",
    dismissText: "لاحقاً",
    link: "https://unblocksyria.com",
};

const UnblockSyriaNotification = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
        const isDismissed = localStorage.getItem('unblock_syria_notif_dismissed');

        // Show after a short delay for better UX
        if (!isDismissed) {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setIsDismissing(true);
        setTimeout(() => {
            setIsVisible(false);
            localStorage.setItem('unblock_syria_notif_dismissed', 'true');
        }, 250);
    };

    if (!hasMounted || !isVisible) return null;

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
                            {NOTIFICATION_CONTENT.title}
                        </h3>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        {NOTIFICATION_CONTENT.description}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                        <Button asChild size="sm" className="flex-1 font-bold shadow-sm">
                            <a
                                href={NOTIFICATION_CONTENT.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2"
                            >
                                {NOTIFICATION_CONTENT.buttonText}
                                <ExternalLink size={14} />
                            </a>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDismiss}
                            className="font-medium"
                        >
                            {NOTIFICATION_CONTENT.dismissText}
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
