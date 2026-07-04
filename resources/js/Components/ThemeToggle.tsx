'use client';

import * as React from 'react';
import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTheme, getThemePreference, SYSTEM_THEME, THEME_KEY } from '@/lib/theme';

const themes = [
    { id: SYSTEM_THEME, name: 'System', icon: Monitor },
    { id: 'light', name: 'Light', icon: Sun },
    { id: 'dark', name: 'Dark', icon: Moon },
    { id: 'dark-blue', name: 'Dark Blue', icon: Palette },
    { id: 'dark-purple', name: 'Dark Purple', icon: Palette },
    { id: 'dark-green', name: 'Dark Green', icon: Palette },
    { id: 'high-contrast', name: 'High Contrast', icon: Palette },
];

export function ThemeToggle() {
    const [currentTheme, setCurrentTheme] = React.useState<string>(SYSTEM_THEME);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        setCurrentTheme(getThemePreference());

        // data-theme holds the resolved theme, so re-read the preference when it changes
        const observer = new MutationObserver(() => setCurrentTheme(getThemePreference()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // cross-tab sync
        const onStorage = (e: StorageEvent) => {
            if (e.key === THEME_KEY) setCurrentTheme(getThemePreference());
        };
        window.addEventListener('storage', onStorage);

        return () => {
            observer.disconnect();
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    const cycleTheme = () => {
        const currentIndex = themes.findIndex(t => t.id === currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        applyTheme(nextTheme.id);
        setCurrentTheme(nextTheme.id);
    };

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-accent/50">
                <Sun className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Toggle theme</span>
            </Button>
        );
    }

    const activeThemeConfig = themes.find(t => t.id === currentTheme) || themes[0];
    const ThemeIcon = activeThemeConfig.icon;

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full hover:bg-accent/50"
            onClick={cycleTheme}
            title={`Current theme: ${activeThemeConfig.name}. Click to cycle.`}
        >
            <ThemeIcon className="h-[1.2rem] w-[1.2rem] transition-all" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
