import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  // Project-specific rule overrides to reduce strict build-time failures.
  rules: {
    // Allow `any` in places the codebase currently uses it.
    "@typescript-eslint/no-explicit-any": "off",
    // Allow ts-ignore / ts-comment usage; prefer ts-expect-error but don't fail the build.
    "@typescript-eslint/ban-ts-comment": "off",
    // Don't fail the build on unused variables; warn instead. Names prefixed
    // with `_` are intentional (placeholder args, ignored catches).
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    // Keep react-hooks warnings as warnings (not errors).
    "react-hooks/exhaustive-deps": "warn",
    // React Compiler is NOT enabled in this project (no babel-plugin-react-compiler
    // / reactCompiler config), so its lint rules are advisory here. Keep them as
    // warnings instead of build-failing errors.
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/preserve-manual-memoization": "warn",
  },
}, {
  // Node scripts are CommonJS utilities run with `node`, not bundled by Next.
  // `require()` and `console` are expected there.
  files: ["scripts/**/*.js", "functions/**/*.js"],
  rules: {
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-unused-vars": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
}];

export default eslintConfig;
