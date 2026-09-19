import type { Config } from "tailwindcss";

const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]));

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // สีทั้งหมดอ่านจากตัวแปร CSS (--c-*) ที่ globals.css กำหนดตามธีม
      // (navy-gold / white-gold) — สลับธีมได้โดยไม่ต้องแก้ class ใดๆ
      colors: {
        primary: scale("primary", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        maroon: scale("maroon", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        cream: scale("cream", [50, 100, 200]),
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
