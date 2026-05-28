import type { Config } from "tailwindcss";

// Палітра Selfy (підправити коли тарас дасть точні HEX зі сайту/Figma)
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Основний — темно-синій B2B довіра
        primary: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          900: "#1E3A8A",
        },
        // Акцент — помаранчевий Selfy
        accent: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          500: "#FF7A00",
          600: "#EA580C",
          700: "#C2410C",
        },
        // Нейтральні
        surface: "#F8FAFC",
        border: "#E2E8F0",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
