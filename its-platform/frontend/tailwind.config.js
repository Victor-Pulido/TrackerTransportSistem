/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A3A5C',
          dark:    '#0F2540',
          deeper:  '#0A1929',
          light:   '#2C5282',
        },
        accent: {
          DEFAULT: '#E8A020',
          light:   '#F6C453',
        },
        success:         '#1E7A3C',
        warning:         '#C97708',
        danger:          '#B91C1C',
        surface:         '#FFFFFF',
        'app-bg':        '#ECF1F8',
        border:          '#D4DCE8',
        'border-subtle': '#E8EFF7',
        'text-primary':  '#0F1E2D',
        'text-secondary':'#526070',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(15,37,64,0.07), 0 1px 2px rgba(15,37,64,0.04)',
        panel: '0 4px 16px rgba(15,37,64,0.08), 0 2px 4px rgba(15,37,64,0.04)',
        modal: '0 16px 48px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
    },
  },
  plugins: [],
}
