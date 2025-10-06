// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 8px 30px rgba(2,6,23,0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
      maxWidth: {
        'content': '72rem', // ~1152px
      },
    },
  },
  plugins: [],
}