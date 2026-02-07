/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: '#1a1a1a',
          light: '#2d2d2d',
          dark: '#0d0d0d'
        },
        surface: '#252525',
        accent: '#4a9eff'
      },
      spacing: {
        'toolbar': '60px',
        'sidebar': '280px'
      },
      zIndex: {
        'canvas': '10',
        'toolbar': '20',
        'sidebar': '30',
        'sheet': '40',
        'action': '50',
        'modal': '60'
      }
    }
  },
  plugins: []
};
