import type { Config } from "tailwindcss";

// Палітра Selfy — згідно з дизайном тараса
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Помаранчевий бренд Selfy
        accent: {
          50: "#FFF4EF",
          100: "#FFE3D6",
          400: "#F18056",
          500: "#E8643C",
          600: "#D24F28",
          700: "#A23B1C",
        },
        ink: {
          900: "#15171A",
          800: "#23262B",
          700: "#3A3F47",
          600: "#5B6371",
          500: "#7B8593",
          400: "#A6AEBA",
          300: "#CFD4DC",
          200: "#E5E8EE",
          100: "#F1F3F7",
          50: "#F8F9FB",
        },
      },
      fontFamily: {
        sans: ["Onest", "Manrope", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 4px rgba(15,23,42,0.05)",
        soft: "0 8px 32px rgba(15,23,42,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
