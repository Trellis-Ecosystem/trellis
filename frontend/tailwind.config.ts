import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0A0E17',
          800: '#0F1929',
          700: '#1E293B',
        },
        cyan: {
          400: '#00C2FF',
        },
        gold: {
          400: '#FBBF24',
        }
      }
    },
  },
  plugins: [],
} satisfies Config
