/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: 'var(--color-bg)',
          light: 'var(--color-bg-light)',
          lighter: 'var(--color-bg-lighter)',
          dark: '#0d0d0d'
        },
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)'
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
