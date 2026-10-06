import type { Config } from "tailwindcss";

// Design tokens sampled from /design at 1536x1024 (see PLAN.md "Design tokens").
// Theme keys below REPLACE Tailwind's defaults, so anything off-token fails to build.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Colours are CSS variables (src/app/globals.css) so each person can pick light or dark and an
    // accent in Your settings. The defaults are the values sampled from the mockups.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      background: "rgb(var(--background) / <alpha-value>)",
      surface: "rgb(var(--surface) / <alpha-value>)",
      border: "rgb(var(--border) / <alpha-value>)",
      text: "rgb(var(--text) / <alpha-value>)",
      "text-muted": "rgb(var(--text-muted) / <alpha-value>)",
      brand: "rgb(var(--brand) / <alpha-value>)",
      "brand-hover": "rgb(var(--brand-hover) / <alpha-value>)",
      "brand-soft": "rgb(var(--brand-soft) / <alpha-value>)",
      "on-brand": "rgb(var(--on-brand) / <alpha-value>)",
      "neutral-soft": "rgb(var(--neutral-soft) / <alpha-value>)",
      live: "rgb(var(--live) / <alpha-value>)",
      // Logo mark only: the lighter end of the bar gradient in 01-home.png.
      "logo-light": "rgb(var(--logo-light) / <alpha-value>)",
    },
    fontFamily: {
      sans: ["var(--font-inter)", "system-ui", "sans-serif"],
    },
    fontSize: {
      tiny: ["calc(12px * var(--text-scale, 1))", { lineHeight: "calc(16px * var(--text-scale, 1))" }],
      eyebrow: ["calc(12px * var(--text-scale, 1))", { lineHeight: "calc(16px * var(--text-scale, 1))", letterSpacing: "0.08em" }],
      label: ["calc(13px * var(--text-scale, 1))", { lineHeight: "calc(18px * var(--text-scale, 1))" }],
      meta: ["calc(15px * var(--text-scale, 1))", { lineHeight: "calc(22px * var(--text-scale, 1))" }],
      date: ["calc(15px * var(--text-scale, 1))", { lineHeight: "calc(22px * var(--text-scale, 1))" }],
      body: ["calc(15px * var(--text-scale, 1))", { lineHeight: "calc(24px * var(--text-scale, 1))" }],
      "row-title": ["calc(16px * var(--text-scale, 1))", { lineHeight: "calc(24px * var(--text-scale, 1))" }],
      section: ["calc(20px * var(--text-scale, 1))", { lineHeight: "calc(28px * var(--text-scale, 1))" }],
      score: ["calc(32px * var(--text-scale, 1))", { lineHeight: "calc(36px * var(--text-scale, 1))" }],
      logo: ["calc(26px * var(--text-scale, 1))", { lineHeight: "calc(32px * var(--text-scale, 1))", letterSpacing: "-0.02em" }],
      headline: ["calc(34px * var(--text-scale, 1))", { lineHeight: "calc(42px * var(--text-scale, 1))", letterSpacing: "-0.02em" }],
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    borderRadius: {
      none: "0",
      sm: "4px",
      control: "10px",
      container: "12px",
      full: "9999px",
    },
    borderWidth: {
      DEFAULT: "1px",
      0: "0",
      2: "2px",
    },
    boxShadow: {
      none: "none",
    },
    extend: {
      spacing: {
        sidebar: "248px",
        "search-inset": "160px",
        "new-button": "128px",
        topbar: "68px",
        control: "42px",
        tile: "52px",
        action: "116px",
        avatar: "40px",
        "avatar-sm": "32px",
        rail: "296px",
        panel: "420px",
        "step-title": "420px",
      },
      gridTemplateColumns: {
        // Propose form RESOURCES row: four selects and a wider target date (04).
        resources: "repeat(4, minmax(0, 1fr)) 15rem",
        // Ideas & Projects List view: title, owner, stage, build path, next action.
        projects: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.9fr) minmax(0, 2fr)",
      },
      maxHeight: {
        // Start with Spine coaching conversation.
        coach: "60vh",
      },
      maxWidth: {
        content: "1180px",
        narrow: "900px",
        search: "560px",
        modal: "640px",
      },
    },
  },
  plugins: [],
};

export default config;
