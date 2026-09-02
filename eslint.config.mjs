import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Configuration volontairement sobre : elle vise les erreurs qui cassent
 * réellement (variables inexistantes, hooks React mal appelés, promesses
 * ignorées côté typage) plutôt que le style. Le code existant utilise `any`
 * de façon assumée sur les réponses FedaPay — la règle est désactivée.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'mobile/**',
      'landing_page/**',
      'image_template_exemple/**',
      '**/*.config.js',
      '**/*.config.cjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // Front-end React : frontend/ et Dashboard/
  {
    files: ['frontend/**/*.{ts,tsx}', 'Dashboard/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        WebSocket: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Service worker : contexte d'exécution à part (pas de `window`).
  {
    files: ['frontend/public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        console: 'readonly',
      },
    },
  },

  // Back-end Node
  {
    files: ['backend/**/*.ts', 'backend/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        NodeJS: 'readonly',
      },
    },
  },
);
