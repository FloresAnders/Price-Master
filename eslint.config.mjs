import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // Allow `any` in places the codebase currently uses it.
      "@typescript-eslint/no-explicit-any": "off",
      // Allow ts-ignore / ts-comment usage; prefer ts-expect-error but don't fail the build.
      "@typescript-eslint/ban-ts-comment": "off",
      // Don't fail the build on unused variables; warn instead.
      "@typescript-eslint/no-unused-vars": "warn",
      // Keep react-hooks warnings as warnings (not errors).
      "react-hooks/exhaustive-deps": "warn",
      // Allow unused vars that start with underscore
      "no-unused-vars": "off",
    },
  },
];

export default eslintConfig;
