import { Suspense, type ReactNode } from 'react';
import { DirectionProvider } from '@radix-ui/react-direction';
import { QueryProvider } from '@/Providers/QueryProvider';

/**
 * The provider tree around the Inertia app. The browser entry hydrates the
 * markup the SSR entry rendered, so both must build exactly this tree: one
 * component, imported by both, keeps them from drifting apart.
 *
 * The Suspense fallback only shows while a lazily resolved page chunk loads
 * on the client (never on the server, where pages resolve eagerly).
 */
export function AppRoot({ children }: { children: ReactNode }) {
    return (
        <DirectionProvider dir="rtl">
            <QueryProvider>
                <Suspense
                    fallback={
                        <div className="flex h-dvh w-full items-center justify-center text-muted-foreground">
                            جاري التحميل...
                        </div>
                    }
                >
                    {children}
                </Suspense>
            </QueryProvider>
        </DirectionProvider>
    );
}
