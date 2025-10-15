/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f8ff',
          100: '#e6efff',
          200: '#c5daff',
          300: '#9bbcff',
          400: '#6f95ff',
          500: '#4f6eff',
          600: '#3a4af2',
          700: '#2c39c1',
          800: '#232f94',
          900: '#1f2b73',
        },
      },
      fontFamily: {
        sans: ['"Prompt"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
