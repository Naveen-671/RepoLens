module.exports = {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: '#111827',
        elevated: '#1e293b',
      },
    },
  },
  plugins: [],
};
