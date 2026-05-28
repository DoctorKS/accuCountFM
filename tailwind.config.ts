import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // TH Sarabun New = SIPA's public-domain Thai font (embedded in repo).
        // Fallback chain in case @font-face fails (e.g. CSP issues mid-dev).
        sans: ['"TH Sarabun New"', '"IBM Plex Sans Thai"', "Sarabun", "system-ui", "sans-serif"],
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
