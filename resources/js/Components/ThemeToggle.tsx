'use client';

import * as React from 'react';
import { Moon, Sun, Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

const themes = [
    { id: 'light', name: 'Light', icon: Sun, color: 'bg-white border' },
    { id: 'dark', name: 'Dark', icon: Moon, color: 'bg-[#0D1315]' },
    { id: 'dark-blue', name: 'Dark Blue', icon: Palette, color: 'bg-[#0a0e1a]' },
    { id: 'dark-purple', name: 'Dark Purple', icon: Palette, color: 'bg-[#0d0a14]' },
    { id: 'dark-green', name: 'Dark Green', icon: Palette, color: 'bg-[#0a0f0a]' },
    { id: 'high-contrast', name: 'High Contrast', icon: Palette, color: 'bg-black border border-green-500' },
];

export function ThemeToggle() {
    const [currentTheme, setCurrentTheme] = React.useState<string>('dark');
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        const savedTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        setCurrentTheme(savedTheme);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const newTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                    setCurrentTheme(newTheme);
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    const cycleTheme = () => {
        const currentIndex = themes.findIndex(t => t.id === currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        const nextTheme = themes[nextIndex];

        document.documentElement.setAttribute('data-theme', nextTheme.id);
        localStorage.setItem('sz-theme', nextTheme.id);
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

    // Find current theme object to display its icon or a generic one
    // We'll use the icon of the current theme to represent "Current mode", or maybe the NEXT mode? 
    // Usually a toggle shows what you ARE in, or acts as a button to the other.
    // Let's just show the icon of the current active theme.
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
