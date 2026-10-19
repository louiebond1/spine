import type { Config } from "tailwindcss";

// Spine 2.0 design tokens. Colours are RGB channels in src/app/globals.css.
// Theme keys REPLACE Tailwind's defaults, so anything off-token fails to build, and
// scripts/guard.mjs rejects hex/rgb literals and arbitrary values in components.
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      // Workspace
      background: c("canvas"),
      surface: c("surface"),
      subtle: c("subtle"),
      "neutral-soft": c("subtle"),
      border: c("border"),
      "border-strong": c("border-strong"),
      text: c("text"),
      "text-muted": c("text-muted"),
      "text-faint": c("text-faint"),
      // Accent
      brand: c("brand"),
      "brand-hover": c("brand-hover"),
      "brand-soft": c("brand-soft"),
      "on-brand": c("on-brand"),
      // Navigation (dark navy sidebar)
      nav: c("nav"),
      "nav-raised": c("nav-raised"),
      "nav-border": c("nav-border"),
      "nav-text": c("nav-text"),
      "nav-strong": c("nav-strong"),
      "nav-muted": c("nav-muted"),
      // Status, used sparingly and always with words
      positive: c("positive"),
      "positive-soft": c("positive-soft"),
      warning: c("warning"),
      "warning-soft": c("warning-soft"),
      critical: c("critical"),
      "critical-soft": c("critical-soft"),
      live: c("live"),
      "logo-light": c("logo-light"),
      scrim: c("scrim"),
    },
    fontFamily: {
      sans: ["var(--font-inter)", "system-ui", "sans-serif"],
    },
    fontSize: {
      tiny: ["12px", { lineHeight: "16px" }],
      eyebrow: ["11px", { lineHeight: "16px", letterSpacing: "0.06em" }],
      label: ["13px", { lineHeight: "18px" }],
      meta: ["14px", { lineHeight: "20px" }],
      date: ["14px", { lineHeight: "20px" }],
      body: ["14px", { lineHeight: "22px" }],
      "row-title": ["15px", { lineHeight: "22px" }],
      section: ["16px", { lineHeight: "24px", letterSpacing: "-0.005em" }],
      score: ["28px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
      logo: ["19px", { lineHeight: "24px", letterSpacing: "-0.02em" }],
      title: ["24px", { lineHeight: "30px", letterSpacing: "-0.02em" }],
      headline: ["28px", { lineHeight: "34px", letterSpacing: "-0.025em" }],
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
      control: "8px",
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
      // Dropdowns, the palette and dialogs only: they float above the page.
      popover: "0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px rgb(var(--shadow) / 0.12)",
    },
    extend: {
      spacing: {
        sidebar: "244px",
        topbar: "56px",
        control: "36px",
        tile: "36px",
        avatar: "32px",
        "avatar-sm": "24px",
        rail: "300px",
        panel: "420px",
        drawer: "280px",
      },
      gridTemplateColumns: {
        resources: "repeat(4, minmax(0, 1fr)) 12rem",
        // Main column plus a slim right rail (Home, thread, approval, workspace).
        "main-rail": "minmax(0, 1fr) 300px",
        projects: "minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 0.8fr) minmax(0, 1.7fr)",
      },
      maxWidth: {
        content: "1120px",
        narrow: "760px",
        search: "520px",
        modal: "600px",
        prose: "68ch",
      },
      maxHeight: {
        menu: "70vh",
      },
    },
  },
  plugins: [],
};

export default config;
