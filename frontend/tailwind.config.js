/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ide: {
          bg: '#181824',
          sidebar: '#1e1e2e',
          editor: '#1e1e2e',
          activeTab: '#181824',
          inactiveTab: '#14141f',
          terminal: '#11111b',
          border: '#313244',
          accent: '#89b4fa',
          accentHover: '#b4befe',
          text: '#cdd6f4',
          muted: '#6c7086'
        }
      }
    },
  },
  plugins: [],
}
