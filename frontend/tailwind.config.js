/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium Dark Slate and Indigo theme
        brand: {
          50: '#f0f3ff',
          100: '#e1e7ff',
          200: '#c5d0ff',
          300: '#9aa9ff',
          400: '#6877ff',
          500: '#4f46e5', // Brand color
          600: '#3b2fc9',
          700: '#2d21a3',
          800: '#261b84',
          950: '#0c0734',
        },
        darkbg: '#0a0f1d',
        darkcard: '#141c30',
        darkborder: '#1f2d4d',
        accentgreen: '#10b981',
        accentred: '#ef4444',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
