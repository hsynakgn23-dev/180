/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: '#8A9A5B',
        clay: '#A57164',
      },
      spacing: {
        'breath-zone': '160px',
      }
    },
  },
  plugins: [],
}
