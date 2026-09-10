'use client';

import React from 'react';
import axios from '@/lib/axios';
import { Link } from '@inertiajs/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, LogOut, User as UserIcon, LayoutDashboard } from "lucide-react";
import { useAuth } from '@/Contexts/AuthContext';
import { applyTheme, getThemePreference, THEME_REGISTRY } from '@/lib/theme';
import { applyFont, getFontPreference, FontPreference } from '@/Lib/font';

const FONT_OPTIONS: Array<[FontPreference, string]> = [
    ['ibm-plex', 'Plex'],
    ['system', 'محلي'],
];

export default function UserNav() {
    const { user } = useAuth();
    const [currentTheme, setCurrentTheme] = React.useState<string>(getThemePreference());
    const [currentFont, setCurrentFont] = React.useState<FontPreference>(getFontPreference());

    // Stay in sync when the theme/font change elsewhere (swatches, other menus).
    React.useEffect(() => {
        const sync = () => {
            setCurrentTheme(getThemePreference());
            setCurrentFont(getFontPreference());
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-font'] });
        return () => observer.disconnect();
    }, []);

    const handleThemeChange = (themeId: string) => {
        applyTheme(themeId);
        setCurrentTheme(themeId);
        axios.post('/api/user/settings', { settings: { theme: themeId } }).catch(() => {});
    };

    const handleFontChange = (font: FontPreference) => {
        applyFont(font);
        setCurrentFont(font);
        axios.post('/api/user/settings', { settings: { fontFamily: font } }).catch(() => {});
    };

    const logout = () => {
        axios.post('/logout').then(() => {
            window.location.reload();
        });
    };

    if (!user) {
        return null;
    }

    const circleThemes = THEME_REGISTRY.filter((t) => t.group !== 'heritage');
    const heritageThemes = THEME_REGISTRY.filter((t) => t.group === 'heritage');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                    <Avatar className="h-10 w-10 border border-border/50">
                        <AvatarImage src={user.avatar_url} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="ml-2 h-4 w-4" />
                        <span>لوحة التحكم</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/dashboard?tab=profile" className="cursor-pointer">
                        <UserIcon className="ml-2 h-4 w-4" />
                        <span>الملف الشخصي</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={logout}>
                    <LogOut className="ml-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
