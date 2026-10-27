import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

/**
 * Features import each other only through their public parts: `services` (API instances), `model` and `*Api` (types),
 * `events` (live events), `*Section.svelte` (sections shown in settings, the start page or another record) and, between mock
 * modules, `mock`. Everything else in a feature folder is private to it.
 */
const FEATURE_PRIVATE = String.raw`^\.\./(?!lib/)[a-z]+/(?!(services|model|events|mock|mockSeeds|[A-Z]\w*Api|[A-Z]\w*Section\.svelte)$)[^/]+$`;

export default ts.config(
  // The Svelte parser does not read member expressions in directives (`transition:motion.fade`) yet.
  {
    ignores: [
      'dist',
      'node_modules',
      'src/lib/api/schema.d.ts',
      'src/ui/CommandPalette.svelte',
      'src/ui/DataTable.svelte',
      'src/ui/Sidebar.svelte',
      'src/ui/Toasts.svelte',
      'src/ui/WindowHost.svelte',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Local Maps, Sets and Dates in components are plain values on purpose; reactive state uses $state.
      'svelte/prefer-svelte-reactivity': 'off',
      // The ignores silence svelte-check warnings (e.g. state_referenced_locally) this plugin does not know about.
      'svelte/no-unused-svelte-ignore': 'off',
      // An explicit children snippet keeps the wrapped markup visibly inside its component.
      'svelte/no-useless-children-snippet': 'off',
    },
  },
  {
    // Mocks, tests, the bus and the transport handle untyped JSON and payloads like the wire does.
    files: ['**/mock*.ts', '**/*.test.ts', 'src/lib/bus/**', 'src/lib/http/**', 'src/lib/mock/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    // Counters in <script module> are read by every instance; the rule sees only one.
    rules: { 'no-useless-assignment': 'off' },
  },
  {
    files: ['src/features/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: FEATURE_PRIVATE, message: 'Import another feature only through its public parts (see eslint.config.js).' }] },
      ],
    },
  },
);
