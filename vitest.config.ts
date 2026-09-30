import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// The pure game libraries are the reason this runner exists: rules live under
// Pages/Games/_lib with no React import, so they can be tested directly. The
// alias map mirrors vite.config.js so a test can import the same `@/...` paths
// the components use.
export default defineConfig({
  resolve: {
    alias: {
      '@/lib': fileURLToPath(new URL('./resources/js/Lib', import.meta.url)),
      '@/components': fileURLToPath(new URL('./resources/js/Components', import.meta.url)),
      '@/context': fileURLToPath(new URL('./resources/js/Contexts', import.meta.url)),
      '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
    },
  },
  test: {
    include: ['resources/js/**/*.test.ts'],
    environment: 'node',
  },
});
