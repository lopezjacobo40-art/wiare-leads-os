import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist + scripts de prueba sueltos + proyectos ajenos anidados en el repo
  globalIgnores([
    'dist',
    'test_*.ts',
    'test_*.mjs',
    'bocateria-zarautz/**',
    'san-francisco-33-app/**',
    'presentacion_zarautz_netlify/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Permite el idiom `const { campoAExcluir: _, ...resto } = obj`
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
])
