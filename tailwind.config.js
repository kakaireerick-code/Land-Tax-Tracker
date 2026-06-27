/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        uganda: {
          red: '#C8102E',
          yellow: '#FCDD09',
          dark: '#1a1a1a',
        },
        gray: {
          750: '#2d3748',
        },
      },
    },
  },
  plugins: [],
};
