import React, { Suspense, useEffect, useState } from 'react';
import { AuthProvider } from '@/Contexts/AuthContext';
import ConditionalLayout from '@/Components/ConditionalLayout';
import RadioMiniPlayer from '@/Components/RadioMiniPlayer';
import ConfirmHost from '@/Components/ConfirmHost';
import RouteAnnouncer from '@/Components/RouteAnnouncer';
import AnalyticsConsentBanner from '@/Components/AnalyticsConsentBanner';
import SeoHead from '@/Components/SeoHead';
import { Toaster } from '@/Components/ui/sonner';
import { useUsageTracker } from '@/Domain/quran/usageStore';
import SettingsSync from '@/Domain/settings/SettingsSync';
import { focusInlineSearch, useAppShell } from '@/Lib/appShell';

const GlobalCommandPalette = React.lazy(() => import('@/Components/GlobalCommandPalette'));

/** Mount the palette a few seconds after load if nothing asked for it sooner. */
const PALETTE_IDLE_TIMEOUT_MS = 3000;

/**
 * The palette is a large search UI that only does work once opened, so it is
 * mounted after the page is idle instead of on every page. The first open still
 * works: an open request in the store, or the Ctrl/Cmd+K shortcut before the
 * chunk arrives, mounts it immediately and the store keeps the request so the
 * palette opens as soon as it is ready.
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

    useEffect(() => {
        const w = window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
            cancelIdleCallback?: (id: number) => void;
        };
        if (typeof w.requestIdleCallback === 'function') {
            const id = w.requestIdleCallback(() => setMounted(true), { timeout: PALETTE_IDLE_TIMEOUT_MS });
            return () => w.cancelIdleCallback?.(id);
        }
        const id = window.setTimeout(() => setMounted(true), PALETTE_IDLE_TIMEOUT_MS);
        return () => window.clearTimeout(id);
    }, []);

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
            <SettingsSync />
            <DeferredCommandPalette />
            <RadioMiniPlayer />
            {/* One feedback language for the whole app: toasts + confirmations. */}
            <Toaster />
            <ConfirmHost />
            {/* Mounted once here so every layout (incl. the full-screen transit
                map and studio) gets the analytics consent card exactly once. */}
            <AnalyticsConsentBanner />
            <RouteAnnouncer />
        </AuthProvider>
    );
}
