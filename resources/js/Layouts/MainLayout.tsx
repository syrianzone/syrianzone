import React, { Suspense, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { AuthProvider, useAuth } from '@/Contexts/AuthContext';
import ConditionalLayout from '@/Components/ConditionalLayout';
import RouteAnnouncer from '@/Components/RouteAnnouncer';
import AnalyticsConsentBanner from '@/Components/AnalyticsConsentBanner';
import SeoHead from '@/Components/SeoHead';
import { Toaster } from '@/Components/ui/sonner';
import { useUsageTracker } from '@/Domain/quran/usageStore';
import { focusInlineSearch, useAppShell } from '@/Lib/appShell';
import { onConfirmRequested } from '@/Lib/confirm';
import { isUnderPath, pathnameOf } from '@/Lib/routes';

const loadCommandPalette = () => import('@/Components/GlobalCommandPalette');
const GlobalCommandPalette = React.lazy(loadCommandPalette);
const ConfirmHost = React.lazy(() => import('@/Components/ConfirmHost'));
const SettingsSync = React.lazy(() => import('@/Domain/settings/SettingsSyncView'));
const RadioMiniPlayer = React.lazy(() => import('@/Domain/quran/RadioMiniPlayer'));

/** Warm the command palette chunk on hover/focus of a search trigger. */
export function prefetchCommandPalette(): void {
    void loadCommandPalette();
}

/** Mounts ConfirmHost only once confirmDialog() is actually invoked. */
function DeferredConfirmHost() {
    const [needed, setNeeded] = useState(false);

    useEffect(() => {
        if (needed) return;
        return onConfirmRequested(() => setNeeded(true));
    }, [needed]);

    if (!needed) return null;

    return (
        <Suspense fallback={null}>
            <ConfirmHost />
        </Suspense>
    );
}

/** Mounts SettingsSync only for signed-in visitors. */
function AuthOnlySettingsSync() {
    const { user } = useAuth();
    if (!user?.id) return null;

    return (
        <Suspense fallback={null}>
            <SettingsSync />
        </Suspense>
    );
}

/**
 * Mounts RadioMiniPlayer lazily only once the visitor has entered /muslim
 * (the only section that can start Quran radio), then keeps it mounted across
 * subsequent Inertia navigations so playback persists everywhere.
 */
function DeferredRadioMiniPlayer() {
    const { url } = usePage();
    const inMuslim = isUnderPath(pathnameOf(url), '/muslim');
    const [activated, setActivated] = useState(inMuslim);

    useEffect(() => {
        if (inMuslim && !activated) setActivated(true);
    }, [inMuslim, activated]);

    if (!activated) return null;

    return (
        <Suspense fallback={null}>
            <RadioMiniPlayer />
        </Suspense>
    );
}

/**
 * The palette is a large search UI that only does work once opened, so it is
 * loaded strictly on demand (open trigger, Ctrl/Cmd+K, or hover prefetch).
 *
 * Nothing is rendered on the server or on the first client render, so SSR and
 * hydration stay identical.
 */
function DeferredCommandPalette() {
    const [mounted, setMounted] = useState(false);
    const open = useAppShell((s) => s.searchOpen);
    const setSearchOpen = useAppShell((s) => s.setSearchOpen);

    // Mounted on demand: the navbar trigger or the shortcut sets `searchOpen`.
    useEffect(() => {
        if (open) setMounted(true);
    }, [open]);

    // The one Ctrl/Cmd+K handler for the app. A page that renders an inline
    // search field (the homepage) registers its focus function in the store, so
    // the shortcut focuses that field instead of opening the palette; with no
    // registered field it toggles the palette. Living here, above the lazy
    // chunk, means the first keypress is never lost.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
            e.preventDefault();
            if (focusInlineSearch()) return;
            if (!mounted) {
                // Keep the open request so the palette opens once it arrives.
                setSearchOpen(true);
                setMounted(true);
                return;
            }
            setSearchOpen(!useAppShell.getState().searchOpen);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mounted, setSearchOpen]);

    if (!mounted) return null;

    return (
        <Suspense fallback={null}>
            <GlobalCommandPalette />
        </Suspense>
    );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
    // Starts the global listening-usage tracker, once per app.
    useUsageTracker();

    return (
        <AuthProvider>
            <SeoHead />
            <ConditionalLayout>
                {children}
            </ConditionalLayout>
            <AuthOnlySettingsSync />
            <DeferredCommandPalette />
            <DeferredRadioMiniPlayer />
            {/* One feedback language for the whole app: toasts + confirmations. */}
            <Toaster />
            <DeferredConfirmHost />
            {/* Mounted once here so every layout (incl. the full-screen transit
                map and studio) gets the analytics consent card exactly once. */}
            <AnalyticsConsentBanner />
            <RouteAnnouncer />
        </AuthProvider>
    );
}
