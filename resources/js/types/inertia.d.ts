import '@inertiajs/react';

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
