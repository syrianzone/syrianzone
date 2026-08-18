// Global type declarations for browser globals injected by the GA gtag snippet.
// Stylesheet side-effect imports are handled by Vite, not tsc.
declare module '*.css';

interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
}
