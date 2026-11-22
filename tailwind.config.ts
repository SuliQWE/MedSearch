import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf7",
          100: "#d3f5ea",
          200: "#a9eAD5",
          300: "#72d8bb",
          400: "#3fc1a0",
          500: "#1fa688",
          600: "#138470",
          700: "#126a5b",
          800: "#13554a",
          900: "#12463e",
        },
        ink: {
          50: "#f6f8f9",
          100: "#eaeff1",
          200: "#d5dde1",
          300: "#b0bdc4",
          400: "#7f909a",
          500: "#5c6e79",
          600: "#445661",
          700: "#34434c",
          800: "#232f36",
          900: "#141c21",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,28,33,0.04), 0 6px 20px -8px rgba(20,28,33,0.10)",
        lift: "0 2px 4px rgba(20,28,33,0.05), 0 16px 32px -12px rgba(18,106,91,0.22)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
