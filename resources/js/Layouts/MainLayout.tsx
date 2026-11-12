import React, { Suspense, useEffect, useState } from 'react';
import { AuthProvider } from '@/Contexts/AuthContext';
import ConditionalLayout from '@/Components/ConditionalLayout';
import GlobalRuntime from '@/Components/GlobalRuntime';
import RadioMiniPlayer from '@/Components/RadioMiniPlayer';
import ConfirmHost from '@/Components/ConfirmHost';
import RouteAnnouncer from '@/Components/RouteAnnouncer';
import AnalyticsConsentBanner from '@/Components/AnalyticsConsentBanner';
import SeoHead from '@/Components/SeoHead';
import { Toaster } from '@/Components/ui/sonner';
import SettingsSync from '@/Pages/Muslim/_components/SettingsSync';
import { useMuslimNav } from '@/Pages/Muslim/_lib/nav';

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
    const open = useMuslimNav((s) => s.searchOpen);

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

    // The shortcut listener lives inside the palette, so mirror it until the
    // palette is mounted; otherwise the very first Ctrl/Cmd+K would be lost.
    useEffect(() => {
        if (mounted) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
            e.preventDefault();
            if (window.location.pathname === '/') {
                const homeInput = document.getElementById('sz-home-inline-search') as HTMLInputElement | null;
                if (homeInput) {
                    homeInput.focus();
                    homeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
            }
            useMuslimNav.getState().setSearchOpen(true);
            setMounted(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mounted]);

    if (!mounted) return null;

    return (
        <Suspense fallback={null}>
            <GlobalCommandPalette />
        </Suspense>
    );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SeoHead />
            <ConditionalLayout>
                {children}
            </ConditionalLayout>
            <SettingsSync />
            <DeferredCommandPalette />
            <GlobalRuntime />
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
