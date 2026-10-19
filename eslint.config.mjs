import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: [".next/**", "node_modules/**", ".pgdata/**", "scripts/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.{ts,tsx}", "prisma/seed/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Plain apostrophes and quotes in copy render correctly; escaping them hurts readability.
      "react/no-unescaped-entities": "off",
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
    // Security timing (sessions, invitations, rate limits, audit, admin "last seen") and AI call
    // durations must use the real clock, even when SPINE_TODAY freezes the app's business clock.
    files: ["src/server/clock.ts", "src/server/auth/**", "src/server/people/**", "src/server/ai/client.ts", "src/app/(app)/admin/**"],
    rules: { "no-restricted-syntax": "off" },
  },
];
