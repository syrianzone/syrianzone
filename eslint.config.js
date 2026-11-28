// Lint gate: zero-noise rules that catch real bugs and enforce core boundaries
// the type checker cannot see. Style is not linted.
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['public/**', 'bootstrap/**', 'vendor/**', 'node_modules/**', 'storage/**', 'mobile*/**', 'graphify-out/**', 'study/**', 'syrianzonepp/**'] },
  {
    files: ['resources/js/**/*.{ts,tsx,js,jsx}'],
    languageOptions: { parser: tseslint.parser },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'no-alert': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'Use resources/js/Lib/api.ts instead of importing axios directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['resources/js/Lib/api.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
