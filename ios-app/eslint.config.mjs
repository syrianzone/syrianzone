import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['node_modules/**', 'ios/**', '.expo/**', 'dist/**'] },
  ...tseslint.configs.recommended,
  { files: ['*.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-shadow': ['error', { builtinGlobals: true }],
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
);
