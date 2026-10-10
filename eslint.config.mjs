import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default ts.config(
  {
    ignores: [
      ".next/**",
      ".next-production/**",
      ".next-local/**",
      ".next-remote/**",
      "node_modules/**",
      ".npm-cache/**",
      ".qa/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
    },
  },
);
