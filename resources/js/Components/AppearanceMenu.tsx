import React from 'react';
import { Check, Palette } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/Components/ui/popover';
import { useAuth } from '@/Contexts/AuthContext';
import { applyTheme, THEME_REGISTRY, useThemePreference } from '@/Lib/theme';
import { applyFont, getFontPreference, FontPreference } from '@/Lib/font';
import { saveAccountSettings, type AccountSettingsPatch } from '@/Domain/settings/accountSettings';

const FONT_OPTIONS: Array<[FontPreference, string]> = [
    ['ibm-plex', 'Plex'],
    ['system', 'محلي'],
];

// Theme + font picker for every visitor (logged in or not). Available in the
// navbar next to the account button, independent of the auth state.
export default function AppearanceMenu({ className }: { className?: string }) {
    const { user } = useAuth();
    const currentTheme = useThemePreference();
    const [currentFont, setCurrentFont] = React.useState<FontPreference>(getFontPreference());

    // The font half of the appearance: `Lib/font.ts` has no document
    // subscription yet, so the menu watches the attribute it applies.
    React.useEffect(() => {
        const sync = () => setCurrentFont(getFontPreference());
        // `applyFont` sets data-font; read it back when a surface changes it.
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font'] });
        return () => observer.disconnect();
    }, []);

    const saveSetting = (settings: AccountSettingsPatch) => {
        if (!user) return;
        saveAccountSettings(settings);
    };

    const handleThemeChange = (themeId: string) => {
        applyTheme(themeId);
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
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    aria-label="المظهر والخط"
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-accent/50 ${className ?? ''}`}
                    title="المظهر والخط"
                >
                    {activeTheme ? (
                        <span
                            aria-hidden="true"
                            className="h-4 w-4 sm:h-5 sm:w-5 rounded-full overflow-hidden shadow-sm"
                            style={{ background: activeTheme.bg, border: `2px solid ${activeTheme.primary}` }}
                        >
                            <span className="block" style={{ background: activeTheme.primary, height: '50%', marginTop: '50%' }} />
                        </span>
                    ) : (
                        <Palette className="h-5 w-5" aria-hidden="true" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="end">
                <div className="px-2 py-1.5" dir="rtl">
                    <p id="sz-appearance-theme-label" className="text-xs text-muted-foreground mb-2">المظهر</p>
                    <div role="group" aria-labelledby="sz-appearance-theme-label">
                        {heritageThemes.length > 0 && (
                            <div className="flex items-center gap-2 mb-3">
                                {heritageThemes.map((t) => {
                                    const isActive = currentTheme === t.id;
                                    const swatch = (
                                        <span
                                            aria-hidden="true"
                                            className="w-4 h-4 rounded-full shrink-0 overflow-hidden shadow-sm"
                                            style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                        >
                                            <span className="block" style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                        </span>
                                    );
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            aria-pressed={isActive}
                                            onClick={() => handleThemeChange(t.id)}
                                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${isActive ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-foreground hover:border-primary'}`}
                                        >
                                            {swatch}
                                            <span>{t.shortNameAr ?? t.nameAr}</span>
                                            {isActive && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1">
                            {circleThemes.map((t) => {
                                const isActive = currentTheme === t.id;
                                return (
                                    <button
                                        aria-label={t.nameAr}
                                        aria-pressed={isActive}
                                        key={t.id}
                                        type="button"
                                        title={t.nameAr}
                                        onClick={() => handleThemeChange(t.id)}
                                        className="w-6 h-6 inline-flex items-center justify-center rounded-full shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`w-4 h-4 rounded-full overflow-hidden shadow-sm transition-all ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-110'}`}
                                            style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                        >
                                            <span className="block" style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <p id="sz-appearance-font-label" className="text-xs text-muted-foreground mt-3 mb-2">الخط</p>
                    <div role="group" aria-labelledby="sz-appearance-font-label" className="flex items-center gap-2">
                        {FONT_OPTIONS.map(([id, label]) => {
                            const isActive = currentFont === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={isActive}
                                    onClick={() => handleFontChange(id)}
                                    className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${isActive ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-foreground hover:border-primary'}`}
                                >
                                    <span>{label}</span>
                                    {isActive && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
