import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', '*.tsbuildinfo', 'vite.config.js', 'vite.config.d.ts', '.remember/', '.claude/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript resolves browser and Node globals more accurately than ESLint's
      // core rule, so avoid false positives in browser-facing modules.
      'no-undef': 'off',
      ...reactHooks.configs.recommended.rules,
    },
  }
)
