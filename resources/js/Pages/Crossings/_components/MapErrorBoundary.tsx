import React from 'react';

/**
 * MapLibre throws from inside its constructor when the browser cannot give it a
 * WebGL context — hardware acceleration switched off, an older device, a locked
 * down machine. That throw happens in an effect, so without a boundary React
 * unmounts the whole page and the table goes down with the map. The table is the
 * view that answers the question, so it has to survive a map that cannot start.
 */
export class MapErrorBoundary extends React.Component<
    { children: React.ReactNode; className?: string },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        console.error('[CrossingsMap] failed to start', error);
    }

    render() {
        if (this.state.failed) {
            return (
                <div className={this.props.className}>
                    <div className="flex h-full w-full items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground">
                        تعذّر تحميل الخريطة على هذا الجهاز. الجدول يعمل بشكل طبيعي.
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
