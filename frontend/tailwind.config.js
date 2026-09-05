/**
 * Visual identity.
 *
 * Drawn from the tone of Methodist Church Ghana materials rather than copying
 * official branding: a deep ecclesiastical indigo for structure, the flame
 * scarlet of the Methodist emblem used sparingly for emphasis, and a muted gold
 * for accents. Warm off-white paper tones keep long reading comfortable.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2f9',
          100: '#d8e1f0',
          200: '#b3c4e0',
          300: '#85a2cb',
          400: '#5b7cb0',
          500: '#3d5d94',
          600: '#2f4877',
          700: '#26395e',
          800: '#1e2d4a',
          900: '#16223a',
          950: '#0d1524',
        },
        flame: {
          50: '#fdf3f3',
          100: '#fbe4e4',
          200: '#f7cdcd',
          300: '#f0aaaa',
          400: '#e57a7a',
          500: '#d55151',
          600: '#bf3434',
          700: '#a02929',
          800: '#852626',
          900: '#6f2525',
        },
        gold: {
          50: '#fbf8ef',
          100: '#f5eed6',
          200: '#ecdcab',
          300: '#dfc276',
          400: '#d3aa4d',
          500: '#c8a951',
          600: '#a97f2f',
          700: '#876128',
          800: '#714f27',
          900: '#604324',
        },
        paper: {
          50: '#fdfcfa',
          100: '#f8f6f1',
          200: '#f0ece4',
          300: '#e3ddd1',
          400: '#cdc4b3',
        },
        ink: {
          400: '#6b7280',
          500: '#4b5563',
          600: '#374151',
          700: '#26303f',
          800: '#1a222e',
          900: '#111820',
        },
        success: {
          50: '#eefbf3',
          100: '#d5f5e2',
          500: '#1f9d55',
          600: '#177f44',
          700: '#136536',
        },
        warning: {
          50: '#fdf7ec',
          100: '#faedd3',
          500: '#c98a1e',
          600: '#a36e17',
        },
        danger: {
          50: '#fdf2f2',
          100: '#fbe2e2',
          500: '#c53030',
          600: '#a22525',
        },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Syllabus prose sits a step above interface text and is given generous
        // leading; this is material a candidate reads for half an hour at a time.
        'reading-base': ['1.125rem', { lineHeight: '1.8' }],
        'reading-lg': ['1.25rem', { lineHeight: '1.85' }],
      },
      maxWidth: {
        reading: '66ch',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 34, 58, 0.05), 0 1px 3px rgba(22, 34, 58, 0.08)',
        lift: '0 4px 12px rgba(22, 34, 58, 0.08), 0 12px 32px rgba(22, 34, 58, 0.06)',
        focus: '0 0 0 3px rgba(61, 93, 148, 0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '60%': { opacity: '1', transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'gentle-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'slide-up': 'slide-up 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop-in': 'pop-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'gentle-pulse': 'gentle-pulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
