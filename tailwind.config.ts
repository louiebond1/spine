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
      tiny: ["12px", { lineHeight: "16px" }],
      eyebrow: ["12px", { lineHeight: "16px", letterSpacing: "0.08em" }],
      label: ["13px", { lineHeight: "18px" }],
      meta: ["15px", { lineHeight: "22px" }],
      date: ["15px", { lineHeight: "22px" }],
      body: ["15px", { lineHeight: "24px" }],
      "row-title": ["16px", { lineHeight: "24px" }],
      section: ["20px", { lineHeight: "28px" }],
      score: ["32px", { lineHeight: "36px" }],
      logo: ["26px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
      headline: ["34px", { lineHeight: "42px", letterSpacing: "-0.02em" }],
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
