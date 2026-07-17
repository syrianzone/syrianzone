// Global type declarations for browser globals injected by the GA gtag snippet.
// Stylesheet side-effect imports are handled by Vite, not tsc.
declare module '*.css';

interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
}

// Shared Inertia page props injected by HandleInertiaRequests.
interface DevProps {
    enabled: boolean;
    roles: string[];
    currentRole: string | null;
}

declare module '@inertiajs/react' {
    interface PageProps {
        dev?: DevProps;
    }
}

