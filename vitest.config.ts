import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// The pure game libraries are the reason this runner exists: rules live under
// Pages/Games/_lib with no React import, so they can be tested directly. The
// alias map mirrors vite.config.js and tsconfig.json so a test can import the
// same `@/...` paths the components use.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
    },
  },
  test: {
    include: ['resources/js/**/*.test.ts', 'scripts/og/**/*.test.ts'],
    environment: 'node',
  },
});
