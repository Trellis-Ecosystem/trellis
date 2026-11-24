import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          500: "#3b4a6b",
          600: "#2c3a56",
          700: "#1e2a44",
          800: "#141d31",
          900: "#0b1220",
        },
      },
    },
  },
  plugins: [],
};

export default config;
