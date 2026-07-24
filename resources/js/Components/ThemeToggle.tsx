import * as React from 'react';
import { Moon, Sun, Monitor, Palette, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { applyTheme, getThemePreference, SYSTEM_THEME, THEME_KEY, THEME_REGISTRY } from '@/lib/theme';
import { applyFont, getFontPreference, FontPreference, FONT_KEY } from '@/Lib/font';

export function ThemeToggle() {
    const [currentTheme, setCurrentTheme] = React.useState<string>(SYSTEM_THEME);
    const [currentFont, setCurrentFont] = React.useState<FontPreference>('ibm-plex');
    const [language, setLanguage] = React.useState<'ar' | 'en'>('ar');
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        setCurrentTheme(getThemePreference());
        setCurrentFont(getFontPreference());
        const savedLang = localStorage.getItem('sz-language') as 'ar' | 'en' || 'ar';
        setLanguage(savedLang);

        // data-theme and data-font hold current selections
        const observer = new MutationObserver(() => {
            setCurrentTheme(getThemePreference());
            setCurrentFont(getFontPreference());
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-font'] });

        // cross-tab sync
        const onStorage = (e: StorageEvent) => {
            if (e.key === THEME_KEY) setCurrentTheme(getThemePreference());
            if (e.key === FONT_KEY) setCurrentFont(getFontPreference());
            if (e.key === 'sz-language') {
                const savedLang = localStorage.getItem('sz-language') as 'ar' | 'en' || 'ar';
                setLanguage(savedLang);
            }
        };
        window.addEventListener('storage', onStorage);

        return () => {
            observer.disconnect();
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-accent/50">
                <Sun className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Toggle theme</span>
            </Button>
        );
    }

    const activeThemeConfig = THEME_REGISTRY.find(t => t.id === currentTheme) || THEME_REGISTRY[0];
    const ThemeIcon = activeThemeConfig.icon;
    const isAr = language === 'ar';

    return (
        <DropdownMenu dir={isAr ? 'rtl' : 'ltr'}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full hover:bg-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                    title={isAr ? `المظهر والخط` : `Theme & Font`}
                >
                    <ThemeIcon className="h-[1.2rem] w-[1.2rem] transition-all" />
                    <span className="sr-only">Toggle theme & font</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-[80vh] overflow-y-auto">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {isAr ? 'المظهر' : 'Theme'}
                </DropdownMenuLabel>
                {THEME_REGISTRY.map((t) => {
                    const ItemIcon = t.icon;
                    const isActive = currentTheme === t.id;
                    return (
                        <DropdownMenuItem
                            key={t.id}
                            onClick={() => {
                                applyTheme(t.id);
                                setCurrentTheme(t.id);
                            }}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-sm",
                                isActive && "bg-accent text-accent-foreground font-semibold"
                            )}
                        >
                            <ItemIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">{t.emoji} {isAr ? t.nameAr : t.nameEn}</span>
                            {isActive && <span className="text-xs">✓</span>}
                        </DropdownMenuItem>
                    );
                })}

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {isAr ? 'خط الموقع' : 'Site Font'}
                </DropdownMenuLabel>
                <DropdownMenuItem
                    onClick={() => {
                        applyFont('ibm-plex');
                        setCurrentFont('ibm-plex');
                    }}
                    className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-sm",
                        currentFont === 'ibm-plex' && "bg-accent text-accent-foreground font-semibold"
                    )}
                >
                    <Type className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{isAr ? 'IBM Plex Sans Arabic' : 'IBM Plex Sans'}</span>
                    {currentFont === 'ibm-plex' && <span className="text-xs">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        applyFont('system');
                        setCurrentFont('system');
                    }}
                    className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-sm",
                        currentFont === 'system' && "bg-accent text-accent-foreground font-semibold"
                    )}
                >
                    <Type className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{isAr ? 'خط النظام الافتراضي' : 'System Font'}</span>
                    {currentFont === 'system' && <span className="text-xs">✓</span>}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
