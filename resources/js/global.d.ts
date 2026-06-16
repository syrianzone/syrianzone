// Global type declarations for browser globals injected by the GA gtag snippet.
interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
}
