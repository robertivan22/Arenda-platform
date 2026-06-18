/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Muted olive/green accent — legacy-inspired
        brand: {
          50:  '#f4f6f0',
          100: '#e6ebe0',
          200: '#ccd7c0',
          300: '#a8bd96',
          400: '#7e9e6a',
          500: '#5c7f4c',  // primary
          600: '#4a6640',
          700: '#3b5033',
          800: '#2e3e28',
          900: '#1e2a1b',
        },
        // Sidebar
        sidebar: {
          bg:     '#1e2a1b',
          hover:  '#2e3e28',
          active: '#4a6640',
          text:   '#c8d8c0',
          muted:  '#7a9070',
        },
        // Status colors
        status: {
          active:     '#16a34a',
          inactive:   '#6b7280',
          archived:   '#9ca3af',
          blocked:    '#dc2626',
          draft:      '#d97706',
          terminated: '#7c3aed',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        slideDown: {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
        slideDown: 'slideDown 0.28s cubic-bezier(0.32,0.72,0,1)',
        fadeIn: 'fadeIn 0.2s ease-out',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
    },
  },
  plugins: [],
}
