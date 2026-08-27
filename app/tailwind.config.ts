import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Material-style single-hue blue, anchored at the requested #2580FA
        // (500). 600+ is deliberately darker than a literal tonal step so
        // bg-primary-600/700 text-white buttons clear WCAG 4.5:1 contrast.
        primary: {
          50: "#e8f1fe",
          100: "#cfe3fd",
          200: "#9fc7fb",
          300: "#6fabf9",
          400: "#4592f9",
          500: "#2580fa",
          600: "#1c68d1",
          700: "#1552a8",
          800: "#0f3d7e",
          900: "#0a2b57",
        },
        // "Primary dark" in classic Material terms — the same blue hue, just
        // deeper, used for flat app-bar/hero surfaces and solid CTA buttons.
        // Kept as a separate token (named "maroon" for history) so existing
        // class references didn't need touching across the app.
        maroon: {
          50: "#e8f1fe",
          100: "#cfe3fd",
          200: "#9fc7fb",
          300: "#6fabf9",
          400: "#3d74c4",
          500: "#1c68d1",
          600: "#17539c",
          700: "#123f74",
          800: "#0d2f57",
          900: "#081f3a",
        },
        // Material neutral surface grays (not blue-tinted) — background,
        // cards, and dividers.
        cream: {
          50: "#ffffff",
          100: "#f5f5f5",
          200: "#e0e0e0",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "Sarabun", "Noto Sans Thai", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Pridi", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
