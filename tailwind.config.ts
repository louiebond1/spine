import type { Config } from "tailwindcss";

// Design tokens sampled from /design at 1536x1024 (see PLAN.md "Design tokens").
// Theme keys below REPLACE Tailwind's defaults, so anything off-token fails to build.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      background: "#FAFBFC",
      surface: "#FFFFFF",
      border: "#E6EAF1",
      text: "#0A0B3B",
      "text-muted": "#6F70A0",
      brand: "#005AFE",
      "brand-hover": "#004BE0",
      "brand-soft": "#E8F1FD",
      "neutral-soft": "#F1F2F5",
      live: "#0BD46F",
      // Logo mark only: the lighter end of the bar gradient in 01-home.png.
      "logo-light": "#00A2F8",
    },
    fontFamily: {
      sans: ["var(--font-inter)", "system-ui", "sans-serif"],
    },
    fontSize: {
      tiny: ["13px", { lineHeight: "18px" }],
      eyebrow: ["14px", { lineHeight: "20px", letterSpacing: "0.08em" }],
      label: ["15px", { lineHeight: "22px" }],
      meta: ["18px", { lineHeight: "26px" }],
      date: ["18px", { lineHeight: "26px" }],
      body: ["18px", { lineHeight: "28px" }],
      "row-title": ["20px", { lineHeight: "28px" }],
      section: ["24px", { lineHeight: "32px" }],
      score: ["40px", { lineHeight: "44px" }],
      logo: ["32px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
      headline: ["42px", { lineHeight: "52px", letterSpacing: "-0.02em" }],
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
        sidebar: "284px",
        "search-inset": "216px",
        "new-button": "160px",
        topbar: "82px",
        control: "52px",
        tile: "68px",
        action: "152px",
        avatar: "48px",
        "avatar-sm": "40px",
        rail: "300px",
      },
      maxWidth: {
        content: "1180px",
        narrow: "900px",
        search: "686px",
        modal: "640px",
      },
    },
  },
  plugins: [],
};

export default config;
