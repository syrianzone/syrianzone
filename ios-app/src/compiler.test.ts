import { expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');

const result = babel.transformFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), {
  babelrc: false,
  configFile: false,
  envName: 'production',
  presets: ['babel-preset-expo'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
  caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true }
});
const code = result?.code;
if (!code) throw new Error('Production compiler returned no code.');

test('production-compiled app renders its first memoized tree without shadowing global Symbol', () => {
  expect(code).toContain('react.memo_cache_sentinel');
  const jsx = (type: unknown, props: unknown): { type: unknown; props: unknown } => ({ type, props });
  const module = { exports: {} as { default?: () => { type: unknown } } };
  runInNewContext(code, {
    module,
    exports: module.exports,
    Symbol,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/helpers/')) return requireFromApp(name);
      if (name === 'react/compiler-runtime') return { c: (size: number) => Array(size).fill(Symbol.for('react.memo_cache_sentinel')) };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({}) };
      if (name === '@react-navigation/bottom-tabs/unstable') return { createNativeBottomTabNavigator: () => ({}) };
      if (name === 'react-native-safe-area-context') return { SafeAreaProvider: 'safe-area' };
      if (name === './ui/native') return { Symbol: () => null, NativeSymbol: () => null };
      return {};
    }
  });
  expect(module.exports.default?.().type).toBe('safe-area');
});
