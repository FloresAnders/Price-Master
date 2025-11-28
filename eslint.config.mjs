import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  // Project-specific rule overrides to reduce strict build-time failures.
  rules: {
    // Allow `any` in places the codebase currently uses it.
    "@typescript-eslint/no-explicit-any": "off",
    // Allow ts-ignore / ts-comment usage; prefer ts-expect-error but don't fail the build.
    "@typescript-eslint/ban-ts-comment": "off",
    // Don't fail the build on unused variables; warn instead.
    "@typescript-eslint/no-unused-vars": "warn",
    // Keep react-hooks warnings as warnings (not errors).
    "react-hooks/exhaustive-deps": "warn",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
}];

export default eslintConfig;
