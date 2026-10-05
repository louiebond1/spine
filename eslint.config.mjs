import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: [".next/**", "node_modules/**", ".pgdata/**", "scripts/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.{ts,tsx}", "prisma/seed/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Use now() from @/server/clock so SPINE_TODAY is respected.",
        },
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: "Use now() from @/server/clock so SPINE_TODAY is respected.",
        },
      ],
    },
  },
  {
    files: ["src/server/clock.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
];
