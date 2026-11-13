// Lint gate: only rules that catch real bugs the type checker cannot see.
// rules-of-hooks fails a hook called after an early return or in a branch
// (the Tarneeb/Trix crash, React error #310). Style is not linted.
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['public/**', 'bootstrap/**', 'vendor/**', 'node_modules/**', 'storage/**', 'mobile*/**', 'graphify-out/**', 'study/**', 'syrianzonepp/**'] },
  {
    files: ['resources/js/**/*.{ts,tsx,js,jsx}'],
    languageOptions: { parser: tseslint.parser },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
];
