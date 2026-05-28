import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        // Doctor signature colors — matches CLAUDE.md "UI conventions"
        doc: {
          anirut:    "#7c3aed", // violet — อนิรุต
          kawin:     "#059669", // emerald — กวินท์
          kanok:     "#2563eb", // blue — กนก
          pruepong:  "#e11d48", // rose — พฤพงศ์
        },
      },
      keyframes: {
        "spin-slow": { "0%": { transform: "rotate(0)" }, "100%": { transform: "rotate(360deg)" } },
      },
      animation: { "spin-slow": "spin-slow 1.4s linear infinite" },
    },
  },
  plugins: [],
} satisfies Config;
