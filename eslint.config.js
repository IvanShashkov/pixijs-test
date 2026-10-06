import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const noReact = {
  'no-restricted-imports': [
    'error',
    {
      paths: [
        { name: 'react', message: 'Game code is pure Pixi/TS. React is only the mount shell.' },
        { name: 'react-dom', message: 'Game code is pure Pixi/TS. React is only the mount shell.' },
      ],
    },
  ],
};

export default defineConfig([
  globalIgnores(['dist', 'node_modules', '.claude/skills', 'e2e/test-results', 'e2e/screenshots']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    // The React shell: hooks + fast-refresh rules apply only here.
    files: ['src/app/**', 'src/canvas/**', 'src/main.tsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Everything that is the game proper must stay React-free; zustand is the only bridge.
    files: ['src/game/**', 'src/i18n/**', 'src/stores/**', 'src/assets/**', 'src/config.ts'],
    rules: noReact,
  },
  {
    // Pure logic: no Pixi either, so it stays unit-testable in node.
    files: ['src/game/board/**', 'src/game/loot/**', 'src/i18n/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Pure module.' },
            { name: 'pixi.js', message: 'Board/loot/i18n logic must not import Pixi.' },
            { name: '@pixi/ui', message: 'Board/loot/i18n logic must not import Pixi.' },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
]);
