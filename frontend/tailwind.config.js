/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        plant: {
          bg: '#0a0e14',
          panel: '#0f1520',
          card: '#141b29',
          border: '#1f2a3d',
          accent: '#00d4ff',
          good: '#22c55e',
          warn: '#f59e0b',
          bad: '#ef4444',
          text: '#e5e7eb',
          muted: '#7c8aa0',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
};
