import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/lib'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },
  {
    files: ['server/**/*.ts', 'types/**/*.ts', 'client-3d/scripts/**/*.mjs', 'client-3d/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/**/*.{ts,tsx}', 'client-3d/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // react-three-fiber animates by mutating three.js objects (and plain objects read in
    // useFrame) outside of React's render, which is exactly what this rule forbids
    files: ['client-3d/src/**/*.{ts,tsx}'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  prettier
)
