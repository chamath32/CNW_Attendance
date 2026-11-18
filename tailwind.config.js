/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cnw: {
          dark: '#02353C',       // Primary dark brand color
          mint: '#C1F6ED',       // Light mint accent
          green: '#449342',      // Forest / success green
          teal: '#2EAF7D',       // Emerald teal
          cyan: '#3FD0C9',       // Aqua cyan highlight
          surface: '#F8FAFC',    // Crisp surface
          card: '#FFFFFF',
          border: '#E2E8F0',
          muted: '#64748B',
          text: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Sinhala', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
