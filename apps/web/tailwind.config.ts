import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'kenya-green': {
          50: '#E6F0EA',
          100: '#CCE1D5',
          200: '#99C3AB',
          300: '#66A581',
          400: '#338757',
          500: '#0A5C36',
          600: '#084A2B',
          700: '#064523',
          800: '#04301A',
          900: '#032E17',
        },
        'kenya-amber': {
          50: '#FEF5E0',
          100: '#FDEBB7',
          200: '#FBD78A',
          300: '#F9C35D',
          400: '#F5AF30',
          500: '#E8A317',
          600: '#C98A0C',
          700: '#A87203',
          800: '#875900',
          900: '#664000',
        },
        'kenya-red': '#BB1E10',
        'kenya-surface': {
          light: '#FBF8F1',
          dark: '#1A1A1F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Lexend', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'xp-fill': 'xpFill 1s ease-out forwards',
        'confetti': 'confetti 2s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
