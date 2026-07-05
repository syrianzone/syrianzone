'use client';

import * as React from 'react';
import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { applyTheme, getThemePreference, SYSTEM_THEME, THEME_KEY, THEME_REGISTRY } from '@/lib/theme';

export function ThemeToggle() {
    const [currentTheme, setCurrentTheme] = React.useState<string>(SYSTEM_THEME);
    const [language, setLanguage] = React.useState<'ar' | 'en'>('ar');
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        setCurrentTheme(getThemePreference());
        const savedLang = localStorage.getItem('sz-language') as 'ar' | 'en' || 'ar';
        setLanguage(savedLang);

        // data-theme holds the resolved theme, so re-read the preference when it changes
        const observer = new MutationObserver(() => setCurrentTheme(getThemePreference()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // cross-tab sync
        const onStorage = (e: StorageEvent) => {
            if (e.key === THEME_KEY) setCurrentTheme(getThemePreference());
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
                    title={isAr ? `المظهر الحالي: ${activeThemeConfig.nameAr}` : `Current theme: ${activeThemeConfig.nameEn}`}
                >
                    <ThemeIcon className="h-[1.2rem] w-[1.2rem] transition-all" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 max-h-[80vh] overflow-y-auto">
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
                                "flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm",
                                isActive && "bg-accent text-accent-foreground font-semibold"
                            )}
                        >
                            <ItemIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">{t.emoji} {isAr ? t.nameAr : t.nameEn}</span>
                            {isActive && <span className="text-xs">✓</span>}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
