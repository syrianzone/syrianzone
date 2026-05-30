import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            '@/lib': fileURLToPath(new URL('./resources/js/Lib', import.meta.url)),
            '@/components': fileURLToPath(new URL('./resources/js/Components', import.meta.url)),
            '@/context': fileURLToPath(new URL('./resources/js/Contexts', import.meta.url)),
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
});
