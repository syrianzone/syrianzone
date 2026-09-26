'use client';

import React from 'react';
import axios from 'axios';
import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/Contexts/AuthContext';
import { applyTheme, getThemePreference, THEME_REGISTRY } from '@/lib/theme';
import { applyFont, getFontPreference, FontPreference } from '@/Lib/font';

const FONT_OPTIONS: Array<[FontPreference, string]> = [
    ['ibm-plex', 'Plex'],
    ['system', 'محلي'],
];

// Theme + font picker for every visitor (logged in or not). Available in the
// navbar next to the account button, independent of the auth state.
export default function AppearanceMenu({ className }: { className?: string }) {
    const { user } = useAuth();
    const [mounted, setMounted] = React.useState(false);
    const [currentTheme, setCurrentTheme] = React.useState<string>(getThemePreference());
    const [currentFont, setCurrentFont] = React.useState<FontPreference>(getFontPreference());

    // Stay in sync when the theme/font change elsewhere (swatches, other menus).
    React.useEffect(() => {
        const sync = () => {
            setMounted(true);
            setCurrentTheme(getThemePreference());
            setCurrentFont(getFontPreference());
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-font'] });
        return () => observer.disconnect();
    }, []);

    const saveSetting = (settings: Record<string, string>) => {
        if (!user) return;
        axios.post('/api/user/settings', { settings }).catch(() => {});
    };

    const handleThemeChange = (themeId: string) => {
        applyTheme(themeId);
        setCurrentTheme(themeId);
        saveSetting({ theme: themeId });
    };

    const handleFontChange = (font: FontPreference) => {
        applyFont(font);
        setCurrentFont(font);
        saveSetting({ fontFamily: font });
    };

    const circleThemes = THEME_REGISTRY.filter((t) => t.group !== 'heritage');
    const heritageThemes = THEME_REGISTRY.filter((t) => t.group === 'heritage');
    const activeTheme = THEME_REGISTRY.find((t) => t.id === currentTheme);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-accent/50 ${className ?? ''}`}
                    title="المظهر والخط"
                >
                    {mounted && activeTheme ? (
                        <span
                            className="h-4 w-4 sm:h-5 sm:w-5 rounded-full overflow-hidden shadow-sm"
                            style={{ background: activeTheme.bg, border: `2px solid ${activeTheme.primary}` }}
                        >
                            <span className="block" style={{ background: activeTheme.primary, height: '50%', marginTop: '50%' }} />
                        </span>
                    ) : (
                        <Palette className="h-5 w-5" />
                    )}
                    <span className="sr-only">المظهر والخط</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
                <div className="px-2 py-1.5" dir="rtl">
                    <p className="text-xs text-muted-foreground mb-2">المظهر</p>
                    {heritageThemes.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                            {heritageThemes.map((t) => {
                                const isActive = currentTheme === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => handleThemeChange(t.id)}
                                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${isActive ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-foreground hover:border-primary'}`}
                                    >
                                        {t.id !== 'damascus-rose' && (
                                            <span
                                                className="w-4 h-4 rounded-full shrink-0 overflow-hidden shadow-sm"
                                                style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                            >
                                                <span className="block" style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                            </span>
                                        )}
                                        <span>{t.shortNameAr ?? t.nameAr}</span>
                                        {t.id === 'damascus-rose' && (
                                            <span
                                                className="w-4 h-4 rounded-full shrink-0 overflow-hidden shadow-sm"
                                                style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                            >
                                                <span className="block" style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                            </span>
                                        )}
                                        {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        {circleThemes.map((t) => {
                            const isActive = currentTheme === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    title={t.nameAr}
                                    onClick={() => handleThemeChange(t.id)}
                                    className={`w-4 h-4 rounded-full shrink-0 overflow-hidden shadow-sm transition-all ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-110'}`}
                                    style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                >
                                    <div style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 mb-2">الخط</p>
                    <div className="flex items-center gap-2">
                        {FONT_OPTIONS.map(([id, label]) => {
                            const isActive = currentFont === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => handleFontChange(id)}
                                    className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${isActive ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-foreground hover:border-primary'}`}
                                >
                                    <span>{label}</span>
                                    {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
