const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['android/**', 'ios/**', 'coverage/**', 'dist/**'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@inertiajs/*',
                '@radix-ui/*',
                'maplibre-gl',
                'leaflet',
                'react-dom',
                'react-chartjs-2',
                'recharts',
              ],
              message: 'Use the native mapping recorded in PORTING.md.',
            },
          ],
        },
      ],
    },
  },
]);
